"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HqMenuService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
function parseHm(time) {
    const [h, m] = String(time || "00:00").split(":").map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}
function inTimeWindow(now, daysOfWeek, timeStart, timeEnd, timezone = "Europe/Zurich") {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: timezone,
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === "weekday")?.value || "";
    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = dayMap[weekday] ?? now.getDay();
    if (!daysOfWeek.includes(dow))
        return false;
    const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
    const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
    const cur = hour * 60 + minute;
    const start = parseHm(timeStart);
    const end = parseHm(timeEnd);
    if (start <= end)
        return cur >= start && cur <= end;
    return cur >= start || cur <= end;
}
class HqMenuService {
    static async list(merchantId) {
        const db = (0, db_1.getDb)();
        return db.query.hqMenus.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.hqMenus.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.hqMenus.sortOrder), (0, drizzle_orm_1.asc)(db_1.schema.hqMenus.name)],
        });
    }
    static async create(merchantId, input) {
        const db = (0, db_1.getDb)();
        const name = String(input.name || "").trim();
        if (!name)
            throw new Error("Menu name is required");
        const [row] = await db
            .insert(db_1.schema.hqMenus)
            .values({
            merchantId,
            name,
            channels: input.channels?.length ? input.channels : ["pos", "shop", "qr_table", "delivery", "kiosk"],
            daysOfWeek: input.daysOfWeek?.length ? input.daysOfWeek : [0, 1, 2, 3, 4, 5, 6],
            timeStart: input.timeStart || "00:00",
            timeEnd: input.timeEnd || "23:59",
            locationIds: input.locationIds || [],
            hqVersionId: input.hqVersionId || null,
            productIds: input.productIds || [],
            isActive: input.isActive !== false,
            sortOrder: Number(input.sortOrder) || 0,
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
        const patch = { updatedAt: new Date() };
        if (input.name !== undefined)
            patch.name = String(input.name).trim();
        if (input.channels !== undefined)
            patch.channels = input.channels;
        if (input.daysOfWeek !== undefined)
            patch.daysOfWeek = input.daysOfWeek;
        if (input.timeStart !== undefined)
            patch.timeStart = input.timeStart;
        if (input.timeEnd !== undefined)
            patch.timeEnd = input.timeEnd;
        if (input.locationIds !== undefined)
            patch.locationIds = input.locationIds;
        if (input.hqVersionId !== undefined)
            patch.hqVersionId = input.hqVersionId;
        if (input.productIds !== undefined)
            patch.productIds = input.productIds;
        if (input.isActive !== undefined)
            patch.isActive = input.isActive;
        if (input.sortOrder !== undefined)
            patch.sortOrder = input.sortOrder;
        const [row] = await db
            .update(db_1.schema.hqMenus)
            .set(patch)
            .where((0, drizzle_orm_1.eq)(db_1.schema.hqMenus.id, menuId))
            .returning();
        return row;
    }
    static async remove(merchantId, menuId) {
        const db = (0, db_1.getDb)();
        await db
            .delete(db_1.schema.hqMenus)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.hqMenus.id, menuId), (0, drizzle_orm_1.eq)(db_1.schema.hqMenus.merchantId, merchantId)));
        return { success: true };
    }
    /**
     * Resolve product IDs for the active HQ menu at a location/channel/time.
     * Returns null when no menu applies (show full catalog).
     */
    static async resolveActiveProductIds(merchantId, locationId, channel, at = new Date()) {
        const db = (0, db_1.getDb)();
        const menus = await db.query.hqMenus.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.hqMenus.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.hqMenus.isActive, true)),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.hqMenus.sortOrder)],
        });
        for (const menu of menus) {
            const channels = Array.isArray(menu.channels) ? menu.channels : [];
            if (channels.length && !channels.includes(channel))
                continue;
            const locIds = Array.isArray(menu.locationIds) ? menu.locationIds : [];
            if (locIds.length && !locIds.includes(locationId))
                continue;
            const days = Array.isArray(menu.daysOfWeek) ? menu.daysOfWeek : [0, 1, 2, 3, 4, 5, 6];
            if (!inTimeWindow(at, days, menu.timeStart, menu.timeEnd))
                continue;
            const explicit = Array.isArray(menu.productIds) ? menu.productIds.filter(Boolean) : [];
            if (explicit.length)
                return new Set(explicit);
            if (menu.hqVersionId) {
                const version = await db.query.hqCatalogVersions.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.hqCatalogVersions.id, menu.hqVersionId), (0, drizzle_orm_1.eq)(db_1.schema.hqCatalogVersions.merchantId, merchantId)),
                });
                const payload = (version?.payloadJson || {});
                const ids = (payload.products || []).map((p) => p.id).filter(Boolean);
                if (ids.length)
                    return new Set(ids);
            }
        }
        return null;
    }
}
exports.HqMenuService = HqMenuService;
//# sourceMappingURL=hq-menu.service.js.map