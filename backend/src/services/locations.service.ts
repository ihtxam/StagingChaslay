import { and, asc, count, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type LocationRow = typeof schema.locations.$inferSelect;

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "location";
}

export class LocationsService {
  static async ensureDefaults(merchantId: string): Promise<LocationRow> {
    const db = getDb();
    const existing = await db.query.locations.findFirst({
      where: eq(schema.locations.merchantId, merchantId),
      orderBy: [asc(schema.locations.createdAt)],
    });
    if (existing) return existing;

    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: {
        name: true,
        businessCategory: true,
        address: true,
        city: true,
        country: true,
      },
    });
    if (!merchant) throw new Error("Merchant not found");

    const [row] = await db
      .insert(schema.locations)
      .values({
        merchantId,
        name: merchant.name?.trim() || "Main location",
        slug: "main",
        businessCategory: merchant.businessCategory || "restaurant",
        address: merchant.address,
        city: merchant.city,
        country: merchant.country,
        isDefault: true,
        status: "active",
      })
      .returning();
    return row;
  }

  static async getDefaultId(merchantId: string): Promise<string> {
    const row = await this.ensureDefaults(merchantId);
    return row.id;
  }

  static async resolveLocationId(
    merchantId: string,
    locationId?: string | null
  ): Promise<string> {
    const id = String(locationId || "").trim();
    if (!id) return this.getDefaultId(merchantId);
    const db = getDb();
    const row = await db.query.locations.findFirst({
      where: and(eq(schema.locations.id, id), eq(schema.locations.merchantId, merchantId)),
    });
    if (!row) throw new Error("Location not found");
    return row.id;
  }

  static async listForUser(
    merchantId: string,
    opts?: { staffId?: string | null; isOwner?: boolean }
  ) {
    await this.ensureDefaults(merchantId);
    const db = getDb();
    const rows = await db.query.locations.findMany({
      where: and(
        eq(schema.locations.merchantId, merchantId),
        eq(schema.locations.status, "active")
      ),
      orderBy: [asc(schema.locations.isDefault), asc(schema.locations.name)],
    });

    if (opts?.isOwner || !opts?.staffId) return rows;

    const scoped = await db.query.merchantStaffLocations.findMany({
      where: and(
        eq(schema.merchantStaffLocations.merchantId, merchantId),
        eq(schema.merchantStaffLocations.staffId, opts.staffId)
      ),
    });
    if (scoped.length === 0) return rows;
    const allowed = new Set(scoped.map((s) => s.locationId));
    return rows.filter((r) => allowed.has(r.id));
  }

  static async assertStaffAccess(
    merchantId: string,
    locationId: string,
    opts?: { staffId?: string | null; isOwner?: boolean }
  ) {
    if (opts?.isOwner || !opts?.staffId) return;
    const db = getDb();
    const scoped = await db.query.merchantStaffLocations.findMany({
      where: and(
        eq(schema.merchantStaffLocations.merchantId, merchantId),
        eq(schema.merchantStaffLocations.staffId, opts.staffId)
      ),
    });
    if (scoped.length === 0) return;
    if (!scoped.some((s) => s.locationId === locationId)) {
      throw new Error("You do not have access to this location");
    }
  }

  static async countActive(merchantId: string): Promise<number> {
    const db = getDb();
    const [row] = await db
      .select({ total: count() })
      .from(schema.locations)
      .where(
        and(eq(schema.locations.merchantId, merchantId), eq(schema.locations.status, "active"))
      );
    return Number(row?.total) || 0;
  }

  static async assertCanCreate(merchantId: string) {
    const { MerchantEntitlementsService } = await import(
      "@/services/merchant-entitlements.service"
    );
    await MerchantEntitlementsService.assertCanAddLocation(merchantId);
  }

  static async create(
    merchantId: string,
    input: {
      name: string;
      slug?: string;
      businessCategory?: string;
      address?: string | null;
      city?: string | null;
      country?: string | null;
      timezone?: string;
      isDefault?: boolean;
    }
  ) {
    await this.assertCanCreate(merchantId);
    const db = getDb();
    const name = String(input.name || "").trim();
    if (!name) throw new Error("Location name is required");

    let slug = slugify(input.slug || name);
    const taken = await db.query.locations.findFirst({
      where: and(eq(schema.locations.merchantId, merchantId), eq(schema.locations.slug, slug)),
    });
    if (taken) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    if (input.isDefault) {
      await db
        .update(schema.locations)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(schema.locations.merchantId, merchantId));
    }

    const [row] = await db
      .insert(schema.locations)
      .values({
        merchantId,
        name,
        slug,
        businessCategory: input.businessCategory || "restaurant",
        address: input.address || null,
        city: input.city || null,
        country: input.country || null,
        timezone: input.timezone || "Europe/Zurich",
        isDefault: !!input.isDefault,
        status: "active",
      })
      .returning();
    return row;
  }

  static async update(
    merchantId: string,
    locationId: string,
    input: Partial<{
      name: string;
      slug: string;
      businessCategory: string;
      address: string | null;
      city: string | null;
      country: string | null;
      timezone: string;
      isDefault: boolean;
      status: string;
      settings: Record<string, unknown> | null;
    }>
  ) {
    const db = getDb();
    const existing = await db.query.locations.findFirst({
      where: and(eq(schema.locations.id, locationId), eq(schema.locations.merchantId, merchantId)),
    });
    if (!existing) throw new Error("Location not found");

    if (input.isDefault) {
      await db
        .update(schema.locations)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(schema.locations.merchantId, merchantId));
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = String(input.name).trim();
    if (input.slug !== undefined) patch.slug = slugify(input.slug);
    if (input.businessCategory !== undefined) patch.businessCategory = input.businessCategory;
    if (input.address !== undefined) patch.address = input.address;
    if (input.city !== undefined) patch.city = input.city;
    if (input.country !== undefined) patch.country = input.country;
    if (input.timezone !== undefined) patch.timezone = input.timezone;
    if (input.isDefault !== undefined) patch.isDefault = input.isDefault;
    if (input.status !== undefined) patch.status = input.status;
    if (input.settings !== undefined) patch.settings = input.settings;

    const [row] = await db
      .update(schema.locations)
      .set(patch as typeof schema.locations.$inferInsert)
      .where(eq(schema.locations.id, locationId))
      .returning();
    return row;
  }

  static async remove(merchantId: string, locationId: string) {
    const db = getDb();
    const existing = await db.query.locations.findFirst({
      where: and(eq(schema.locations.id, locationId), eq(schema.locations.merchantId, merchantId)),
    });
    if (!existing) throw new Error("Location not found");
    if (existing.isDefault) throw new Error("Cannot delete the default location");

    const activeCount = await this.countActive(merchantId);
    if (activeCount <= 1) throw new Error("At least one location is required");

    await db
      .update(schema.locations)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(schema.locations.id, locationId));
    return { success: true };
  }

  static async getStaffLocationIds(merchantId: string, staffId: string): Promise<string[]> {
    const db = getDb();
    const rows = await db.query.merchantStaffLocations.findMany({
      where: and(
        eq(schema.merchantStaffLocations.merchantId, merchantId),
        eq(schema.merchantStaffLocations.staffId, staffId)
      ),
    });
    return rows.map((r) => r.locationId);
  }

  static async setStaffLocations(merchantId: string, staffId: string, locationIds: string[]) {
    const db = getDb();
    const unique = [...new Set(locationIds.filter(Boolean))];
    if (unique.length > 0) {
      const valid = await db.query.locations.findMany({
        where: and(
          eq(schema.locations.merchantId, merchantId),
          inArray(schema.locations.id, unique)
        ),
      });
      if (valid.length !== unique.length) throw new Error("Invalid location id");
    }

    await db
      .delete(schema.merchantStaffLocations)
      .where(
        and(
          eq(schema.merchantStaffLocations.merchantId, merchantId),
          eq(schema.merchantStaffLocations.staffId, staffId)
        )
      );

    if (unique.length === 0) return [];

    const inserted = await db
      .insert(schema.merchantStaffLocations)
      .values(
        unique.map((locationId) => ({
          merchantId,
          staffId,
          locationId,
        }))
      )
      .returning();
    return inserted.map((r) => r.locationId);
  }
}
