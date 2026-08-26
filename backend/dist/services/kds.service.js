"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KdsService = exports.KdsLicenseError = void 0;
const crypto_1 = require("crypto");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const kds_addon_1 = require("@/lib/kds-addon");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const display_short_code_1 = require("@/lib/display-short-code");
const guest_order_number_1 = require("@/lib/guest-order-number");
class KdsLicenseError extends Error {
    constructor() {
        super("Kitchen display (KDS) addon is not enabled for this merchant");
        this.code = "KDS_ADDON_REQUIRED";
    }
}
exports.KdsLicenseError = KdsLicenseError;
async function requireAddon(merchantId) {
    await (0, ensure_merchant_schema_1.ensureKdsAddonColumn)();
    const enabled = await (0, kds_addon_1.readKdsAddonEnabled)(merchantId);
    if (!enabled)
        throw new KdsLicenseError();
}
function resolveKdsOdsNumber(ticket) {
    return ((0, guest_order_number_1.resolveOdsPushNumber)(ticket.ticketKey) ||
        (0, guest_order_number_1.resolveOdsPushNumber)(ticket.orderNumber) ||
        "");
}
async function maybePushOdsReady(merchantId, ticket) {
    const orderNumber = resolveKdsOdsNumber(ticket);
    if (!orderNumber)
        return;
    try {
        const { OdsService } = await Promise.resolve().then(() => __importStar(require("@/services/ods.service")));
        await OdsService.pushOrder(merchantId, { orderNumber, status: "ready" });
    }
    catch {
        /* ODS optional */
    }
}
async function maybePushOdsPreparing(merchantId, ticket) {
    const orderNumber = resolveKdsOdsNumber(ticket);
    if (!orderNumber)
        return;
    try {
        const { OdsService } = await Promise.resolve().then(() => __importStar(require("@/services/ods.service")));
        await OdsService.pushOrder(merchantId, { orderNumber, status: "preparing" });
    }
    catch {
        /* ODS optional */
    }
}
const KDS_THEMES = new Set(["dark", "light", "teal"]);
const KDS_LAYOUT_MODES = new Set(["grid", "rows", "slider"]);
function normalizeKdsTheme(value) {
    const t = String(value || "dark").toLowerCase();
    return KDS_THEMES.has(t) ? t : "dark";
}
function normalizeKdsLayoutMode(value) {
    const m = String(value || "grid").toLowerCase();
    return KDS_LAYOUT_MODES.has(m) ? m : "grid";
}
function clampGridColumns(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n))
        return 3;
    return Math.min(6, Math.max(1, n));
}
function clampOverdueMinutes(value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n))
        return 20;
    return Math.min(120, Math.max(5, n));
}
function newToken() {
    return (0, crypto_1.randomBytes)(24).toString("hex");
}
function itemMatchesStation(item, station, channel) {
    const types = station.orderTypes || [];
    if (types.length && channel && !types.includes(String(channel)))
        return false;
    const cats = station.categoryIds || [];
    const prods = station.productIds || [];
    if (!cats.length && !prods.length)
        return true;
    if (item.productId && prods.includes(item.productId))
        return true;
    if (item.categoryId && cats.includes(item.categoryId))
        return true;
    return false;
}
const COMPLETED_RETENTION_MS = 24 * 60 * 60 * 1000;
class KdsService {
    static async listStations(merchantId) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        await (0, display_short_code_1.ensureKdsStationShortCodes)(db, merchantId);
        return db.query.kdsStations.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.kdsStations.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.kdsStations.name)],
        });
    }
    static async createStation(merchantId, input) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const name = String(input.name || "").trim().slice(0, 255);
        if (!name)
            throw new Error("Station name is required");
        const [row] = await db
            .insert(db_1.schema.kdsStations)
            .values({
            merchantId,
            name,
            token: newToken(),
            shortCode: await (0, display_short_code_1.allocateDisplayShortCode)(db),
            orderTypes: input.orderTypes || [],
            categoryIds: input.categoryIds || [],
            productIds: input.productIds || [],
            theme: normalizeKdsTheme(input.theme),
            layoutMode: normalizeKdsLayoutMode(input.layoutMode),
            gridColumns: clampGridColumns(input.gridColumns),
            overdueMinutes: clampOverdueMinutes(input.overdueMinutes),
            isActive: input.isActive !== false,
        })
            .returning();
        return row;
    }
    static async updateStation(merchantId, id, input) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const patch = { updatedAt: new Date() };
        if (input.name != null)
            patch.name = String(input.name).trim().slice(0, 255);
        if (input.orderTypes != null)
            patch.orderTypes = input.orderTypes;
        if (input.categoryIds != null)
            patch.categoryIds = input.categoryIds;
        if (input.productIds != null)
            patch.productIds = input.productIds;
        if (input.theme != null)
            patch.theme = normalizeKdsTheme(input.theme);
        if (input.layoutMode != null)
            patch.layoutMode = normalizeKdsLayoutMode(input.layoutMode);
        if (input.gridColumns != null)
            patch.gridColumns = clampGridColumns(input.gridColumns);
        if (input.overdueMinutes != null)
            patch.overdueMinutes = clampOverdueMinutes(input.overdueMinutes);
        if (input.isActive != null)
            patch.isActive = !!input.isActive;
        const [row] = await db
            .update(db_1.schema.kdsStations)
            .set(patch)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsStations.id, id), (0, drizzle_orm_1.eq)(db_1.schema.kdsStations.merchantId, merchantId)))
            .returning();
        if (!row)
            throw new Error("KDS station not found");
        return row;
    }
    static async deleteStation(merchantId, id) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        await db
            .delete(db_1.schema.kdsStations)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsStations.id, id), (0, drizzle_orm_1.eq)(db_1.schema.kdsStations.merchantId, merchantId)));
        return { ok: true };
    }
    static async rotateToken(merchantId, id) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const [row] = await db
            .update(db_1.schema.kdsStations)
            .set({
            token: newToken(),
            shortCode: await (0, display_short_code_1.allocateDisplayShortCode)(db),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsStations.id, id), (0, drizzle_orm_1.eq)(db_1.schema.kdsStations.merchantId, merchantId)))
            .returning();
        if (!row)
            throw new Error("KDS station not found");
        return row;
    }
    static async stationByToken(accessKey) {
        const trimmed = String(accessKey || "").trim();
        if (!trimmed)
            return null;
        const db = (0, db_1.getDb)();
        return db.query.kdsStations.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_1.schema.kdsStations.shortCode, trimmed), (0, drizzle_orm_1.eq)(db_1.schema.kdsStations.token, trimmed)), (0, drizzle_orm_1.eq)(db_1.schema.kdsStations.isActive, true)),
        });
    }
    /**
     * Push a saved order (online shop / partner) onto the KDS board.
     * POS register tickets use pushKitchen directly from WebPOS "Send to kitchen".
     */
    static async pushOrderToKitchen(merchantId, orderId) {
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
            with: {
                items: {
                    with: { product: { columns: { categoryId: true } } },
                },
            },
        });
        if (!order?.items?.length)
            return { ok: true, added: 0 };
        const { formatWebOrderNumberDisplay } = await Promise.resolve().then(() => __importStar(require("@/lib/web-order-number")));
        const { resolveOrderItemName } = await Promise.resolve().then(() => __importStar(require("@/lib/order-item-name")));
        const displayNum = formatWebOrderNumberDisplay(order.orderNumber || "") ||
            order.orderNumber ||
            order.id;
        const items = order.items.map((i) => ({
            lineId: i.id,
            productId: i.productId || undefined,
            categoryId: i.product?.categoryId || undefined,
            name: resolveOrderItemName(i.productName),
            quantity: String(i.quantity || 1),
            selectedExtras: i.selectedExtras || [],
            comboSelections: i.comboSelections || [],
        }));
        return this.pushKitchen(merchantId, {
            ticketKey: displayNum,
            orderNumber: displayNum,
            tableLabel: order.customerName?.trim()?.slice(0, 120) || null,
            channel: order.fulfillmentChannel || "takeaway",
            items,
        });
    }
    /** Upsert ticket + append new line items when kitchen receives an order. */
    static async pushKitchen(merchantId, payload) {
        await requireAddon(merchantId);
        const ticketKey = String(payload.ticketKey || "").trim().slice(0, 255);
        if (!ticketKey)
            throw new Error("ticketKey is required");
        const items = (payload.items || []).filter((i) => i.lineId && i.name);
        if (!items.length)
            return { ok: true, added: 0 };
        const db = (0, db_1.getDb)();
        let ticket = await db.query.kdsTickets.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.ticketKey, ticketKey), (0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.status, "pending")),
        });
        if (!ticket) {
            const [inserted] = await db
                .insert(db_1.schema.kdsTickets)
                .values({
                merchantId,
                ticketKey,
                orderNumber: payload.orderNumber?.trim()?.slice(0, 64) || null,
                tableLabel: payload.tableLabel?.trim()?.slice(0, 120) || null,
                tabNumber: payload.tabNumber?.trim()?.slice(0, 64) || null,
                channel: payload.channel?.trim()?.slice(0, 50) || null,
                status: "pending",
            })
                .returning();
            ticket = inserted;
        }
        else {
            await db
                .update(db_1.schema.kdsTickets)
                .set({
                orderNumber: payload.orderNumber?.trim()?.slice(0, 64) || ticket.orderNumber,
                tableLabel: payload.tableLabel?.trim()?.slice(0, 120) ?? ticket.tableLabel,
                tabNumber: payload.tabNumber?.trim()?.slice(0, 64) ?? ticket.tabNumber,
                channel: payload.channel?.trim()?.slice(0, 50) ?? ticket.channel,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, ticket.id));
        }
        const existing = await db.query.kdsTicketItems.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.ticketId, ticket.id),
            columns: { lineId: true },
        });
        const seen = new Set(existing.map((r) => r.lineId));
        const toInsert = items.filter((i) => !seen.has(i.lineId));
        if (toInsert.length) {
            await db.insert(db_1.schema.kdsTicketItems).values(toInsert.map((i) => ({
                ticketId: ticket.id,
                lineId: i.lineId,
                productId: i.productId || null,
                categoryId: i.categoryId || null,
                name: String(i.name).slice(0, 255),
                quantity: String(i.quantity || 1),
                lineNote: i.lineNote?.trim()?.slice(0, 500) || null,
                courseNumber: i.courseNumber ?? null,
                modifiersJson: {
                    selectedExtras: i.selectedExtras || [],
                    comboSelections: i.comboSelections || [],
                },
                status: "pending",
            })));
        }
        return { ok: true, added: toInsert.length, ticketId: ticket.id };
    }
    static async listForToken(token, since) {
        const station = await this.stationByToken(token);
        if (!station)
            throw new Error("Invalid KDS link");
        await requireAddon(station.merchantId);
        const db = (0, db_1.getDb)();
        const sinceDate = since ? new Date(since) : null;
        const completedSince = new Date(Date.now() - COMPLETED_RETENTION_MS);
        const tickets = await db.query.kdsTickets.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, station.merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.kdsTickets.status, ["pending", "completed", "cancelled"])),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.kdsTickets.createdAt)],
            with: { items: true },
        });
        const filtered = tickets
            .map((t) => {
            const items = (t.items || []).filter((item) => itemMatchesStation(item, station, t.channel));
            if (!items.length)
                return null;
            if ((t.status === "completed" || t.status === "cancelled") &&
                t.completedAt &&
                t.completedAt < completedSince) {
                return null;
            }
            return {
                id: t.id,
                ticketKey: t.ticketKey,
                orderNumber: t.orderNumber,
                tableLabel: t.tableLabel,
                tabNumber: t.tabNumber,
                channel: t.channel,
                status: t.status,
                createdAt: t.createdAt,
                completedAt: t.completedAt,
                items: items.map((i) => ({
                    id: i.id,
                    lineId: i.lineId,
                    name: i.name,
                    quantity: Number(i.quantity),
                    lineNote: i.lineNote,
                    courseNumber: i.courseNumber,
                    status: i.status,
                    readyAt: i.readyAt,
                    modifiersJson: i.modifiersJson,
                })),
            };
        })
            .filter(Boolean)
            .sort((a, b) => {
            if (a.status === "cancelled" && b.status !== "cancelled")
                return -1;
            if (b.status === "cancelled" && a.status !== "cancelled")
                return 1;
            if (a.status === "completed" && b.status === "completed") {
                const aAt = a.completedAt ? new Date(a.completedAt).getTime() : 0;
                const bAt = b.completedAt ? new Date(b.completedAt).getTime() : 0;
                return bAt - aAt;
            }
            if (a.status === "completed")
                return 1;
            if (b.status === "completed")
                return -1;
            return 0;
        });
        const updatedSince = sinceDate
            ? tickets.some((t) => t.updatedAt > sinceDate)
            : true;
        return {
            station: {
                id: station.id,
                name: station.name,
                theme: normalizeKdsTheme(station.theme),
                layoutMode: normalizeKdsLayoutMode(station.layoutMode),
                gridColumns: clampGridColumns(station.gridColumns),
                overdueMinutes: clampOverdueMinutes(station.overdueMinutes),
            },
            serverTime: new Date().toISOString(),
            updated: updatedSince,
            tickets: filtered,
        };
    }
    /** POS sync: all open/recent KDS tickets with ready line ids and completion state. */
    static async boardStatusForMerchant(merchantId) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const completedSince = new Date(Date.now() - COMPLETED_RETENTION_MS);
        const tickets = await db.query.kdsTickets.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.kdsTickets.status, ["pending", "completed", "cancelled"])),
            with: { items: true },
        });
        return tickets
            .filter((t) => t.status === "pending" ||
            (t.completedAt && t.completedAt >= completedSince))
            .map((t) => {
            const items = t.items || [];
            return {
                ticketKey: t.ticketKey,
                status: t.status,
                completedAt: t.completedAt?.toISOString() ?? null,
                readyLineIds: items.filter((i) => i.status === "ready").map((i) => i.lineId),
                total: items.length,
                ready: items.filter((i) => i.status === "ready").length,
            };
        });
    }
    static async markItemReady(token, itemId) {
        const station = await this.stationByToken(token);
        if (!station)
            throw new Error("Invalid KDS link");
        await requireAddon(station.merchantId);
        const db = (0, db_1.getDb)();
        const item = await db.query.kdsTicketItems.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.id, itemId),
            with: { ticket: true },
        });
        if (!item?.ticket || item.ticket.merchantId !== station.merchantId) {
            throw new Error("Item not found");
        }
        await db
            .update(db_1.schema.kdsTicketItems)
            .set({ status: "ready", readyAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.id, itemId));
        await db
            .update(db_1.schema.kdsTickets)
            .set({ updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, item.ticketId));
        const allItems = await db.query.kdsTicketItems.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.ticketId, item.ticketId),
        });
        const allReady = allItems.length > 0 && allItems.every((i) => i.status === "ready");
        if (allReady) {
            await maybePushOdsReady(station.merchantId, item.ticket);
        }
        return { ok: true, lineId: item.lineId, ticketKey: item.ticket.ticketKey };
    }
    /** Recall one ready item from a completed (or ready) ticket back to preparation. */
    static async recallItem(token, itemId) {
        const station = await this.stationByToken(token);
        if (!station)
            throw new Error("Invalid KDS link");
        await requireAddon(station.merchantId);
        const db = (0, db_1.getDb)();
        const item = await db.query.kdsTicketItems.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.id, itemId),
            with: { ticket: true },
        });
        if (!item?.ticket || item.ticket.merchantId !== station.merchantId) {
            throw new Error("Item not found");
        }
        if (item.status !== "ready") {
            throw new Error("Only ready items can be recalled");
        }
        const now = new Date();
        await db
            .update(db_1.schema.kdsTicketItems)
            .set({ status: "pending", readyAt: null })
            .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.id, itemId));
        await db
            .update(db_1.schema.kdsTickets)
            .set({ status: "pending", completedAt: null, updatedAt: now })
            .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, item.ticketId));
        await maybePushOdsPreparing(station.merchantId, item.ticket);
        return { ok: true, lineId: item.lineId, ticketKey: item.ticket.ticketKey };
    }
    static async completeTicket(token, ticketId) {
        const station = await this.stationByToken(token);
        if (!station)
            throw new Error("Invalid KDS link");
        await requireAddon(station.merchantId);
        const db = (0, db_1.getDb)();
        const ticket = await db.query.kdsTickets.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, ticketId), (0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, station.merchantId)),
            with: { items: true },
        });
        if (!ticket)
            throw new Error("Ticket not found");
        const now = new Date();
        if (ticket.status === "cancelled") {
            await db
                .update(db_1.schema.kdsTickets)
                .set({ status: "completed", completedAt: now, updatedAt: now })
                .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, ticketId));
            return { ok: true, ticketKey: ticket.ticketKey };
        }
        await db
            .update(db_1.schema.kdsTicketItems)
            .set({ status: "ready", readyAt: now })
            .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.ticketId, ticketId));
        await db
            .update(db_1.schema.kdsTickets)
            .set({ status: "completed", completedAt: now, updatedAt: now })
            .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, ticketId));
        await maybePushOdsReady(station.merchantId, ticket);
        return { ok: true, ticketKey: ticket.ticketKey };
    }
    static async recallTicket(token, ticketId) {
        const station = await this.stationByToken(token);
        if (!station)
            throw new Error("Invalid KDS link");
        await requireAddon(station.merchantId);
        const db = (0, db_1.getDb)();
        const ticket = await db.query.kdsTickets.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, ticketId), (0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, station.merchantId), (0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.status, "completed")),
        });
        if (!ticket)
            throw new Error("Ticket not found");
        await db
            .update(db_1.schema.kdsTickets)
            .set({ status: "pending", completedAt: null, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, ticketId));
        await db
            .update(db_1.schema.kdsTicketItems)
            .set({ status: "pending", readyAt: null })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.ticketId, ticketId), (0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.status, "ready")));
        await maybePushOdsPreparing(station.merchantId, ticket);
        return { ok: true };
    }
    /** Mark KDS tickets cancelled when POS voids/cancels a kitchen order. */
    static async dismissTicketsByKey(merchantId, ticketKey) {
        await requireAddon(merchantId);
        const raw = String(ticketKey || "").trim();
        const base = raw.split("@")[0];
        if (!base)
            return { dismissed: 0 };
        const digits = base.replace(/^#/, "");
        const db = (0, db_1.getDb)();
        const pending = await db.query.kdsTickets.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.status, "pending")),
        });
        const matches = pending.filter((t) => {
            const key = String(t.ticketKey || "").trim();
            const keyBase = key.split("@")[0];
            if (keyBase === base || key === raw)
                return true;
            if (digits && (keyBase === `#${digits}` || keyBase === digits))
                return true;
            return false;
        });
        if (!matches.length)
            return { dismissed: 0 };
        const now = new Date();
        const ids = matches.map((t) => t.id);
        await db
            .update(db_1.schema.kdsTickets)
            .set({ status: "cancelled", completedAt: now, updatedAt: now })
            .where((0, drizzle_orm_1.inArray)(db_1.schema.kdsTickets.id, ids));
        await db
            .update(db_1.schema.kdsTicketItems)
            .set({ status: "cancelled", readyAt: null })
            .where((0, drizzle_orm_1.inArray)(db_1.schema.kdsTicketItems.ticketId, ids));
        return { dismissed: matches.length };
    }
    static async ticketStatusForPos(merchantId, ticketKey) {
        await requireAddon(merchantId);
        const base = String(ticketKey || "")
            .trim()
            .split("@")[0];
        if (!base)
            return { readyLineIds: [], total: 0, ready: 0, sent: 0 };
        const db = (0, db_1.getDb)();
        const tickets = await db.query.kdsTickets.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, merchantId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.ticketKey, base), (0, drizzle_orm_1.sql) `${db_1.schema.kdsTickets.ticketKey} LIKE ${`${base}@%`}`)),
            with: { items: true },
        });
        if (!tickets.length)
            return { readyLineIds: [], total: 0, ready: 0, sent: 0 };
        const items = tickets.flatMap((t) => t.items || []);
        const readyLineIds = items.filter((i) => i.status === "ready").map((i) => i.lineId);
        return {
            status: tickets.some((t) => t.status === "pending") ? "pending" : "completed",
            readyLineIds,
            total: items.length,
            sent: items.length,
            ready: readyLineIds.length,
        };
    }
}
exports.KdsService = KdsService;
//# sourceMappingURL=kds.service.js.map