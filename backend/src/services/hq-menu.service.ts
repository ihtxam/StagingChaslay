import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { CatalogChannel } from "@/lib/catalog-visibility";
import { normalizeMenuCatalogChannels } from "@/lib/catalog-visibility";
import {
  applyMenuProductPrices,
  locationHasDedicatedScheduledMenus,
  normalizeProductPrices,
  normalizeTimeRanges,
  pickActiveScheduledMenu,
  type MenuScheduleType,
} from "@/lib/scheduled-menu";

export type HqMenuRow = typeof schema.hqMenus.$inferSelect;

export type ResolvedHqMenu = {
  menu: HqMenuRow | null;
  productIds: Set<string> | null;
  productPrices: Record<string, number>;
};

const DEFAULT_MENU_CHANNELS = ["pos", "shop", "qr_table", "kiosk"];

function stringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((x) => String(x || "").trim()).filter(Boolean);
}

function readMenuSelection(input: {
  productIds?: unknown;
  product_ids?: unknown;
  categoryIds?: unknown;
  category_ids?: unknown;
}) {
  return {
    productIds: stringArray(input.productIds ?? input.product_ids),
    categoryIds: stringArray(input.categoryIds ?? input.category_ids),
  };
}

function menuHasExplicitCatalogSelection(menu: {
  productIds?: unknown;
  categoryIds?: unknown;
  hqVersionId?: string | null;
}): boolean {
  return (
    stringArray(menu.productIds).length > 0 ||
    stringArray(menu.categoryIds).length > 0 ||
    !!menu.hqVersionId
  );
}

async function resolveMenuProductIds(
  merchantId: string,
  menu: { productIds?: unknown; categoryIds?: unknown; hqVersionId?: string | null }
): Promise<Set<string> | null> {
  const db = getDb();
  const explicit = stringArray(menu.productIds);
  const categoryIds = stringArray(menu.categoryIds);
  const ids = new Set<string>(explicit);

  if (categoryIds.length) {
    const rows = await db.query.products.findMany({
      where: and(
        eq(schema.products.merchantId, merchantId),
        inArray(schema.products.categoryId, categoryIds)
      ),
      columns: { id: true },
    });
    for (const row of rows) {
      if (row.id) ids.add(row.id);
    }
  }

  if (explicit.length) return ids;

  if (ids.size) return ids;

  if (menu.hqVersionId) {
    const version = await db.query.hqCatalogVersions.findFirst({
      where: and(
        eq(schema.hqCatalogVersions.id, menu.hqVersionId),
        eq(schema.hqCatalogVersions.merchantId, merchantId)
      ),
    });
    const payload = (version?.payloadJson || {}) as { products?: Array<{ id: string }> };
    const versionIds = (payload.products || []).map((p) => p.id).filter(Boolean);
    if (versionIds.length) return new Set(versionIds);
    // Snapshot exists but has no products — do not hide the whole branch menu.
  }

  if (categoryIds.length) return null;

  return null;
}

function menuWritePayload(input: Record<string, unknown>) {
  const selection = readMenuSelection(input);
  const scheduleType = String(input.scheduleType || input.schedule_type || "weekly").trim() as MenuScheduleType;
  const timeRanges = normalizeTimeRanges(
    input.timeRanges ?? input.time_ranges,
    String(input.timeStart || input.time_start || "00:00"),
    String(input.timeEnd || input.time_end || "23:59")
  );
  const firstRange = timeRanges[0];
  const channelsRaw = input.channels;
  const channels = normalizeMenuCatalogChannels(
    Array.isArray(channelsRaw) && channelsRaw.length ? channelsRaw : DEFAULT_MENU_CHANNELS
  );
  return {
    name: input.name != null ? String(input.name).trim() : undefined,
    channels,
    daysOfWeek: input.daysOfWeek ?? input.days_of_week,
    daysOfMonth: input.daysOfMonth ?? input.days_of_month,
    scheduleType: ["daily", "weekly", "monthly"].includes(scheduleType) ? scheduleType : "weekly",
    timeRanges,
    timeStart: firstRange?.start || "00:00",
    timeEnd: firstRange?.end || "23:59",
    locationIds: input.locationIds ?? input.location_ids,
    hqVersionId: input.hqVersionId ?? input.hq_version_id,
    productIds: selection.productIds,
    categoryIds: selection.categoryIds,
    productPrices: normalizeProductPrices(input.productPrices ?? input.product_prices),
    isDefault: input.isDefault === true || input.is_default === true,
    isActive: input.isActive ?? input.is_active,
    sortOrder: input.sortOrder ?? input.sort_order,
  };
}

export class HqMenuService {
  static async list(merchantId: string) {
    const db = getDb();
    await this.ensureDefaultMenu(merchantId);
    return db.query.hqMenus.findMany({
      where: eq(schema.hqMenus.merchantId, merchantId),
      orderBy: [asc(schema.hqMenus.sortOrder), asc(schema.hqMenus.name)],
    });
  }

  static async ensureDefaultMenu(merchantId: string) {
    const db = getDb();
    const existing = await db.query.hqMenus.findFirst({
      where: and(eq(schema.hqMenus.merchantId, merchantId), eq(schema.hqMenus.isDefault, true)),
    });
    if (existing) return existing;

    const [row] = await db
      .insert(schema.hqMenus)
      .values({
        merchantId,
        name: "Default menu",
        isDefault: true,
        scheduleType: "daily",
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        daysOfMonth: [],
        timeRanges: [{ start: "00:00", end: "23:59" }],
        timeStart: "00:00",
        timeEnd: "23:59",
        channels: [...DEFAULT_MENU_CHANNELS],
        locationIds: [],
        productIds: [],
        categoryIds: [],
        productPrices: {},
        isActive: true,
        sortOrder: -1,
      })
      .returning();
    return row;
  }

  static async create(merchantId: string, input: Record<string, unknown>) {
    const db = getDb();
    const parsed = menuWritePayload(input);
    const name = parsed.name || "";
    if (!name) throw new Error("Menu name is required");
    if (parsed.isDefault) {
      throw new Error("Cannot create another default menu — edit the existing default menu");
    }

    const [row] = await db
      .insert(schema.hqMenus)
      .values({
        merchantId,
        name,
        channels: parsed.channels,
        daysOfWeek: Array.isArray(parsed.daysOfWeek) && parsed.daysOfWeek.length
          ? parsed.daysOfWeek
          : [0, 1, 2, 3, 4, 5, 6],
        daysOfMonth: Array.isArray(parsed.daysOfMonth) ? parsed.daysOfMonth : [],
        scheduleType: parsed.scheduleType,
        timeRanges: parsed.timeRanges,
        timeStart: parsed.timeStart,
        timeEnd: parsed.timeEnd,
        locationIds: Array.isArray(parsed.locationIds) ? parsed.locationIds : [],
        hqVersionId: (parsed.hqVersionId as string | null) || null,
        productIds: parsed.productIds,
        categoryIds: parsed.categoryIds,
        productPrices: parsed.productPrices,
        isDefault: false,
        isActive: parsed.isActive !== false,
        sortOrder: Number(parsed.sortOrder) || 0,
      })
      .returning();
    return row;
  }

  static async update(merchantId: string, menuId: string, input: Record<string, unknown>) {
    const db = getDb();
    const existing = await db.query.hqMenus.findFirst({
      where: and(eq(schema.hqMenus.id, menuId), eq(schema.hqMenus.merchantId, merchantId)),
    });
    if (!existing) throw new Error("HQ menu not found");

    const parsed = menuWritePayload({ ...existing, ...input });
    const patch: Record<string, unknown> = { updatedAt: new Date() };

    if (input.name !== undefined) patch.name = parsed.name;
    if (input.channels !== undefined) patch.channels = parsed.channels;
    if (input.daysOfWeek !== undefined || input.days_of_week !== undefined) {
      patch.daysOfWeek = parsed.daysOfWeek;
    }
    if (input.daysOfMonth !== undefined || input.days_of_month !== undefined) {
      patch.daysOfMonth = parsed.daysOfMonth;
    }
    if (
      input.scheduleType !== undefined ||
      input.schedule_type !== undefined ||
      input.timeRanges !== undefined ||
      input.time_ranges !== undefined ||
      input.timeStart !== undefined ||
      input.timeEnd !== undefined
    ) {
      patch.scheduleType = parsed.scheduleType;
      patch.timeRanges = parsed.timeRanges;
      patch.timeStart = parsed.timeStart;
      patch.timeEnd = parsed.timeEnd;
    }
    if (input.locationIds !== undefined || input.location_ids !== undefined) {
      patch.locationIds = parsed.locationIds;
    }
    if (input.hqVersionId !== undefined || input.hq_version_id !== undefined) {
      patch.hqVersionId = parsed.hqVersionId;
    }
    if (
      input.productIds !== undefined ||
      input.product_ids !== undefined ||
      input.categoryIds !== undefined ||
      input.category_ids !== undefined
    ) {
      patch.productIds = parsed.productIds;
      patch.categoryIds = parsed.categoryIds;
    }
    if (input.productPrices !== undefined || input.product_prices !== undefined) {
      patch.productPrices = parsed.productPrices;
    }
    if (input.isActive !== undefined || input.is_active !== undefined) {
      patch.isActive = parsed.isActive;
    }
    if (input.sortOrder !== undefined || input.sort_order !== undefined) {
      patch.sortOrder = parsed.sortOrder;
    }
    if (input.isDefault === true && !existing.isDefault) {
      throw new Error("Cannot promote a menu to default — edit the default menu instead");
    }

    const [row] = await db
      .update(schema.hqMenus)
      .set(patch as typeof schema.hqMenus.$inferInsert)
      .where(eq(schema.hqMenus.id, menuId))
      .returning();
    return row;
  }

  static async remove(merchantId: string, menuId: string) {
    const db = getDb();
    const existing = await db.query.hqMenus.findFirst({
      where: and(eq(schema.hqMenus.id, menuId), eq(schema.hqMenus.merchantId, merchantId)),
    });
    if (!existing) throw new Error("HQ menu not found");
    if (existing.isDefault) throw new Error("The default menu cannot be deleted");

    await db
      .delete(schema.hqMenus)
      .where(and(eq(schema.hqMenus.id, menuId), eq(schema.hqMenus.merchantId, merchantId)));
    return { success: true };
  }

  /**
   * After HQ catalog push, ensure the location has an active POS menu bound to the snapshot.
   */
  static async ensureLocationPushMenu(
    merchantId: string,
    locationId: string,
    hqVersionId: string
  ) {
    const db = getDb();
    const loc = String(locationId || "").trim();
    const versionId = String(hqVersionId || "").trim();
    if (!loc || !versionId) return;

    const menus = await db.query.hqMenus.findMany({
      where: eq(schema.hqMenus.merchantId, merchantId),
    });

    const assigned = menus.filter((m) => {
      if (m.isDefault || m.isActive === false) return false;
      const locIds = Array.isArray(m.locationIds) ? m.locationIds : [];
      return locIds.includes(loc);
    });

    const target =
      assigned.find((m) => m.hqVersionId === versionId) ||
      assigned.find((m) => !!m.hqVersionId) ||
      assigned[0];

    const version = await db.query.hqCatalogVersions.findFirst({
      where: and(
        eq(schema.hqCatalogVersions.id, versionId),
        eq(schema.hqCatalogVersions.merchantId, merchantId)
      ),
    });
    const versionPayload = (version?.payloadJson || {}) as {
      products?: Array<{ id: string }>;
      categories?: Array<{ id: string }>;
    };
    const versionProductIds = (versionPayload.products || []).map((p) => p.id).filter(Boolean);
    const versionCategoryIds = (versionPayload.categories || [])
      .map((c) => String(c.id || "").trim())
      .filter(Boolean);

    const menuPatch = {
      hqVersionId: versionId,
      productIds: versionProductIds,
      categoryIds: versionCategoryIds,
      channels: [...DEFAULT_MENU_CHANNELS],
      scheduleType: "daily" as const,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      daysOfMonth: [] as number[],
      timeRanges: [{ start: "00:00", end: "23:59" }],
      timeStart: "00:00",
      timeEnd: "23:59",
      isActive: true,
      updatedAt: new Date(),
    };

    if (target) {
      await db
        .update(schema.hqMenus)
        .set(menuPatch)
        .where(eq(schema.hqMenus.id, target.id));
      return;
    }

    const [maxSort] = await db
      .select({ max: sql<number>`coalesce(max(${schema.hqMenus.sortOrder}), 0)` })
      .from(schema.hqMenus)
      .where(eq(schema.hqMenus.merchantId, merchantId));

    await db.insert(schema.hqMenus).values({
      merchantId,
      name: "Location catalog",
      channels: [...DEFAULT_MENU_CHANNELS],
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      daysOfMonth: [],
      scheduleType: "daily",
      timeRanges: [{ start: "00:00", end: "23:59" }],
      timeStart: "00:00",
      timeEnd: "23:59",
      locationIds: [loc],
      hqVersionId: versionId,
      productIds: versionProductIds,
      categoryIds: versionCategoryIds,
      productPrices: {},
      isDefault: false,
      isActive: true,
      sortOrder: Number(maxSort?.max || 0) + 10,
    });
  }

  static async resolveActiveMenu(
    merchantId: string,
    locationId: string,
    channel: CatalogChannel,
    at: Date = new Date(),
    timezone = "Europe/Zurich",
    opts?: { terminalIsolation?: boolean }
  ): Promise<ResolvedHqMenu> {
    const db = getDb();
    await this.ensureDefaultMenu(merchantId);
    const menus = await db.query.hqMenus.findMany({
      where: and(eq(schema.hqMenus.merchantId, merchantId), eq(schema.hqMenus.isActive, true)),
      orderBy: [asc(schema.hqMenus.sortOrder)],
    });

    const terminalIsolation = opts?.terminalIsolation === true;
    const picked = pickActiveScheduledMenu(menus, {
      channel,
      locationId,
      at,
      timezone,
      terminalIsolation,
    });
    if (!picked) {
      const strictEmpty = locationHasDedicatedScheduledMenus(menus, locationId);
      if (strictEmpty) {
        const linkRows = await db.query.locationCatalogLinks.findMany({
          where: and(
            eq(schema.locationCatalogLinks.merchantId, merchantId),
            eq(schema.locationCatalogLinks.locationId, locationId)
          ),
          columns: { localProductId: true, hqProductId: true },
        });
        const hasBranchCatalogLinks = linkRows.some(
          (l) => String(l.localProductId || l.hqProductId || "").trim()
        );
        return {
          menu: null,
          productIds: hasBranchCatalogLinks ? null : new Set<string>(),
          productPrices: {},
        };
      }
      return {
        menu: null,
        productIds: null,
        productPrices: {},
      };
    }

    let productIds = await resolveMenuProductIds(merchantId, picked);
    if (
      productIds === null &&
      terminalIsolation &&
      menuHasExplicitCatalogSelection(picked)
    ) {
      productIds = new Set<string>();
    }
    if (productIds !== null && productIds.size === 0) {
      productIds = null;
    }
    const productPrices = normalizeProductPrices(picked.productPrices);
    return { menu: picked, productIds, productPrices };
  }

  static async resolveActiveProductIds(
    merchantId: string,
    locationId: string,
    channel: CatalogChannel,
    at: Date = new Date(),
    timezone = "Europe/Zurich"
  ): Promise<Set<string> | null> {
    const resolved = await this.resolveActiveMenu(merchantId, locationId, channel, at, timezone);
    return resolved.productIds;
  }

  static applyMenuPrices<
    T extends { id: string; price: number | string; isOpenPrice?: boolean | null } & Record<string, unknown>,
  >(products: T[], menuPrices: Record<string, number> | null | undefined): T[] {
    return applyMenuProductPrices(products, menuPrices);
  }
}
