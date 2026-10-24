import { and, eq } from "drizzle-orm";
import type { Request } from "express";
import { getDb, schema } from "@/db";
import { normalizeCatalogScopeMode, type CatalogScopeMode } from "@/lib/catalog-scope";
import { LocationsService } from "@/services/locations.service";

export class CatalogScopeService {
  static async getScopeMode(merchantId: string): Promise<CatalogScopeMode> {
    const db = getDb();
    const row = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { catalogScopeMode: true },
    });
    return normalizeCatalogScopeMode(row?.catalogScopeMode);
  }

  /**
   * Target branch for a new catalog row in per_location mode.
   * Uses explicit body/query, then X-Location-Id when it came from the panel switcher.
   */
  static async resolveCreateLocationId(
    merchantId: string,
    req: Pick<Request, "body" | "query" | "locationId" | "locationFromHeader">
  ): Promise<string | undefined> {
    const mode = await this.getScopeMode(merchantId);
    if (mode !== "per_location") return undefined;

    const explicit = String(
      req.body?.ownerLocationId ?? req.body?.locationId ?? req.query?.locationId ?? ""
    ).trim();
    if (explicit) {
      return (await LocationsService.resolveLocationIdOrNull(merchantId, explicit)) ?? undefined;
    }

    if (req.locationFromHeader && String(req.locationId || "").trim()) {
      const fromHeader = String(req.locationId).trim();
      return (await LocationsService.resolveLocationIdOrNull(merchantId, fromHeader)) ?? undefined;
    }

    const db = getDb();
    const locations = await db.query.locations.findMany({
      where: eq(schema.locations.merchantId, merchantId),
      columns: { id: true },
    });
    if (locations.length === 1) {
      return locations[0].id;
    }

    return undefined;
  }

  static async requireCreateLocationId(
    merchantId: string,
    req: Pick<Request, "body" | "query" | "locationId" | "locationFromHeader">
  ): Promise<string | undefined> {
    const mode = await this.getScopeMode(merchantId);
    if (mode !== "per_location") return undefined;

    const resolved = await this.resolveCreateLocationId(merchantId, req);
    if (resolved) return resolved;

    const db = getDb();
    const locations = await db.query.locations.findMany({
      where: eq(schema.locations.merchantId, merchantId),
      columns: { id: true },
    });
    if (locations.length <= 1) {
      throw new Error("Location is required to create catalog items");
    }
    throw new Error(
      "Select a branch for this item (use the location switcher or choose a branch when creating)."
    );
  }

  static async assertCategoryOwnedByLocation(
    merchantId: string,
    categoryId: string | undefined,
    locationId: string
  ): Promise<void> {
    if (!categoryId) return;
    const db = getDb();
    const cat = await db.query.categories.findFirst({
      where: and(
        eq(schema.categories.merchantId, merchantId),
        eq(schema.categories.id, categoryId)
      ),
      columns: { locationId: true },
    });
    if (!cat) throw new Error("Category not found");
    const catLoc = String(cat.locationId || "").trim();
    if (catLoc && catLoc !== locationId) {
      throw new Error("Category belongs to a different branch");
    }
  }

  /** Stamp ownership and link so POS / branch lists see the item without HQ push. */
  static async bindCatalogItemToLocation(
    merchantId: string,
    locationId: string,
    productId: string
  ): Promise<void> {
    const db = getDb();
    const loc = String(locationId || "").trim();
    const pid = String(productId || "").trim();
    if (!loc || !pid) return;

    const existing = await db.query.locationCatalogLinks.findFirst({
      where: and(
        eq(schema.locationCatalogLinks.merchantId, merchantId),
        eq(schema.locationCatalogLinks.locationId, loc),
        eq(schema.locationCatalogLinks.hqProductId, pid)
      ),
      columns: { id: true },
    });
    if (existing) return;

    await db.insert(schema.locationCatalogLinks).values({
      merchantId,
      locationId: loc,
      hqProductId: pid,
      localProductId: pid,
      syncStatus: "synced",
    });
  }
}
