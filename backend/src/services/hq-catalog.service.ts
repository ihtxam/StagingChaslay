import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  collectPendingProductIds,
  hasNeverSynced,
  HQ_SYNC_UNCATEGORIZED,
  productIdsInSyncCategoryScope,
  resolveSyncProductIds,
  type HqSyncLinkRef,
  type HqSyncLocationRef,
  type HqSyncProductRef,
} from "@/lib/hq-catalog-sync";
import {
  DEFAULT_CATALOG_VISIBILITY,
  isVisibleOnChannel,
  normalizeCatalogVisibility,
} from "@/lib/catalog-visibility";
import { roundMoney2 } from "@/lib/money";
import { v4 as uuidv4 } from "uuid";

export type BulkPricingPreviewRow = {
  productId: string;
  name: string;
  categoryId: string | null;
  currentPrice: number;
  newPrice: number;
};

export type BulkPricingPreview = {
  token: string;
  rows: BulkPricingPreviewRow[];
  affectedCount: number;
};

const previewCache = new Map<string, { merchantId: string; rows: BulkPricingPreviewRow[]; expires: number }>();
const PREVIEW_TTL_MS = 15 * 60 * 1000;

function roundTo(value: number, step: number | null | undefined): number {
  if (!step || step <= 0) return roundMoney2(value);
  return roundMoney2(Math.round(value / step) * step);
}

function applyOp(current: number, operation: string, valueType: string, value: number): number {
  let next = current;
  if (operation === "decrease") {
    next = valueType === "percent" ? current * (1 - value / 100) : current - value;
  } else {
    next = valueType === "percent" ? current * (1 + value / 100) : current + value;
  }
  return Math.max(0, next);
}

export class BulkPricingService {
  static async preview(
    merchantId: string,
    input: {
      locationIds?: string[];
      categoryIds?: string[];
      productIds?: string[];
      operation: "increase" | "decrease";
      valueType: "fixed" | "percent";
      value: number;
      roundTo?: number | null;
    }
  ): Promise<BulkPricingPreview> {
    const db = getDb();
    const productIds = (input.productIds || []).filter(Boolean);
    const categoryIds = (input.categoryIds || []).filter(Boolean);

    let products = await db.query.products.findMany({
      where: eq(schema.products.merchantId, merchantId),
      columns: { id: true, name: true, categoryId: true, price: true, isActive: true },
    });

    if (productIds.length > 0) {
      const set = new Set(productIds);
      products = products.filter((p) => set.has(p.id));
    } else if (categoryIds.length > 0) {
      const set = new Set(categoryIds);
      products = products.filter((p) => p.categoryId && set.has(p.categoryId));
    }

    products = products.filter((p) => p.isActive !== false);

    const rows: BulkPricingPreviewRow[] = products.map((p) => {
      const currentPrice = Number(p.price) || 0;
      const newPrice = roundTo(
        applyOp(currentPrice, input.operation, input.valueType, Number(input.value) || 0),
        input.roundTo
      );
      return {
        productId: p.id,
        name: p.name,
        categoryId: p.categoryId,
        currentPrice,
        newPrice,
      };
    });

    const token = uuidv4();
    previewCache.set(token, {
      merchantId,
      rows,
      expires: Date.now() + PREVIEW_TTL_MS,
    });

    return { token, rows, affectedCount: rows.length };
  }

  static async apply(
    merchantId: string,
    previewToken: string,
    opts?: { staffId?: string | null; staffName?: string | null; locationIds?: string[] }
  ) {
    const cached = previewCache.get(previewToken);
    if (!cached || cached.merchantId !== merchantId || cached.expires < Date.now()) {
      throw new Error("Preview expired — run preview again");
    }
    previewCache.delete(previewToken);

    const db = getDb();
    const locationIds = opts?.locationIds || [];

    await db.transaction(async (tx) => {
      for (const row of cached.rows) {
        if (row.newPrice === row.currentPrice) continue;

        if (locationIds.length > 0) {
          for (const locationId of locationIds) {
            const existing = await tx.query.locationProductOverrides.findFirst({
              where: and(
                eq(schema.locationProductOverrides.locationId, locationId),
                eq(schema.locationProductOverrides.productId, row.productId)
              ),
            });
            if (existing) {
              await tx
                .update(schema.locationProductOverrides)
                .set({
                  priceOverride: row.newPrice.toFixed(2),
                  updatedAt: new Date(),
                })
                .where(eq(schema.locationProductOverrides.id, existing.id));
            } else {
              await tx.insert(schema.locationProductOverrides).values({
                merchantId,
                locationId,
                productId: row.productId,
                priceOverride: row.newPrice.toFixed(2),
              });
            }
          }
        } else {
          await tx
            .update(schema.products)
            .set({ price: row.newPrice.toFixed(2), updatedAt: new Date() })
            .where(and(eq(schema.products.id, row.productId), eq(schema.products.merchantId, merchantId)));
        }
      }

      await tx.insert(schema.pricingBulkJobs).values({
        merchantId,
        locationIds,
        categoryIds: [],
        productIds: cached.rows.map((r) => r.productId),
        operation: "bulk",
        valueType: "mixed",
        value: "0",
        affectedCount: cached.rows.length,
        createdByStaffId: opts?.staffId || null,
        createdByName: opts?.staffName || null,
      });
    });

    return { affectedCount: cached.rows.length };
  }

  static async listJobs(merchantId: string, limit = 20) {
    const db = getDb();
    return db.query.pricingBulkJobs.findMany({
      where: eq(schema.pricingBulkJobs.merchantId, merchantId),
      orderBy: [desc(schema.pricingBulkJobs.createdAt)],
      limit,
    });
  }
}

export class HqCatalogService {
  static async listVersions(merchantId: string) {
    const db = getDb();
    return db.query.hqCatalogVersions.findMany({
      where: eq(schema.hqCatalogVersions.merchantId, merchantId),
      orderBy: [desc(schema.hqCatalogVersions.createdAt)],
      limit: 50,
    });
  }

  static async createVersion(
    merchantId: string,
    input: {
      name?: string;
      productIds?: string[];
      categoryIds?: string[];
      staffId?: string | null;
    }
  ) {
    const db = getDb();
    const products = await db.query.products.findMany({
      where: eq(schema.products.merchantId, merchantId),
    });

    const activeRefs: HqSyncProductRef[] = products
      .filter((p) => p.isActive !== false)
      .map((p) => ({
        id: p.id,
        categoryId: p.categoryId,
        updatedAtMs: p.updatedAt?.getTime() || 0,
      }));

    const scopedIds = resolveSyncProductIds(
      activeRefs,
      input.productIds || [],
      input.categoryIds || []
    );
    const scopedSet = new Set(scopedIds);

    let selected = products.filter((p) => scopedSet.has(p.id));
    if (!selected.length && input.productIds?.length) {
      const set = new Set(input.productIds);
      selected = products.filter((p) => set.has(p.id));
    }

    const categoryIdsInProducts = new Set(
      selected.map((p) => p.categoryId).filter(Boolean) as string[]
    );
    const requestedCategoryIds = (input.categoryIds || [])
      .map((id) => String(id || "").trim())
      .filter((id) => id && id !== HQ_SYNC_UNCATEGORIZED);

    let categories = await db.query.categories.findMany({
      where: eq(schema.categories.merchantId, merchantId),
    });
    if (requestedCategoryIds.length) {
      const allowed = new Set(requestedCategoryIds);
      categories = categories.filter((c) => allowed.has(c.id));
    } else if (scopedSet.size) {
      categories = categories.filter((c) => categoryIdsInProducts.has(c.id));
    }

    const payload = {
      products: selected.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        categoryId: p.categoryId,
        visibility: p.visibility,
        isActive: p.isActive,
      })),
      categories,
    };

    const [latest] = await db
      .select({ max: sql<number>`coalesce(max(${schema.hqCatalogVersions.version}), 0)` })
      .from(schema.hqCatalogVersions)
      .where(eq(schema.hqCatalogVersions.merchantId, merchantId));

    const [row] = await db
      .insert(schema.hqCatalogVersions)
      .values({
        merchantId,
        version: Number(latest?.max || 0) + 1,
        name: input.name?.trim() || `HQ Menu v${Number(latest?.max || 0) + 1}`,
        payloadJson: payload,
        createdByStaffId: input.staffId || null,
      })
      .returning();
    return row;
  }

  static async pushToLocations(
    merchantId: string,
    input: {
      versionId?: string;
      locationIds: string[];
      overwritePrices?: boolean;
      useCurrentCatalog?: boolean;
      productIds?: string[];
      categoryIds?: string[];
      setOnSaleAfterSync?: boolean;
      staffId?: string | null;
    }
  ) {
    const locationIds = (input.locationIds || []).filter(Boolean);
    if (!locationIds.length) throw new Error("Select at least one location");

    let versionId = String(input.versionId || "").trim();
    let versionRow: typeof schema.hqCatalogVersions.$inferSelect | null = null;

    if (input.useCurrentCatalog || !versionId) {
      const created = await this.createVersion(merchantId, {
        name: `HQ sync ${new Date().toISOString().slice(0, 10)}`,
        productIds: input.productIds,
        categoryIds: input.categoryIds,
        staffId: input.staffId || null,
      });
      versionId = created.id;
      versionRow = created;
    } else {
      const db = getDb();
      versionRow = await db.query.hqCatalogVersions.findFirst({
        where: and(
          eq(schema.hqCatalogVersions.id, versionId),
          eq(schema.hqCatalogVersions.merchantId, merchantId)
        ),
      });
      if (!versionRow) throw new Error("HQ catalog version not found");
    }

    const syncResult = await this.syncProductsToLocations(merchantId, {
      versionId,
      locationIds,
      productIds: input.productIds,
      categoryIds: input.categoryIds,
      overwritePrices: input.overwritePrices,
      setOnSaleAfterSync: input.setOnSaleAfterSync,
      useVersionProductList: !input.useCurrentCatalog && !input.productIds?.length && !input.categoryIds?.length,
    });

    return { ...syncResult, versionId, version: versionRow };
  }

  static async getSyncMenuState(merchantId: string) {
    const db = getDb();
    const [locations, categories, products, allLinks] = await Promise.all([
      db.query.locations.findMany({
        where: eq(schema.locations.merchantId, merchantId),
        orderBy: [asc(schema.locations.name)],
        columns: { id: true, name: true },
      }),
      db.query.categories.findMany({
        where: eq(schema.categories.merchantId, merchantId),
        orderBy: [asc(schema.categories.sortOrder)],
        columns: { id: true, name: true, sortOrder: true },
      }),
      db.query.products.findMany({
        where: and(eq(schema.products.merchantId, merchantId), eq(schema.products.isActive, true)),
        orderBy: [asc(schema.products.sortOrder), asc(schema.products.name)],
        columns: {
          id: true,
          name: true,
          categoryId: true,
          price: true,
          updatedAt: true,
          visibility: true,
        },
      }),
      db.query.locationCatalogLinks.findMany({
        where: eq(schema.locationCatalogLinks.merchantId, merchantId),
      }),
    ]);

    const linkCountByLocation = new Map<string, number>();
    const linksByLocation = new Map<string, HqSyncLinkRef[]>();
    for (const link of allLinks) {
      linkCountByLocation.set(link.locationId, (linkCountByLocation.get(link.locationId) || 0) + 1);
      const row: HqSyncLinkRef = {
        hqProductId: link.hqProductId,
        localProductId: link.localProductId,
        updatedAtMs: link.updatedAt?.getTime() || 0,
      };
      const list = linksByLocation.get(link.locationId) || [];
      list.push(row);
      linksByLocation.set(link.locationId, list);
    }

    const productRefs: HqSyncProductRef[] = products.map((p) => ({
      id: p.id,
      categoryId: p.categoryId,
      updatedAtMs: p.updatedAt?.getTime() || 0,
    }));

    const locationRefs: HqSyncLocationRef[] = locations.map((l) => ({
      id: l.id,
      name: l.name,
      linkCount: linkCountByLocation.get(l.id) || 0,
    }));

    const pendingProductIds = collectPendingProductIds(productRefs, linksByLocation, locationRefs);
    const neverSynced = hasNeverSynced(locationRefs);
    const hasPending =
      locations.length > 1 && (neverSynced || pendingProductIds.length > 0);

    const productsByCategory = new Map<string | null, typeof products>();
    for (const p of products) {
      const key = p.categoryId || null;
      const list = productsByCategory.get(key) || [];
      list.push(p);
      productsByCategory.set(key, list);
    }

    const locationStats = locationRefs.map((loc) => {
      const links = linksByLocation.get(loc.id) || [];
      const linkedIds = new Set(
        links.map((l) => l.localProductId || l.hqProductId).filter(Boolean) as string[]
      );
      const pendingAtLoc = productRefs.filter((p) => {
        const link = links.find((l) => l.hqProductId === p.id);
        return loc.linkCount > 0 && (!link || p.updatedAtMs > link.updatedAtMs);
      }).length;
      return {
        locationId: loc.id,
        name: loc.name,
        linkedCount: linkedIds.size,
        pendingCount: pendingAtLoc,
        usesCatalogLinks: loc.linkCount > 0,
      };
    });

    return {
      multiLocation: locations.length > 1,
      hasPending,
      neverSynced,
      pendingProductIds,
      pendingCount: pendingProductIds.length,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        products: (productsByCategory.get(c.id) || []).map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          categoryId: p.categoryId,
          pending: pendingProductIds.includes(p.id),
        })),
      })),
      uncategorizedProducts: (productsByCategory.get(null) || []).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        categoryId: null,
        pending: pendingProductIds.includes(p.id),
      })),
      locationStats,
      totalActiveProducts: products.length,
    };
  }

  static async syncMenuToLocations(
    merchantId: string,
    input: {
      locationIds: string[];
      productIds?: string[];
      categoryIds?: string[];
      overwritePrices?: boolean;
      setOnSaleAfterSync?: boolean;
      staffId?: string | null;
    }
  ) {
    return this.pushToLocations(merchantId, {
      ...input,
      useCurrentCatalog: true,
    });
  }

  private static async syncProductsToLocations(
    merchantId: string,
    input: {
      versionId: string;
      locationIds: string[];
      productIds?: string[];
      categoryIds?: string[];
      overwritePrices?: boolean;
      setOnSaleAfterSync?: boolean;
      useVersionProductList?: boolean;
    }
  ) {
    const db = getDb();
    const version = await db.query.hqCatalogVersions.findFirst({
      where: and(
        eq(schema.hqCatalogVersions.id, input.versionId),
        eq(schema.hqCatalogVersions.merchantId, merchantId)
      ),
    });
    if (!version) throw new Error("HQ catalog version not found");

    const payload = version.payloadJson as {
      products?: Array<{
        id: string;
        price: string | number;
        visibility?: unknown;
      }>;
    };

    const allProducts = await db.query.products.findMany({
      where: eq(schema.products.merchantId, merchantId),
      columns: {
        id: true,
        price: true,
        visibility: true,
        isActive: true,
        categoryId: true,
        updatedAt: true,
      },
    });

    const activeRefs: HqSyncProductRef[] = allProducts
      .filter((p) => p.isActive !== false)
      .map((p) => ({
        id: p.id,
        categoryId: p.categoryId,
        updatedAtMs: p.updatedAt?.getTime() || 0,
      }));

    let targetIds: string[];
    if (input.useVersionProductList) {
      targetIds = (payload.products || []).map((p) => p.id).filter(Boolean);
    } else {
      targetIds = resolveSyncProductIds(
        activeRefs,
        input.productIds || [],
        input.categoryIds || []
      );
    }
    if (!targetIds.length) {
      throw new Error("No products selected to sync");
    }

    const priceById = new Map<string, string>();
    for (const hp of payload.products || []) {
      priceById.set(hp.id, String(hp.price));
    }
    for (const p of allProducts) {
      if (!priceById.has(p.id)) priceById.set(p.id, String(p.price));
    }

    const productById = new Map(allProducts.map((p) => [p.id, p]));
    const targetSet = new Set(targetIds);
    const scopedCategoryIds = (input.categoryIds || []).filter(Boolean);
    const scopeProductIds =
      scopedCategoryIds.length > 0
        ? productIdsInSyncCategoryScope(activeRefs, scopedCategoryIds)
        : [];
    let linked = 0;
    const { HqMenuService } = await import("@/services/hq-menu.service");

    for (const locationId of input.locationIds) {
      if (scopeProductIds.length > 0) {
        const toUnlink = scopeProductIds.filter((id) => !targetSet.has(id));
        if (toUnlink.length) {
          await db
            .delete(schema.locationCatalogLinks)
            .where(
              and(
                eq(schema.locationCatalogLinks.merchantId, merchantId),
                eq(schema.locationCatalogLinks.locationId, locationId),
                inArray(schema.locationCatalogLinks.hqProductId, toUnlink)
              )
            );
        }
      }

      for (const productId of targetIds) {
        const local = productById.get(productId);
        if (!local || local.isActive === false) continue;

        const existingLink = await db.query.locationCatalogLinks.findFirst({
          where: and(
            eq(schema.locationCatalogLinks.locationId, locationId),
            eq(schema.locationCatalogLinks.hqProductId, productId)
          ),
        });

        if (existingLink) {
          await db
            .update(schema.locationCatalogLinks)
            .set({
              localProductId: local.id,
              syncStatus: "synced",
              fromHqVersionId: version.id,
              updatedAt: new Date(),
            })
            .where(eq(schema.locationCatalogLinks.id, existingLink.id));
        } else {
          await db.insert(schema.locationCatalogLinks).values({
            merchantId,
            locationId,
            hqProductId: productId,
            localProductId: local.id,
            syncStatus: "synced",
            fromHqVersionId: version.id,
          });
        }

        if (input.overwritePrices) {
          const price = priceById.get(productId) || String(local.price);
          const override = await db.query.locationProductOverrides.findFirst({
            where: and(
              eq(schema.locationProductOverrides.locationId, locationId),
              eq(schema.locationProductOverrides.productId, local.id)
            ),
          });
          if (override) {
            await db
              .update(schema.locationProductOverrides)
              .set({ priceOverride: price, updatedAt: new Date() })
              .where(eq(schema.locationProductOverrides.id, override.id));
          } else {
            await db.insert(schema.locationProductOverrides).values({
              merchantId,
              locationId,
              productId: local.id,
              priceOverride: price,
            });
          }
        }

        if (input.setOnSaleAfterSync) {
          const vis = normalizeCatalogVisibility(local.visibility);
          const channels = new Set(vis.channels);
          channels.add("pos");
          const override = await db.query.locationProductOverrides.findFirst({
            where: and(
              eq(schema.locationProductOverrides.locationId, locationId),
              eq(schema.locationProductOverrides.productId, local.id)
            ),
          });
          const patch = {
            isAvailable: true,
            visibility: { channels: [...channels] },
            updatedAt: new Date(),
          };
          if (override) {
            await db
              .update(schema.locationProductOverrides)
              .set(patch)
              .where(eq(schema.locationProductOverrides.id, override.id));
          } else if (!isVisibleOnChannel(local.visibility, "pos")) {
            await db.insert(schema.locationProductOverrides).values({
              merchantId,
              locationId,
              productId: local.id,
              visibility: patch.visibility,
              isAvailable: true,
            });
          } else {
            await db.insert(schema.locationProductOverrides).values({
              merchantId,
              locationId,
              productId: local.id,
              isAvailable: true,
            });
          }
        }

        linked += 1;
      }

      if (targetIds.length > 0) {
        await HqMenuService.ensureLocationPushMenu(merchantId, locationId, version.id);
      }
    }

    return { linked, locationCount: input.locationIds.length, productCount: targetIds.length };
  }

  static async listLocationLinks(merchantId: string, locationId: string) {
    const db = getDb();
    return db.query.locationCatalogLinks.findMany({
      where: and(
        eq(schema.locationCatalogLinks.merchantId, merchantId),
        eq(schema.locationCatalogLinks.locationId, locationId)
      ),
      orderBy: [asc(schema.locationCatalogLinks.createdAt)],
    });
  }
}
