"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdsService = exports.OdsLicenseError = exports.ODS_THEMES = void 0;
const crypto_1 = require("crypto");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const ods_addon_1 = require("@/lib/ods-addon");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
exports.ODS_THEMES = ["light", "teal", "dark"];
class OdsLicenseError extends Error {
    constructor() {
        super("Order display (ODS) addon is not enabled for this merchant");
        this.code = "ODS_ADDON_REQUIRED";
    }
}
exports.OdsLicenseError = OdsLicenseError;
const READY_RETENTION_MS = 2 * 60 * 60 * 1000;
const PREPARING_RETENTION_MS = 24 * 60 * 60 * 1000;
function newToken() {
    return (0, crypto_1.randomBytes)(24).toString("hex");
}
function normalizeTheme(value) {
    const t = String(value || "light").toLowerCase();
    return exports.ODS_THEMES.includes(t) ? t : "light";
}
function normalizeOrderNumber(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "")
        .slice(0, 64);
}
async function requireAddon(merchantId) {
    await (0, ensure_merchant_schema_1.ensureOdsAddonColumn)();
    const enabled = await (0, ods_addon_1.readOdsAddonEnabled)(merchantId);
    if (!enabled)
        throw new OdsLicenseError();
}
async function purgeStale(merchantId) {
    const db = (0, db_1.getDb)();
    const now = Date.now();
    await db
        .delete(db_1.schema.odsOrders)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsOrders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.odsOrders.status, "ready"), (0, drizzle_orm_1.lt)(db_1.schema.odsOrders.readyAt, new Date(now - READY_RETENTION_MS))));
    await db
        .delete(db_1.schema.odsOrders)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsOrders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.odsOrders.status, "preparing"), (0, drizzle_orm_1.lt)(db_1.schema.odsOrders.updatedAt, new Date(now - PREPARING_RETENTION_MS))));
}
class OdsService {
    static async listDisplays(merchantId) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        return db.query.odsDisplays.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.odsDisplays.name)],
        });
    }
    static async createDisplay(merchantId, input) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const name = String(input.name || "").trim().slice(0, 255);
        if (!name)
            throw new Error("Display name is required");
        const [row] = await db
            .insert(db_1.schema.odsDisplays)
            .values({
            merchantId,
            name,
            token: newToken(),
            theme: normalizeTheme(input.theme),
            isActive: input.isActive !== false,
        })
            .returning();
        return row;
    }
    static async updateDisplay(merchantId, id, input) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const patch = { updatedAt: new Date() };
        if (input.name != null)
            patch.name = String(input.name).trim().slice(0, 255);
        if (input.theme != null)
            patch.theme = normalizeTheme(input.theme);
        if (input.isActive != null)
            patch.isActive = !!input.isActive;
        const [row] = await db
            .update(db_1.schema.odsDisplays)
            .set(patch)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.id, id), (0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.merchantId, merchantId)))
            .returning();
        if (!row)
            throw new Error("ODS display not found");
        return row;
    }
    static async deleteDisplay(merchantId, id) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        await db
            .delete(db_1.schema.odsDisplays)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.id, id), (0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.merchantId, merchantId)));
        return { ok: true };
    }
    static async rotateToken(merchantId, id) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const [row] = await db
            .update(db_1.schema.odsDisplays)
            .set({ token: newToken(), updatedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.id, id), (0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.merchantId, merchantId)))
            .returning();
        if (!row)
            throw new Error("ODS display not found");
        return row;
    }
    static async displayByToken(token) {
        const db = (0, db_1.getDb)();
        return db.query.odsDisplays.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.token, token), (0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.isActive, true)),
        });
    }
    /** Push or update an order on the customer board (POS / KDS integration). */
    static async pushOrder(merchantId, payload) {
        const orderNumber = normalizeOrderNumber(payload.orderNumber);
        if (!orderNumber)
            throw new Error("orderNumber is required");
        const status = payload.status === "ready" ? "ready" : "preparing";
        let enabled = false;
        try {
            enabled = await (0, ods_addon_1.readOdsAddonEnabled)(merchantId);
        }
        catch {
            return { ok: false, skipped: true };
        }
        if (!enabled)
            return { ok: false, skipped: true };
        const db = (0, db_1.getDb)();
        await purgeStale(merchantId);
        const existing = await db.query.odsOrders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsOrders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.odsOrders.orderNumber, orderNumber)),
        });
        const now = new Date();
        if (existing) {
            await db
                .update(db_1.schema.odsOrders)
                .set({
                status,
                readyAt: status === "ready" ? now : null,
                updatedAt: now,
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.odsOrders.id, existing.id));
        }
        else {
            await db.insert(db_1.schema.odsOrders).values({
                merchantId,
                orderNumber,
                status,
                readyAt: status === "ready" ? now : null,
            });
        }
        return { ok: true, orderNumber, status };
    }
    static async dismissOrder(merchantId, orderNumber) {
        await requireAddon(merchantId);
        const num = normalizeOrderNumber(orderNumber);
        if (!num)
            throw new Error("orderNumber is required");
        const db = (0, db_1.getDb)();
        await db
            .delete(db_1.schema.odsOrders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsOrders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.odsOrders.orderNumber, num)));
        return { ok: true };
    }
    static async boardForToken(token) {
        const display = await this.displayByToken(token);
        if (!display)
            throw new Error("Invalid ODS link");
        const enabled = await (0, ods_addon_1.readOdsAddonEnabled)(display.merchantId).catch(() => false);
        if (!enabled)
            throw new OdsLicenseError();
        await purgeStale(display.merchantId);
        const db = (0, db_1.getDb)();
        const preparingRows = await db.query.odsOrders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsOrders.merchantId, display.merchantId), (0, drizzle_orm_1.eq)(db_1.schema.odsOrders.status, "preparing")),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.odsOrders.createdAt)],
        });
        const readyRows = await db.query.odsOrders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsOrders.merchantId, display.merchantId), (0, drizzle_orm_1.eq)(db_1.schema.odsOrders.status, "ready")),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.odsOrders.readyAt), (0, drizzle_orm_1.desc)(db_1.schema.odsOrders.updatedAt)],
        });
        return {
            display: {
                id: display.id,
                name: display.name,
                theme: display.theme,
            },
            serverTime: new Date().toISOString(),
            preparing: preparingRows.map((r) => r.orderNumber),
            ready: readyRows.map((r) => r.orderNumber),
        };
    }
}
exports.OdsService = OdsService;
//# sourceMappingURL=ods.service.js.map