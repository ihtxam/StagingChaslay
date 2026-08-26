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
exports.PosOrdersService = void 0;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const pos_print_settings_1 = require("@/lib/pos-print-settings");
const money_1 = require("@/lib/money");
const vacation_1 = require("@/lib/vacation");
const order_item_name_1 = require("@/lib/order-item-name");
const payment_breakdown_1 = require("@/lib/payment-breakdown");
const gift_card_service_1 = require("@/services/gift-card.service");
const adyen_terminal_poi_service_1 = require("@/services/adyen-terminal-poi.service");
const adyen_service_1 = require("@/services/adyen.service");
const COMPLETED_STATUSES = new Set(["completed", "partially_refunded"]);
const BLOCKED_CANCEL_STATUSES = new Set([
    "completed",
    "partially_refunded",
    "refunded",
    "cancelled",
]);
const ALLOWED_PAYMENT_METHODS = new Set([
    "cash",
    "card",
    "terminal",
    "express",
    "online",
    "loyalty",
    "pay_later",
    "invoice",
    "bank_transfer",
]);
function resolveOrderCustomerName(order) {
    const direct = String(order.customerName || "").trim();
    if (direct)
        return direct;
    const linked = order.customer;
    if (linked) {
        const name = [linked.firstName, linked.lastName].filter(Boolean).join(" ").trim();
        if (name)
            return name;
    }
    const memberMatch = String(order.notes || "").match(/\[member:([^\]]+)\]/i);
    if (memberMatch?.[1]?.trim())
        return memberMatch[1].trim();
    const ch = String(order.fulfillmentChannel || "takeaway").toLowerCase();
    const table = String(order.tableLabel || "").trim();
    if (table && ch !== "dine_in")
        return table;
    return null;
}
function parseHeldCart(cartJson) {
    const data = normalizeHeldCartJson(cartJson);
    const lines = Array.isArray(data) ? data : data?.cart || [];
    const channel = (!Array.isArray(data) && data?.channel) || "takeaway";
    const tableLabel = (!Array.isArray(data) && data?.tableLabel) || null;
    const notes = (!Array.isArray(data) && data?.orderNote) || null;
    return { lines, channel: String(channel), tableLabel, notes };
}
function normalizeHeldCartJson(cartJson) {
    let data = cartJson;
    if (typeof data === "string") {
        try {
            data = JSON.parse(data);
        }
        catch {
            return null;
        }
    }
    if (Array.isArray(data) || (data && typeof data === "object")) {
        return data;
    }
    return null;
}
function heldIdentity(cartJson) {
    const data = normalizeHeldCartJson(cartJson);
    if (!data || Array.isArray(data)) {
        return { ticketDisplay: null, tableId: null, tabNumber: null };
    }
    const ticket = typeof data.ticketDisplay === "string" ? data.ticketDisplay.trim() : "";
    const tableId = typeof data.tableId === "string" ? data.tableId.trim() : "";
    const tab = data.tabNumber != null ? String(data.tabNumber).trim() : "";
    return {
        ticketDisplay: ticket || null,
        tableId: tableId || null,
        tabNumber: tab || null,
    };
}
function sameHeldIdentity(a, b) {
    if (a.ticketDisplay && b.ticketDisplay && a.ticketDisplay === b.ticketDisplay)
        return true;
    if (a.tableId && b.tableId && a.tableId === b.tableId) {
        if (a.ticketDisplay && b.ticketDisplay)
            return a.ticketDisplay === b.ticketDisplay;
        if (a.ticketDisplay || b.ticketDisplay)
            return false;
        return true;
    }
    if (!a.tableId && !b.tableId && a.tabNumber && b.tabNumber && a.tabNumber === b.tabNumber) {
        return true;
    }
    return false;
}
class PosOrdersService {
    static cancelReasons() {
        return pos_print_settings_1.POS_CANCEL_REASONS;
    }
    static refundReasons() {
        return pos_print_settings_1.POS_REFUND_REASONS;
    }
    static async listPosOrders(merchantId, opts = {}) {
        const db = (0, db_1.getDb)();
        const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 200);
        const conditions = [
            (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId),
            // POS register sales + online shop orders (web_shop) for the Orders board
            (0, drizzle_orm_1.inArray)(db_1.schema.orders.orderType, ["pos", "web_shop"]),
        ];
        if (opts.status && opts.status !== "all") {
            if (opts.status === "completed") {
                // Unpaid invoice POS sales stay in history (status may still be preparing).
                conditions.push((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(db_1.schema.orders.status, "completed"), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.paymentMethod, "invoice"), (0, drizzle_orm_1.eq)(db_1.schema.orders.paymentStatus, "awaiting_payment"))));
            }
            else {
                conditions.push((0, drizzle_orm_1.eq)(db_1.schema.orders.status, opts.status));
            }
        }
        const q = String(opts.q || "").trim();
        const bareQ = q.replace(/^#/, "");
        const searchParts = q
            ? [
                (0, drizzle_orm_1.ilike)(db_1.schema.orders.orderNumber, `%${q}%`),
                (0, drizzle_orm_1.ilike)(db_1.schema.orders.clientId, `%${q}%`),
                (0, drizzle_orm_1.ilike)(db_1.schema.orders.invoiceNumber, `%${q}%`),
                (0, drizzle_orm_1.ilike)(db_1.schema.orders.customerName, `%${q}%`),
                (0, drizzle_orm_1.ilike)(db_1.schema.orders.paymentMethod, `%${q}%`),
                (0, drizzle_orm_1.ilike)(db_1.schema.orders.tableLabel, `%${q}%`),
                (0, drizzle_orm_1.ilike)(db_1.schema.orders.notes, `%${q}%`),
            ]
            : [];
        if (bareQ && bareQ !== q) {
            searchParts.push((0, drizzle_orm_1.ilike)(db_1.schema.orders.orderNumber, `%${bareQ}%`), (0, drizzle_orm_1.ilike)(db_1.schema.orders.notes, `%${bareQ}%`));
        }
        if (/^\d{1,6}$/.test(bareQ)) {
            const guestNum = Number(bareQ);
            searchParts.push((0, drizzle_orm_1.ilike)(db_1.schema.orders.notes, `%[ticket:${bareQ}]%`), (0, drizzle_orm_1.ilike)(db_1.schema.orders.notes, `%[tab:${bareQ}]%`), (0, drizzle_orm_1.ilike)(db_1.schema.orders.notes, `%[ticket:#${bareQ}]%`), (0, drizzle_orm_1.ilike)(db_1.schema.orders.notes, `%[tab:#${bareQ}]%`));
            if (Number.isFinite(guestNum)) {
                searchParts.push((0, drizzle_orm_1.eq)(db_1.schema.orders.guestCount, guestNum));
            }
        }
        const searchCond = searchParts.length ? (0, drizzle_orm_1.or)(...searchParts) : null;
        // Include orders created in range OR scheduled (pickup/delivery) in range so a
        // future delivery time does not hide a ticket from today's history.
        // A ref search (WP-… / INV-… / kitchen #1001) also matches outside the date window.
        if (opts.from || opts.to) {
            const start = opts.from ? (0, vacation_1.zurichDayBounds)(opts.from).start : new Date(0);
            const end = opts.to ? (0, vacation_1.zurichDayBounds)(opts.to).end : new Date("9999-12-31T23:59:59.999Z");
            const createdInRange = (0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(db_1.schema.orders.createdAt, start), (0, drizzle_orm_1.lte)(db_1.schema.orders.createdAt, end));
            const scheduledInRange = (0, drizzle_orm_1.and)((0, drizzle_orm_1.gte)(db_1.schema.orders.scheduledFor, start), (0, drizzle_orm_1.lte)(db_1.schema.orders.scheduledFor, end));
            const inRange = (0, drizzle_orm_1.or)(createdInRange, scheduledInRange);
            const looksLikeRef = /^(WP-|INV-|ORD-|TX-|WEB-|DI-|#)/i.test(q) ||
                /^\d{1,6}$/.test(bareQ) ||
                q.replace(/[^A-Za-z0-9-]/g, "").length >= 8;
            if (searchCond && looksLikeRef) {
                conditions.push((0, drizzle_orm_1.or)(inRange, searchCond));
            }
            else if (searchCond) {
                conditions.push((0, drizzle_orm_1.and)(inRange, searchCond));
            }
            else {
                conditions.push(inRange);
            }
        }
        else if (searchCond) {
            conditions.push(searchCond);
        }
        const rows = await db.query.orders.findMany({
            where: (0, drizzle_orm_1.and)(...conditions),
            with: {
                items: {
                    with: { product: true },
                },
                customer: true,
            },
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.orders.createdAt)],
            limit,
        });
        const orderIds = rows.map((o) => o.id);
        const assignedIds = [
            ...new Set(rows.map((r) => r.assignedDeliveryStaffId).filter(Boolean)),
        ];
        const driverNameById = new Map();
        if (assignedIds.length) {
            const drivers = await db.query.merchantStaff.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchantStaff.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.merchantStaff.id, assignedIds)),
                columns: { id: true, name: true },
            });
            for (const d of drivers)
                driverNameById.set(d.id, d.name);
        }
        const refundsByOrder = new Map();
        if (orderIds.length) {
            try {
                const refundRows = await db.query.orderRefunds.findMany({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orderRefunds.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.orderRefunds.orderId, orderIds)),
                    orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.orderRefunds.createdAt)],
                });
                for (const rf of refundRows) {
                    const list = refundsByOrder.get(rf.orderId) || [];
                    list.push({
                        id: rf.id,
                        kind: rf.kind,
                        amount: Number(rf.amount),
                        reason: rf.reason || null,
                        staffName: rf.staffName || null,
                        items: rf.itemsJson || [],
                        allocation: rf.allocationJson || null,
                        createdAt: rf.createdAt?.toISOString?.() ?? null,
                    });
                    refundsByOrder.set(rf.orderId, list);
                }
            }
            catch {
                /* table may not exist yet on older DBs */
            }
        }
        return rows.map((o) => {
            const notes = String(o.notes || "");
            const ticketMatch = notes.match(/\[ticket:([^\]]+)\]/i);
            const tabMatch = notes.match(/\[tab:([^\]]+)\]/i);
            let ticketDisplay = ticketMatch?.[1]?.trim() || null;
            if (ticketDisplay && !ticketDisplay.startsWith("#")) {
                ticketDisplay = `#${ticketDisplay.replace(/^#/, "")}`;
            }
            const tabNumber = tabMatch?.[1]?.trim() ||
                (o.guestCount != null && Number(o.guestCount) > 0 ? String(o.guestCount) : null);
            return {
                id: o.id,
                orderNumber: o.orderNumber,
                clientId: o.clientId,
                orderType: o.orderType,
                orderSource: o.orderSource,
                externalOrderId: o.externalOrderId,
                status: o.status,
                channel: o.fulfillmentChannel,
                paymentMethod: o.paymentMethod,
                paymentBreakdown: o.paymentBreakdown ?? null,
                paymentStatus: o.paymentStatus,
                invoiceNumber: o.invoiceNumber || null,
                invoiceIssuedAt: o.invoiceIssuedAt || null,
                invoiceDueAt: o.invoiceDueAt || null,
                subtotal: Number(o.subtotal),
                taxAmount: Number(o.taxAmount),
                discountAmount: Number(o.discountAmount || 0),
                tipAmount: Number(o.tipAmount || 0),
                roundingAmount: Number(o.roundingAmount || 0),
                total: Number(o.total),
                refundAmount: Number(o.refundAmount || 0),
                cancelReason: o.cancelReason,
                cancelledAt: o.cancelledAt,
                refundedAt: o.refundedAt,
                refundReason: o.refundReason || null,
                refundHistory: refundsByOrder.get(o.id) || [],
                notes: o.notes,
                tableLabel: o.tableLabel,
                guestCount: o.guestCount,
                ticketDisplay,
                tabNumber,
                staffName: o.staffName,
                assignedDeliveryStaffId: o.assignedDeliveryStaffId || null,
                assignedDriverName: o.assignedDeliveryStaffId
                    ? driverNameById.get(o.assignedDeliveryStaffId) || null
                    : null,
                masterOrderId: o.masterOrderId,
                splitCheckNumber: o.splitCheckNumber,
                customerName: resolveOrderCustomerName(o),
                pointsEarned: o.pointsEarned ?? 0,
                pointsRedeemed: o.pointsRedeemed ?? 0,
                customerPhone: o.customerPhone,
                shippingAddress: o.shippingAddress,
                deliveryLatitude: o.deliveryLatitude != null && o.deliveryLatitude !== ""
                    ? Number(o.deliveryLatitude)
                    : null,
                deliveryLongitude: o.deliveryLongitude != null && o.deliveryLongitude !== ""
                    ? Number(o.deliveryLongitude)
                    : null,
                deliveryTrackingToken: o.deliveryTrackingToken || null,
                scheduledFor: o.scheduledFor,
                createdAt: o.createdAt,
                completedAt: o.completedAt,
                adyenReference: o.adyenReference ?? null,
                adyenCustomerReceiptJson: o.adyenCustomerReceiptJson ?? null,
                adyenCashierReceiptJson: o.adyenCashierReceiptJson ?? null,
                items: (o.items || []).map((i) => {
                    const name = (0, order_item_name_1.resolveOrderItemName)(i.productName, i.product?.name);
                    return {
                        id: i.id,
                        productId: i.productId,
                        categoryId: i.product?.categoryId || null,
                        name,
                        productName: name,
                        quantity: Number(i.quantity),
                        unitPrice: Number(i.unitPrice),
                        totalPrice: Number(i.totalPrice),
                        refundedQuantity: Number(i.refundedQuantity || 0),
                        selectedExtras: i.selectedExtras || [],
                        comboSelections: i.comboSelections || [],
                    };
                }),
            };
        });
    }
    static async cancelOrder(merchantId, orderId, reason) {
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
        });
        if (!order)
            throw new Error("Order not found");
        if (order.status === "cancelled")
            throw new Error("Order already cancelled");
        if (order.status === "refunded")
            throw new Error("Order already refunded");
        const payStatus = String(order.paymentStatus || "").toLowerCase();
        const awaitingPayment = payStatus === "awaiting_payment" ||
            String(order.paymentMethod || "").toLowerCase().replace(/-/g, "_") === "pay_later";
        if (!awaitingPayment &&
            (BLOCKED_CANCEL_STATUSES.has(String(order.status)) ||
                COMPLETED_STATUSES.has(payStatus))) {
            throw new Error("Completed orders cannot be cancelled. Change the payment method or issue a refund.");
        }
        const reasonText = (0, pos_print_settings_1.resolvePosCancelReason)(reason);
        if (!reasonText)
            throw new Error("Cancel reason is required");
        const [updated] = await db
            .update(db_1.schema.orders)
            .set({
            status: "cancelled",
            paymentStatus: "cancelled",
            cancelReason: reasonText,
            cancelledAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId))
            .returning();
        void Promise.resolve().then(() => __importStar(require("@/services/ods.service"))).then(({ OdsService }) => OdsService.syncFromOrder(merchantId, {
            orderNumber: updated.orderNumber,
            notes: updated.notes,
            status: "cancelled",
        }))
            .catch(() => { });
        return updated;
    }
    static async updatePaymentMethod(merchantId, orderId, paymentMethod) {
        const db = (0, db_1.getDb)();
        let method = String(paymentMethod || "")
            .trim()
            .toLowerCase()
            .replace(/-/g, "_");
        if (!ALLOWED_PAYMENT_METHODS.has(method)) {
            throw new Error("Invalid payment method");
        }
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
        });
        if (!order)
            throw new Error("Order not found");
        const existingMethod = String(order.paymentMethod || "")
            .toLowerCase()
            .replace(/-/g, "_");
        if (existingMethod === "invoice" || order.invoiceNumber) {
            if (method !== "invoice" && method !== "bank_transfer" && method !== "bank") {
                throw new Error("Invoice orders can only be paid by invoice / bank transfer");
            }
            method = "invoice";
        }
        if (order.status === "cancelled" || order.paymentStatus === "cancelled") {
            throw new Error("Cannot change payment method on a cancelled order");
        }
        if (order.status === "refunded" || order.paymentStatus === "refunded") {
            throw new Error("Cannot change payment method on a refunded order");
        }
        if (!COMPLETED_STATUSES.has(String(order.status)) &&
            !COMPLETED_STATUSES.has(String(order.paymentStatus || ""))) {
            throw new Error("Only completed orders can change payment method");
        }
        const [updated] = await db
            .update(db_1.schema.orders)
            .set({ paymentMethod: method })
            .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId))
            .returning();
        return updated;
    }
    static async refundOrder(merchantId, orderId, opts = {}) {
        const db = (0, db_1.getDb)();
        const reasonText = (0, pos_print_settings_1.resolvePosRefundReason)(String(opts.reason || ""));
        if (!reasonText)
            throw new Error("Refund reason is required");
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
            with: { items: true },
        });
        if (!order)
            throw new Error("Order not found");
        if (order.status === "cancelled")
            throw new Error("Cannot refund a cancelled order");
        const total = Number(order.total) || 0;
        const already = Number(order.refundAmount || 0) || 0;
        const remaining = (0, money_1.roundMoney2)(total - already);
        if (remaining <= 0)
            throw new Error("Nothing left to refund");
        let refund = 0;
        const itemUpdates = [];
        if (opts.fullTicket || (!opts.items?.length && opts.amount == null)) {
            refund = remaining;
            for (const item of order.items || []) {
                const qty = Number(item.quantity) || 0;
                itemUpdates.push({ id: item.id, refundedQuantity: qty.toFixed(3) });
            }
        }
        else if (opts.items?.length) {
            const byId = new Map((order.items || []).map((i) => [i.id, i]));
            for (const sel of opts.items) {
                const item = byId.get(String(sel.orderItemId || ""));
                if (!item)
                    throw new Error("Refund item not found on this order");
                const qty = Number(item.quantity) || 0;
                const alreadyQty = Number(item.refundedQuantity || 0) || 0;
                const left = Math.max(0, qty - alreadyQty);
                const take = (0, money_1.roundMoney2)(Number(sel.quantity));
                if (!Number.isFinite(take) || take <= 0)
                    throw new Error("Invalid refund item quantity");
                if (take > left + 0.0005)
                    throw new Error("Refund quantity exceeds remaining item quantity");
                const unit = qty > 0 ? Number(item.totalPrice) / qty : 0;
                refund = (0, money_1.roundMoney2)(refund + unit * take);
                itemUpdates.push({
                    id: item.id,
                    refundedQuantity: (alreadyQty + take).toFixed(3),
                });
            }
            if (refund > remaining + 0.001)
                refund = remaining;
        }
        else {
            refund = (0, money_1.roundMoney2)(Number(opts.amount));
            if (!Number.isFinite(refund) || refund <= 0)
                throw new Error("Invalid refund amount");
        }
        if (refund > remaining + 0.001)
            throw new Error("Refund exceeds remaining amount");
        if (refund <= 0)
            throw new Error("Invalid refund amount");
        const tenders = (0, payment_breakdown_1.parsePaymentBreakdown)(order.paymentBreakdown, order.paymentMethod, total);
        const refundDelta = (0, payment_breakdown_1.refundDeltaGiftFirst)(already, refund, tenders);
        const terminalRefundAmount = refundDelta.terminal;
        let terminalRefundRef = null;
        if (terminalRefundAmount > 0.001) {
            let poiTxId = String(order.adyenReference || "").trim();
            let poiTs = order.adyenPoiTransactionTs instanceof Date
                ? order.adyenPoiTransactionTs.toISOString()
                : order.adyenPoiTransactionTs
                    ? String(order.adyenPoiTransactionTs)
                    : "";
            if (!poiTxId || !poiTs) {
                const captureTx = await db.query.paymentTransactions.findFirst({
                    where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.paymentTransactions.orderId, orderId), (0, drizzle_orm_1.eq)(db_1.schema.paymentTransactions.merchantId, merchantId)),
                    orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.paymentTransactions.createdAt)],
                });
                poiTxId = String(captureTx?.adyenReference || poiTxId).trim();
                poiTs =
                    captureTx?.adyenPoiTransactionTs instanceof Date
                        ? captureTx.adyenPoiTransactionTs.toISOString()
                        : captureTx?.adyenPoiTransactionTs
                            ? String(captureTx.adyenPoiTransactionTs)
                            : poiTs;
            }
            if (!poiTxId || !poiTs) {
                throw new Error("Cannot refund to card: original Adyen terminal transaction reference is missing on this order.");
            }
            const terminalResult = await adyen_terminal_poi_service_1.AdyenTerminalPoiService.processTerminalRefund(merchantId, terminalRefundAmount, {
                originalPoiTransactionId: poiTxId,
                originalPoiTransactionTimestamp: poiTs,
                currency: "CHF",
            });
            if (terminalResult.status !== "approved") {
                throw new Error(terminalResult.message || `Adyen terminal refund failed (${terminalResult.status})`);
            }
            terminalRefundRef = terminalResult.reference || poiTxId;
            try {
                await adyen_service_1.AdyenService.recordPaymentTransaction(merchantId, orderId, -terminalRefundAmount, "refund", terminalRefundRef || `refund-${Date.now()}`, "completed");
            }
            catch (logErr) {
                console.warn("Terminal refund approved but transaction log failed:", logErr);
            }
        }
        const newRefundTotal = (0, money_1.roundMoney2)(already + refund);
        const fully = newRefundTotal >= total - 0.001;
        for (const u of itemUpdates) {
            await db
                .update(db_1.schema.orderItems)
                .set({ refundedQuantity: u.refundedQuantity })
                .where((0, drizzle_orm_1.eq)(db_1.schema.orderItems.id, u.id));
        }
        const giftRestore = refundDelta.giftCard;
        if (giftRestore > 0.001) {
            const redeemTx = await db.query.giftCardTransactions.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.giftCardTransactions.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.giftCardTransactions.orderId, orderId), (0, drizzle_orm_1.eq)(db_1.schema.giftCardTransactions.transactionType, "redeem")),
            });
            if (redeemTx.length) {
                let left = giftRestore;
                for (const tx of redeemTx) {
                    if (left <= 0.001)
                        break;
                    const redeemed = Number(tx.amount) || 0;
                    if (redeemed <= 0)
                        continue;
                    const restore = (0, money_1.roundMoney2)(Math.min(left, redeemed));
                    if (restore <= 0)
                        continue;
                    try {
                        await gift_card_service_1.GiftCardService.refundToCard(merchantId, {
                            cardId: tx.cardId,
                            amount: restore,
                            orderId,
                        });
                        left = (0, money_1.roundMoney2)(left - restore);
                    }
                    catch (gcErr) {
                        console.warn("Gift card balance restore on refund failed:", gcErr);
                    }
                }
            }
        }
        const [updated] = await db
            .update(db_1.schema.orders)
            .set({
            refundAmount: newRefundTotal.toFixed(2),
            refundedAt: new Date(),
            refundReason: reasonText,
            status: fully ? "refunded" : "partially_refunded",
            paymentStatus: fully ? "refunded" : "partially_refunded",
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId))
            .returning();
        const refundItemsLog = itemUpdates
            .map((u) => {
            const item = (order.items || []).find((i) => i.id === u.id);
            const prevQty = Number(item?.refundedQuantity || 0) || 0;
            const nextQty = Number(u.refundedQuantity) || 0;
            const delta = (0, money_1.roundMoney2)(nextQty - prevQty);
            if (delta <= 0)
                return null;
            return {
                orderItemId: u.id,
                productName: (0, order_item_name_1.resolveOrderItemName)(item?.productName),
                quantity: delta,
            };
        })
            .filter(Boolean);
        try {
            await db.insert(db_1.schema.orderRefunds).values({
                merchantId,
                orderId,
                kind: "referenced",
                amount: refund.toFixed(2),
                reason: reasonText,
                staffId: order.staffId || null,
                staffName: order.staffName || null,
                itemsJson: refundItemsLog.length ? refundItemsLog : null,
                allocationJson: {
                    giftCard: refundDelta.giftCard,
                    cash: refundDelta.cash,
                    terminal: refundDelta.terminal,
                    other: refundDelta.other,
                },
            });
        }
        catch (logErr) {
            console.warn("Refund recorded on order but history log failed:", logErr);
        }
        return {
            order: updated,
            refunded: refund,
            refundTotal: newRefundTotal,
            reason: reasonText,
            allocation: {
                giftCard: refundDelta.giftCard,
                cash: refundDelta.cash,
                terminal: refundDelta.terminal,
                other: refundDelta.other,
            },
            terminalRefund: terminalRefundAmount > 0.001
                ? { approved: true, reference: terminalRefundRef, amount: terminalRefundAmount }
                : undefined,
        };
    }
    /**
     * Goodwill / unreferenced compensation — open amount not capped by order total.
     * May be paid as cash (record only) or via terminal unreferenced refund.
     */
    static async goodwillCompensation(merchantId, orderId, opts) {
        const db = (0, db_1.getDb)();
        const reasonText = (0, pos_print_settings_1.resolvePosRefundReason)(String(opts.reason || ""));
        if (!reasonText)
            throw new Error("Compensation reason is required");
        const amount = (0, money_1.roundMoney2)(Number(opts.amount));
        if (!Number.isFinite(amount) || amount <= 0)
            throw new Error("Invalid compensation amount");
        const method = String(opts.method || "cash").toLowerCase();
        if (method !== "cash" && method !== "terminal") {
            throw new Error("Compensation method must be cash or terminal");
        }
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
        });
        if (!order)
            throw new Error("Order not found");
        let terminalRef = null;
        if (method === "terminal") {
            const terminalResult = await adyen_terminal_poi_service_1.AdyenTerminalPoiService.processUnreferencedTerminalRefund(merchantId, amount, { currency: "CHF" });
            if (terminalResult.status !== "approved") {
                throw new Error(terminalResult.message || `Adyen terminal compensation failed (${terminalResult.status})`);
            }
            terminalRef = terminalResult.reference || null;
            try {
                await adyen_service_1.AdyenService.recordPaymentTransaction(merchantId, orderId, -amount, "goodwill", terminalRef || `goodwill-${Date.now()}`, "completed");
            }
            catch (logErr) {
                console.warn("Goodwill terminal approved but transaction log failed:", logErr);
            }
        }
        const already = Number(order.goodwillAmount || 0) || 0;
        const newGoodwillTotal = (0, money_1.roundMoney2)(already + amount);
        const [updated] = await db
            .update(db_1.schema.orders)
            .set({
            goodwillAmount: newGoodwillTotal.toFixed(2),
            refundReason: reasonText,
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId))
            .returning();
        try {
            await db.insert(db_1.schema.orderRefunds).values({
                merchantId,
                orderId,
                kind: "goodwill",
                amount: amount.toFixed(2),
                reason: reasonText,
                staffId: order.staffId || null,
                staffName: order.staffName || null,
                itemsJson: null,
                allocationJson: method === "terminal"
                    ? { terminal: amount }
                    : { cash: amount },
            });
        }
        catch (logErr) {
            console.warn("Goodwill recorded but history log failed:", logErr);
        }
        return {
            order: updated,
            compensated: amount,
            goodwillTotal: newGoodwillTotal,
            reason: reasonText,
            method,
            terminalReference: terminalRef,
        };
    }
    static async listHeld(merchantId) {
        const db = (0, db_1.getDb)();
        const rows = await db.query.heldOrders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.heldOrders.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.heldOrders.status, ["held", "sent_to_kitchen"])),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.heldOrders.updatedAt)],
        });
        console.info("[pos-held] list", {
            merchantId,
            count: rows.length,
            tickets: rows.map((r) => {
                const ident = heldIdentity(r.cartJson);
                return {
                    id: r.id,
                    status: r.status,
                    channel: r.channel,
                    ticket: ident.ticketDisplay,
                    tableId: ident.tableId,
                    tab: ident.tabNumber,
                };
            }),
        });
        return rows;
    }
    static async holdOrder(merchantId, body) {
        const db = (0, db_1.getDb)();
        if (body.cartJson == null)
            throw new Error("cartJson is required");
        const ident = heldIdentity(body.cartJson);
        const requested = String(body.channel || "").toLowerCase();
        const persistChannel = ident.tableId
            ? "dine_in"
            : requested === "dine_in" || requested === "delivery" || requested === "takeaway"
                ? requested
                : "takeaway";
        const status = body.sendToKitchen ? "sent_to_kitchen" : "held";
        const values = {
            label: (body.label || "").trim().slice(0, 120) || null,
            status,
            channel: persistChannel,
            cartJson: body.cartJson,
            notes: body.notes || null,
            staffId: body.staffId || null,
            staffName: body.staffName || null,
            updatedAt: new Date(),
        };
        const open = await db.query.heldOrders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.heldOrders.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.heldOrders.status, ["held", "sent_to_kitchen"])),
        });
        const existing = (body.id && open.find((r) => r.id === body.id)) ||
            open.find((r) => sameHeldIdentity(heldIdentity(r.cartJson), ident));
        if (existing) {
            const [row] = await db
                .update(db_1.schema.heldOrders)
                .set(values)
                .where((0, drizzle_orm_1.eq)(db_1.schema.heldOrders.id, existing.id))
                .returning();
            console.info("[pos-held] upsert-update", {
                merchantId,
                id: existing.id,
                status,
                channel: persistChannel,
                ticket: ident.ticketDisplay,
                tableId: ident.tableId,
            });
            return row;
        }
        const [row] = await db
            .insert(db_1.schema.heldOrders)
            .values({
            merchantId,
            ...values,
        })
            .returning();
        console.info("[pos-held] upsert-insert", {
            merchantId,
            id: row.id,
            status,
            channel: persistChannel,
            ticket: ident.ticketDisplay,
            tableId: ident.tableId,
        });
        return row;
    }
    static async deleteHeld(merchantId, id) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.heldOrders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.heldOrders.id, id), (0, drizzle_orm_1.eq)(db_1.schema.heldOrders.merchantId, merchantId)),
        });
        if (!existing)
            throw new Error("Held order not found");
        await db.delete(db_1.schema.heldOrders).where((0, drizzle_orm_1.eq)(db_1.schema.heldOrders.id, id));
        return { ok: true };
    }
    /**
     * Remove open held rows after payment — matches ticket #, table, or tab identity.
     * Used by POS checkout (staff may lack CANCEL_ORDERS) and server-side sale sync.
     */
    static async releaseHeldByIdentity(merchantId, opts) {
        const db = (0, db_1.getDb)();
        const target = heldIdentity({
            ticketDisplay: opts.ticketDisplay,
            tableId: opts.tableId,
            tabNumber: opts.tabNumber,
        });
        const hasTarget = !!target.ticketDisplay || !!target.tableId || !!target.tabNumber || !!opts.heldId;
        if (!hasTarget)
            return { released: 0 };
        const open = await db.query.heldOrders.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.heldOrders.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.heldOrders.status, ["held", "sent_to_kitchen"])),
        });
        const toDelete = new Set();
        if (opts.heldId)
            toDelete.add(opts.heldId);
        for (const row of open) {
            if (sameHeldIdentity(heldIdentity(row.cartJson), target)) {
                toDelete.add(row.id);
            }
        }
        for (const id of toDelete) {
            await db
                .delete(db_1.schema.heldOrders)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.heldOrders.id, id), (0, drizzle_orm_1.eq)(db_1.schema.heldOrders.merchantId, merchantId)));
        }
        if (toDelete.size) {
            console.info("[pos-held] release", {
                merchantId,
                released: toDelete.size,
                ticket: target.ticketDisplay,
                tableId: target.tableId,
                tab: target.tabNumber,
            });
        }
        return { released: toDelete.size };
    }
    /**
     * Cancel a held / kitchen-sent order with a required reason.
     * Records a cancelled POS sale for EOD and sales reports, then removes the hold.
     */
    static async cancelHeld(merchantId, id, reason) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.heldOrders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.heldOrders.id, id), (0, drizzle_orm_1.eq)(db_1.schema.heldOrders.merchantId, merchantId)),
        });
        if (!existing)
            throw new Error("Held order not found");
        const reasonText = (0, pos_print_settings_1.resolvePosCancelReason)(reason);
        if (!reasonText)
            throw new Error("Cancel reason is required");
        const { lines, channel, tableLabel, notes } = parseHeldCart(existing.cartJson);
        if (!lines.length) {
            await db.delete(db_1.schema.heldOrders).where((0, drizzle_orm_1.eq)(db_1.schema.heldOrders.id, id));
            return { ok: true, order: null, heldStatus: existing.status };
        }
        let subtotal = 0;
        for (const line of lines) {
            subtotal += Number(line.lineTotal || 0);
        }
        subtotal = (0, money_1.roundMoney2)(subtotal);
        const orderNumber = `CXL-${Date.now().toString(36).toUpperCase()}-${Math.random()
            .toString(36)
            .slice(2, 6)
            .toUpperCase()}`.slice(0, 50);
        const clientId = `cancel-held-${existing.id}`.slice(0, 64);
        const now = new Date();
        const [order] = await db
            .insert(db_1.schema.orders)
            .values({
            merchantId,
            orderNumber,
            orderType: "pos",
            fulfillmentChannel: existing.channel || channel || "takeaway",
            status: "cancelled",
            subtotal: subtotal.toFixed(2),
            taxAmount: "0.00",
            discountAmount: "0.00",
            tipAmount: "0.00",
            roundingAmount: "0.00",
            total: subtotal.toFixed(2),
            paymentMethod: null,
            paymentStatus: "cancelled",
            notes: notes || existing.notes || null,
            tableLabel: tableLabel || null,
            staffName: existing.staffName || null,
            clientId,
            cancelReason: reasonText,
            cancelledAt: now,
            completedAt: null,
            syncedAt: now,
        })
            .returning();
        for (const line of lines) {
            const qty = Number(line.quantity) || 1;
            const totalPrice = (0, money_1.roundMoney2)(Number(line.lineTotal || 0));
            const unitPrice = (0, money_1.roundMoney2)(Number(line.unitPrice != null ? line.unitPrice : qty ? totalPrice / qty : 0));
            await db.insert(db_1.schema.orderItems).values({
                orderId: order.id,
                productId: null,
                productName: (0, order_item_name_1.resolveOrderItemName)(line.name),
                quantity: String(qty),
                unitPrice: unitPrice.toFixed(2),
                totalPrice: totalPrice.toFixed(2),
                taxAmount: "0.00",
                selectedExtras: Array.isArray(line.selectedExtras) ? line.selectedExtras : [],
                comboSelections: Array.isArray(line.comboSelections) ? line.comboSelections : [],
                isOpenPrice: !!line.isOpenPrice,
            });
        }
        await db.delete(db_1.schema.heldOrders).where((0, drizzle_orm_1.eq)(db_1.schema.heldOrders.id, id));
        return { ok: true, order, heldStatus: existing.status, cancelReason: reasonText };
    }
    static async resumeHeld(merchantId, id) {
        const db = (0, db_1.getDb)();
        const existing = await db.query.heldOrders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.heldOrders.id, id), (0, drizzle_orm_1.eq)(db_1.schema.heldOrders.merchantId, merchantId)),
        });
        if (!existing)
            throw new Error("Held order not found");
        await db.delete(db_1.schema.heldOrders).where((0, drizzle_orm_1.eq)(db_1.schema.heldOrders.id, id));
        return existing;
    }
}
exports.PosOrdersService = PosOrdersService;
//# sourceMappingURL=pos-orders.service.js.map