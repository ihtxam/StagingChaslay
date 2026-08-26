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
exports.OdsService = exports.OdsLicenseError = exports.ODS_THEMES = void 0;
exports.resolveOdsDisplayNumber = resolveOdsDisplayNumber;
exports.orderNumberAliases = orderNumberAliases;
const crypto_1 = require("crypto");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const ods_addon_1 = require("@/lib/ods-addon");
const ensure_merchant_schema_1 = require("@/lib/ensure-merchant-schema");
const display_short_code_1 = require("@/lib/display-short-code");
const guest_order_number_1 = require("@/lib/guest-order-number");
const web_order_number_1 = require("@/lib/web-order-number");
exports.ODS_THEMES = ["light", "teal", "dark"];
class OdsLicenseError extends Error {
    constructor() {
        super("Order display (ODS) addon is not enabled for this merchant");
        this.code = "ODS_ADDON_REQUIRED";
    }
}
exports.OdsLicenseError = OdsLicenseError;
const READY_RETENTION_MS = 2 * 60 * 60 * 1000;
/** Live “being prepared” rows older than this are hidden (stale kitchen queue). */
const LIVE_PREPARING_MAX_AGE_MS = 2 * 60 * 60 * 1000;
/** Live “ready for pickup” rows older than this are hidden. */
const LIVE_READY_MAX_AGE_MS = 4 * 60 * 60 * 1000;
/** Shadow “preparing” rows — align with live preparing max age. */
const PREPARING_RETENTION_MS = LIVE_PREPARING_MAX_AGE_MS;
/** Dismissed numbers expire after this (allows ticket numbers to recycle). */
const DISMISSED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** Order Center / web shop statuses shown on the “being prepared” column. */
const PREPARING_ORDER_STATUSES = ["accepted", "preparing", "sent_to_kitchen"];
/** Statuses that remove an order from the customer board. */
const ODS_DISMISS_STATUSES = new Set([
    "completed",
    "cancelled",
    "out_for_delivery",
    "refunded",
    "partially_refunded",
]);
function resolveOdsDisplayNumber(order) {
    const meta = (0, guest_order_number_1.parseOrderMetaFromNotes)(order.notes);
    const raw = (0, guest_order_number_1.guestOrderNumber)({
        orderNumber: order.orderNumber,
        orderDisplay: meta.ticketDisplay,
        tabNumber: meta.tabNumber,
    });
    const web = (0, web_order_number_1.formatWebOrderNumberDisplay)(String(order.orderNumber || "").trim());
    const pick = raw || web || String(order.orderNumber || "").trim();
    return normalizeOrderNumber(pick);
}
function mergeBoardNumbers(shadow, live, kdsReady = []) {
    const readyAliasSet = new Set();
    for (const num of [...live.ready, ...shadow.ready, ...kdsReady]) {
        for (const alias of orderNumberAliases(num))
            readyAliasSet.add(alias);
    }
    const isReady = (num) => orderNumberAliases(num).some((alias) => readyAliasSet.has(alias));
    const preparing = [];
    const seenPrep = new Set();
    for (const num of [...shadow.preparing, ...live.preparing]) {
        const key = normalizeOrderNumber(num);
        if (!key || isReady(num) || seenPrep.has(key))
            continue;
        seenPrep.add(key);
        preparing.push(key);
    }
    const ready = [];
    const seenReady = new Set();
    for (const num of [...live.ready, ...shadow.ready, ...kdsReady]) {
        const key = normalizeOrderNumber(num);
        if (!key || seenReady.has(key))
            continue;
        seenReady.add(key);
        ready.push(key);
    }
    return { preparing, ready };
}
function filterBoardByDismissed(board, dismissed) {
    if (!dismissed.size)
        return board;
    return {
        preparing: board.preparing.filter((n) => !isOrderDismissed(n, dismissed)),
        ready: board.ready.filter((n) => !isOrderDismissed(n, dismissed)),
    };
}
async function kdsKitchenReadyNumbers(merchantId) {
    const db = (0, db_1.getDb)();
    const tickets = await db.query.kdsTickets.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.kdsTickets.status, ["pending", "completed"])),
        with: { items: true },
    });
    const ready = [];
    const seen = new Set();
    for (const ticket of tickets) {
        const items = ticket.items || [];
        if (!items.length)
            continue;
        const allReady = ticket.status === "completed" ||
            items.every((item) => String(item.status || "").toLowerCase() === "ready");
        if (!allReady)
            continue;
        const num = (0, guest_order_number_1.resolveOdsPushNumber)(ticket.ticketKey) || (0, guest_order_number_1.resolveOdsPushNumber)(ticket.orderNumber);
        if (!num)
            continue;
        const key = normalizeOrderNumber(num);
        if (!key || seen.has(key))
            continue;
        seen.add(key);
        ready.push(key);
    }
    return ready;
}
async function dismissedOrderNumbers(merchantId) {
    const db = (0, db_1.getDb)();
    const rows = await db.query.odsDismissedOrders.findMany({
        where: (0, drizzle_orm_1.eq)(db_1.schema.odsDismissedOrders.merchantId, merchantId),
        columns: { orderNumber: true },
    });
    return new Set(rows.map((r) => normalizeOrderNumber(r.orderNumber)).filter(Boolean));
}
async function markDismissed(merchantId, orderNumbers) {
    const db = (0, db_1.getDb)();
    const now = new Date();
    const seen = new Set();
    for (const raw of orderNumbers) {
        for (const alias of orderNumberAliases(raw)) {
            if (!alias || seen.has(alias))
                continue;
            seen.add(alias);
            await db
                .insert(db_1.schema.odsDismissedOrders)
                .values({ merchantId, orderNumber: alias, dismissedAt: now })
                .onConflictDoUpdate({
                target: [db_1.schema.odsDismissedOrders.merchantId, db_1.schema.odsDismissedOrders.orderNumber],
                set: { dismissedAt: now },
            });
        }
    }
    return seen.size;
}
async function unmarkDismissed(merchantId, orderNumber) {
    const num = normalizeOrderNumber(orderNumber);
    if (!num)
        return;
    const db = (0, db_1.getDb)();
    await db
        .delete(db_1.schema.odsDismissedOrders)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsDismissedOrders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.odsDismissedOrders.orderNumber, num)));
}
async function purgeDismissed(merchantId) {
    const db = (0, db_1.getDb)();
    await db
        .delete(db_1.schema.odsDismissedOrders)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsDismissedOrders.merchantId, merchantId), (0, drizzle_orm_1.lt)(db_1.schema.odsDismissedOrders.dismissedAt, new Date(Date.now() - DISMISSED_RETENTION_MS))));
}
function newToken() {
    return (0, crypto_1.randomBytes)(24).toString("hex");
}
function normalizeTheme(value) {
    const t = String(value || "light").toLowerCase();
    return exports.ODS_THEMES.includes(t) ? t : "light";
}
function normalizeOrderNumber(value) {
    let s = String(value || "")
        .trim()
        .replace(/\s+/g, "");
    if (!s)
        return "";
    const bare = s.replace(/^#/, "");
    if (/^\d{1,6}$/.test(bare)) {
        return `#${bare}`;
    }
    if (/^WEB-/i.test(s)) {
        return (0, web_order_number_1.formatWebOrderNumberDisplay)(s);
    }
    return s.slice(0, 64);
}
/** All normalized forms used when matching dismissals (e.g. #6457 and 6457). */
function orderNumberAliases(value) {
    const n = normalizeOrderNumber(value);
    if (!n)
        return [];
    const out = new Set([n]);
    const bare = n.replace(/^#/, "");
    if (/^\d{1,6}$/.test(bare)) {
        out.add(`#${bare}`);
        out.add(bare);
    }
    const web = (0, web_order_number_1.formatWebOrderNumberDisplay)(n);
    if (web)
        out.add(web);
    return [...out];
}
function isOrderDismissed(num, dismissed) {
    if (!dismissed.size)
        return false;
    return orderNumberAliases(num).some((alias) => dismissed.has(alias));
}
async function findShadowRow(merchantId, orderNumber) {
    const db = (0, db_1.getDb)();
    const target = normalizeOrderNumber(orderNumber);
    if (!target)
        return null;
    const rows = await db.query.odsOrders.findMany({
        where: (0, drizzle_orm_1.eq)(db_1.schema.odsOrders.merchantId, merchantId),
        columns: { id: true, orderNumber: true, status: true },
    });
    return rows.find((r) => normalizeOrderNumber(r.orderNumber) === target) || null;
}
/** Drop shadow rows whose main order has already left the board. */
async function reconcileShadowBoard(merchantId) {
    const db = (0, db_1.getDb)();
    const shadowRows = await db.query.odsOrders.findMany({
        where: (0, drizzle_orm_1.eq)(db_1.schema.odsOrders.merchantId, merchantId),
        columns: { id: true, orderNumber: true },
    });
    if (!shadowRows.length)
        return;
    const liveOrders = await db.query.orders.findMany({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.orders.status, [
            ...Array.from(ODS_DISMISS_STATUSES),
            "ready",
            ...PREPARING_ORDER_STATUSES,
        ])),
        columns: { orderNumber: true, notes: true, status: true },
    });
    const terminalNums = new Set();
    for (const row of liveOrders) {
        const num = resolveOdsDisplayNumber(row);
        if (!num)
            continue;
        const st = String(row.status || "").toLowerCase();
        if (ODS_DISMISS_STATUSES.has(st))
            terminalNums.add(num);
    }
    for (const shadow of shadowRows) {
        const num = normalizeOrderNumber(shadow.orderNumber);
        if (!num)
            continue;
        if (terminalNums.has(num)) {
            await db.delete(db_1.schema.odsOrders).where((0, drizzle_orm_1.eq)(db_1.schema.odsOrders.id, shadow.id));
        }
    }
}
async function requireAddon(merchantId) {
    await (0, ensure_merchant_schema_1.ensureOdsAddonColumn)();
    const { ensureMerchantTables } = await Promise.resolve().then(() => __importStar(require("@/lib/ensure-merchant-schema")));
    await ensureMerchantTables();
    const enabled = await (0, ods_addon_1.readOdsAddonEnabled)(merchantId);
    if (!enabled)
        throw new OdsLicenseError();
}
async function purgeOpaqueShadowRows(merchantId) {
    const db = (0, db_1.getDb)();
    const shadowRows = await db.query.odsOrders.findMany({
        where: (0, drizzle_orm_1.eq)(db_1.schema.odsOrders.merchantId, merchantId),
        columns: { id: true, orderNumber: true },
    });
    for (const row of shadowRows) {
        const num = normalizeOrderNumber(row.orderNumber);
        if (!num || (0, guest_order_number_1.isGuestFacingOdsNumber)(num))
            continue;
        await db.delete(db_1.schema.odsOrders).where((0, drizzle_orm_1.eq)(db_1.schema.odsOrders.id, row.id));
    }
}
async function purgeStale(merchantId) {
    const db = (0, db_1.getDb)();
    const now = Date.now();
    await reconcileShadowBoard(merchantId);
    await purgeOpaqueShadowRows(merchantId);
    await purgeDismissed(merchantId);
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
        await (0, display_short_code_1.ensureOdsDisplayShortCodes)(db, merchantId);
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
            shortCode: await (0, display_short_code_1.allocateDisplayShortCode)(db),
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
            .set({
            token: newToken(),
            shortCode: await (0, display_short_code_1.allocateDisplayShortCode)(db),
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.id, id), (0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.merchantId, merchantId)))
            .returning();
        if (!row)
            throw new Error("ODS display not found");
        return row;
    }
    static async displayByToken(accessKey) {
        const trimmed = String(accessKey || "").trim();
        if (!trimmed)
            return null;
        const db = (0, db_1.getDb)();
        return db.query.odsDisplays.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.shortCode, trimmed), (0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.token, trimmed)), (0, drizzle_orm_1.eq)(db_1.schema.odsDisplays.isActive, true)),
        });
    }
    /** Push or update an order on the customer board (POS / KDS integration). */
    static async pushOrder(merchantId, payload) {
        const orderNumber = (0, guest_order_number_1.resolveOdsPushNumber)(payload.orderNumber) || normalizeOrderNumber(payload.orderNumber);
        if (!orderNumber || !(0, guest_order_number_1.isGuestFacingOdsNumber)(orderNumber)) {
            return { ok: false, skipped: true, reason: "non_guest_number" };
        }
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
        const dismissed = await dismissedOrderNumbers(merchantId);
        if (isOrderDismissed(orderNumber, dismissed)) {
            return { ok: true, skipped: true, dismissed: true };
        }
        const existing = await findShadowRow(merchantId, orderNumber);
        const now = new Date();
        if (existing) {
            if (existing.status === status) {
                return { ok: true, orderNumber, status, unchanged: true };
            }
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
        return this.dismissOrderSoft(merchantId, orderNumber);
    }
    /** Remove from board without throwing when addon is off (internal sync). */
    static async dismissOrderSoft(merchantId, orderNumber) {
        const num = normalizeOrderNumber(orderNumber);
        if (!num)
            throw new Error("orderNumber is required");
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
        await markDismissed(merchantId, orderNumberAliases(num));
        const rows = await db.query.odsOrders.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.odsOrders.merchantId, merchantId),
            columns: { id: true, orderNumber: true },
        });
        const target = normalizeOrderNumber(num);
        const toDelete = rows.filter((r) => normalizeOrderNumber(r.orderNumber) === target);
        for (const row of toDelete) {
            await db.delete(db_1.schema.odsOrders).where((0, drizzle_orm_1.eq)(db_1.schema.odsOrders.id, row.id));
        }
        return { ok: true };
    }
    /**
     * Keep ODS in sync with main order lifecycle (Order Center, online shop, POS pay-later).
     * Also used after POS kitchen send via shadow-table push — idempotent upsert/dismiss.
     */
    static async syncFromOrder(merchantId, order) {
        const num = resolveOdsDisplayNumber(order);
        if (!num)
            return { ok: false, skipped: true };
        const status = String(order.status || "").toLowerCase();
        if (ODS_DISMISS_STATUSES.has(status)) {
            await unmarkDismissed(merchantId, num);
            return this.dismissOrderSoft(merchantId, num);
        }
        const dismissed = await dismissedOrderNumbers(merchantId);
        if (isOrderDismissed(num, dismissed)) {
            return { ok: true, skipped: true, dismissed: true };
        }
        if (PREPARING_ORDER_STATUSES.includes(status)) {
            return this.pushOrder(merchantId, { orderNumber: num, status: "preparing" });
        }
        if (status === "ready") {
            return this.pushOrder(merchantId, { orderNumber: num, status: "ready" });
        }
        return { ok: false, skipped: true };
    }
    /** Collect every pickup number currently visible (shadow + live + open KDS). */
    static async snapshotVisibleNumbers(merchantId) {
        const db = (0, db_1.getDb)();
        const out = new Set();
        const shadowRows = await db.query.odsOrders.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.odsOrders.merchantId, merchantId),
            columns: { orderNumber: true },
        });
        for (const row of shadowRows) {
            for (const alias of orderNumberAliases(row.orderNumber))
                out.add(alias);
        }
        const live = await this.boardFromLiveOrders(merchantId, { includeDismissed: true });
        for (const num of [...live.preparing, ...live.ready]) {
            for (const alias of orderNumberAliases(num))
                out.add(alias);
        }
        const kdsTickets = await db.query.kdsTickets.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.kdsTickets.status, ["pending", "completed"])),
            columns: { ticketKey: true, orderNumber: true },
        });
        for (const ticket of kdsTickets) {
            for (const alias of orderNumberAliases(ticket.ticketKey))
                out.add(alias);
            if (ticket.orderNumber) {
                for (const alias of orderNumberAliases(ticket.orderNumber))
                    out.add(alias);
            }
        }
        return [...out];
    }
    /** Close open Order Center rows that were showing on the pickup board. */
    static async closeLiveOrdersForNumbers(merchantId, numbers) {
        if (!numbers.size)
            return 0;
        const db = (0, db_1.getDb)();
        const rows = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.orders.status, [...PREPARING_ORDER_STATUSES, "ready"])),
            columns: { id: true, orderNumber: true, notes: true, status: true },
        });
        const now = new Date();
        let closed = 0;
        for (const row of rows) {
            const num = resolveOdsDisplayNumber(row);
            if (!num || !isOrderDismissed(num, numbers))
                continue;
            await db
                .update(db_1.schema.orders)
                .set({ status: "completed", completedAt: now, updatedAt: now })
                .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, row.id));
            closed += 1;
        }
        return closed;
    }
    /** Complete open KDS tickets whose numbers were cleared from the pickup board. */
    static async completeKdsTicketsForNumbers(merchantId, numbers) {
        if (!numbers.size)
            return 0;
        const db = (0, db_1.getDb)();
        const tickets = await db.query.kdsTickets.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.status, "pending")),
            columns: { id: true, ticketKey: true, orderNumber: true },
        });
        const now = new Date();
        let closed = 0;
        for (const ticket of tickets) {
            const onBoard = isOrderDismissed(ticket.ticketKey, numbers) ||
                (ticket.orderNumber ? isOrderDismissed(ticket.orderNumber, numbers) : false);
            if (!onBoard)
                continue;
            await db
                .update(db_1.schema.kdsTickets)
                .set({ status: "completed", completedAt: now, updatedAt: now })
                .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTickets.id, ticket.id));
            await db
                .update(db_1.schema.kdsTicketItems)
                .set({ status: "ready", readyAt: now })
                .where((0, drizzle_orm_1.eq)(db_1.schema.kdsTicketItems.ticketId, ticket.id));
            closed += 1;
        }
        return closed;
    }
    /** Snapshot current board numbers, dismiss them, and clear shadow rows. */
    static async clearAllOrders(merchantId) {
        await requireAddon(merchantId);
        const db = (0, db_1.getDb)();
        const visible = await this.snapshotVisibleNumbers(merchantId);
        const dismissed = await markDismissed(merchantId, visible);
        const dismissedSet = new Set(visible);
        const closedLive = await this.closeLiveOrdersForNumbers(merchantId, dismissedSet);
        const closedKds = await this.completeKdsTicketsForNumbers(merchantId, dismissedSet);
        await purgeStale(merchantId);
        const deleted = await db
            .delete(db_1.schema.odsOrders)
            .where((0, drizzle_orm_1.eq)(db_1.schema.odsOrders.merchantId, merchantId))
            .returning({ id: db_1.schema.odsOrders.id });
        return { ok: true, removed: deleted.length, dismissed, closedLive, closedKds };
    }
    /** Live orders from the main orders table (online shop + POS pay-later / open fulfillment). */
    static async boardFromLiveOrders(merchantId, opts) {
        const enabled = await (0, ods_addon_1.readOdsAddonEnabled)(merchantId).catch(() => false);
        if (!enabled)
            return { preparing: [], ready: [] };
        const db = (0, db_1.getDb)();
        const now = Date.now();
        const rows = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.orders.status, [...PREPARING_ORDER_STATUSES, "ready"])),
            columns: { orderNumber: true, notes: true, status: true, createdAt: true },
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.orders.createdAt)],
        });
        const preparing = [];
        const ready = [];
        const seen = new Set();
        for (const row of rows) {
            const ageMs = row.createdAt ? now - row.createdAt.getTime() : 0;
            const st = String(row.status || "").toLowerCase();
            if (st === "ready") {
                if (ageMs > LIVE_READY_MAX_AGE_MS)
                    continue;
            }
            else if (PREPARING_ORDER_STATUSES.includes(st)) {
                if (ageMs > LIVE_PREPARING_MAX_AGE_MS)
                    continue;
            }
            const num = resolveOdsDisplayNumber(row);
            if (!num || seen.has(num))
                continue;
            seen.add(num);
            if (st === "ready")
                ready.push(num);
            else if (PREPARING_ORDER_STATUSES.includes(st))
                preparing.push(num);
        }
        if (opts?.includeDismissed)
            return { preparing, ready };
        const dismissed = await dismissedOrderNumbers(merchantId);
        return filterBoardByDismissed({ preparing, ready }, dismissed);
    }
    static async boardForToken(token) {
        const display = await this.displayByToken(token);
        if (!display)
            throw new Error("Invalid ODS link");
        const { ensureMerchantTables } = await Promise.resolve().then(() => __importStar(require("@/lib/ensure-merchant-schema")));
        await ensureMerchantTables();
        const enabled = await (0, ods_addon_1.readOdsAddonEnabled)(display.merchantId).catch(() => false);
        if (!enabled)
            throw new OdsLicenseError();
        await purgeStale(display.merchantId);
        const db = (0, db_1.getDb)();
        const dismissed = await dismissedOrderNumbers(display.merchantId);
        const preparingRows = await db.query.odsOrders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsOrders.merchantId, display.merchantId), (0, drizzle_orm_1.eq)(db_1.schema.odsOrders.status, "preparing")),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.odsOrders.createdAt)],
        });
        const readyRows = await db.query.odsOrders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.odsOrders.merchantId, display.merchantId), (0, drizzle_orm_1.eq)(db_1.schema.odsOrders.status, "ready")),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.odsOrders.readyAt), (0, drizzle_orm_1.desc)(db_1.schema.odsOrders.updatedAt)],
        });
        const shadow = {
            preparing: preparingRows
                .map((r) => normalizeOrderNumber(r.orderNumber))
                .filter(Boolean)
                .filter((n) => !isOrderDismissed(n, dismissed)),
            ready: readyRows
                .map((r) => normalizeOrderNumber(r.orderNumber))
                .filter(Boolean)
                .filter((n) => !isOrderDismissed(n, dismissed)),
        };
        const live = await this.boardFromLiveOrders(display.merchantId);
        const merged = mergeBoardNumbers(shadow, live);
        const filtered = filterBoardByDismissed(merged, dismissed);
        return {
            display: {
                id: display.id,
                name: display.name,
                theme: display.theme,
            },
            serverTime: new Date().toISOString(),
            preparing: filtered.preparing,
            ready: filtered.ready,
        };
    }
}
exports.OdsService = OdsService;
//# sourceMappingURL=ods.service.js.map