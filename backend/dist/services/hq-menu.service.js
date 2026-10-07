"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HqMenuService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const catalog_visibility_1 = require("@/lib/catalog-visibility");
const scheduled_menu_1 = require("@/lib/scheduled-menu");
const DEFAULT_MENU_CHANNELS = ["pos", "shop", "qr_table", "kiosk"];
function stringArray(input) {
    if (!Array.isArray(input))
        return [];
    return input.map((x) => String(x || "").trim()).filter(Boolean);
}
function readMenuSelection(input) {
    return {
        productIds: stringArray(input.productIds ?? input.product_ids),
        categoryIds: stringArray(input.categoryIds ?? input.category_ids),
    };
}
async function resolveMenuProductIds(merchantId, menu) {
    const db = (0, db_1.getDb)();
    const explicit = stringArray(menu.productIds);
    const categoryIds = stringArray(menu.categoryIds);
    const ids = new Set(explicit);
    if (categoryIds.length) {
        const rows = await db.query.products.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.products.categoryId, categoryIds)),
            columns: { id: true },
        });
        for (const row of rows) {
            if (row.id)
                ids.add(row.id);
        }
    }
    if (ids.size)
        return ids;
    if (menu.hqVersionId) {
        const version = await db.query.hqCatalogVersions.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.hqCatalogVersions.id, menu.hqVersionId), (0, drizzle_orm_1.eq)(db_1.schema.hqCatalogVersions.merchantId, merchantId)),
        });
        const payload = (version?.payloadJson || {});
        const versionIds = (payload.products || []).map((p) => p.id).filter(Boolean);
        if (versionIds.length)
            return new Set(versionIds);
    }
    if (explicit.length || categoryIds.length)
        return ids;
    return null;
}
function menuWritePayload(input) {
    const selection = readMenuSelection(input);
    const scheduleType = String(input.scheduleType || input.schedule_type || "weekly").trim();
    const timeRanges = (0, scheduled_menu_1.normalizeTimeRanges)(input.timeRanges ?? input.time_ranges, String(input.timeStart || input.time_start || "00:00"), String(input.timeEnd || input.time_end || "23:59"));
    const firstRange = timeRanges[0];
    const channelsRaw = input.channels;
    const channels = (0, catalog_visibility_1.normalizeMenuCatalogChannels)(Array.isArray(channelsRaw) && channelsRaw.length ? channelsRaw : DEFAULT_MENU_CHANNELS);
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
        productPrices: (0, scheduled_menu_1.normalizeProductPrices)(input.productPrices ?? input.product_prices),
        isDefault: input.isDefault === true || input.is_default === true,
        isActive: input.isActive ?? input.is_active,
        sortOrder: input.sortOrder ?? input.sort_order,
    };
}
class HqMenuService {
    static async list(merchantId) {
        const db = (0, db_1.getDb)();
        await this.ensureDefaultMenu(merchantId);
        return db.query.hqMenus.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.hqMenus.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.hqMenus.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.hqMenus.name)],
        });
    }
    static async ensureDefaultMenu(merchantId) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.hqMenus.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.hqMenus.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.hqMenus.isDefault, true)),
        });
        if (existing)
            return existing;
        const [row] = await db
            .insert(db_1.schema.hqMenus)
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
    static async create(merchantId, input) {
        const db = (0, db_1.getDb)();
        const parsed = menuWritePayload(input);
        const name = parsed.name || "";
        if (!name)
            throw new Error("Menu name is required");
        if (parsed.isDefault) {
            throw new Error("Cannot create another default menu — edit the existing default menu");
        }
        const [row] = await db
            .insert(db_1.schema.hqMenus)
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
            hqVersionId: parsed.hqVersionId || null,
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
    static async update(merchantId, menuId, input) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.hqMenus.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.hqMenus.id, menuId), (0, drizzle_orm_1.eq)(db_1.schema.hqMenus.merchantId, merchantId)),
        });
        if (!existing)
            throw new Error("HQ menu not found");
        const parsed = menuWritePayload({ ...existing, ...input });
        const patch = { updatedAt: new Date() };
        if (input.name !== undefined)
            patch.name = parsed.name;
        if (input.channels !== undefined)
            patch.channels = parsed.channels;
        if (input.daysOfWeek !== undefined || input.days_of_week !== undefined) {
            patch.daysOfWeek = parsed.daysOfWeek;
        }
        if (input.daysOfMonth !== undefined || input.days_of_month !== undefined) {
            patch.daysOfMonth = parsed.daysOfMonth;
        }
        if (input.scheduleType !== undefined ||
            input.schedule_type !== undefined ||
            input.timeRanges !== undefined ||
            input.time_ranges !== undefined ||
            input.timeStart !== undefined ||
            input.timeEnd !== undefined) {
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
        if (input.productIds !== undefined ||
            input.product_ids !== undefined ||
            input.categoryIds !== undefined ||
            input.category_ids !== undefined) {
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
            .update(db_1.schema.hqMenus)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.hqMenus.id, menuId))
            .returning();
        return row;
    }
    static async remove(merchantId, menuId) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.hqMenus.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.hqMenus.id, menuId), (0, drizzle_orm_1.eq)(db_1.schema.hqMenus.merchantId, merchantId)),
        });
        if (!existing)
            throw new Error("HQ menu not found");
        if (existing.isDefault)
            throw new Error("The default menu cannot be deleted");
        await db
            .delete(db_1.schema.hqMenus)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.hqMenus.id, menuId), (0, drizzle_orm_1.eq)(db_1.schema.hqMenus.merchantId, merchantId)));
        return { success: true };
    }
    static async resolveActiveMenu(merchantId, locationId, channel, at = new Date(), timezone = "Europe/Zurich") {
        const db = (0, db_1.getDb)();
        await this.ensureDefaultMenu(merchantId);
        const menus = await db.query.hqMenus.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.hqMenus.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.hqMenus.isActive, true)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.hqMenus.sortOrder)],
        });
        const picked = (0, scheduled_menu_1.pickActiveScheduledMenu)(menus, {
            channel,
            locationId,
            at,
            timezone,
        });
        if (!picked) {
            return { menu: null, productIds: null, productPrices: {} };
        }
        const productIds = await resolveMenuProductIds(merchantId, picked);
        const productPrices = (0, scheduled_menu_1.normalizeProductPrices)(picked.productPrices);
        return { menu: picked, productIds, productPrices };
    }
    static async resolveActiveProductIds(merchantId, locationId, channel, at = new Date(), timezone = "Europe/Zurich") {
        const resolved = await this.resolveActiveMenu(merchantId, locationId, channel, at, timezone);
        return resolved.productIds;
    }
    static applyMenuPrices(products, menuPrices) {
        return (0, scheduled_menu_1.applyMenuProductPrices)(products, menuPrices);
    }
}
exports.HqMenuService = HqMenuService;
//# sourceMappingURL=hq-menu.service.js.map