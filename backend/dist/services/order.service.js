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
exports.OrderService = void 0;
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const uuid_1 = require("uuid");
const money_1 = require("@/lib/money");
const tax_discount_1 = require("@/lib/tax-discount");
const order_item_name_1 = require("@/lib/order-item-name");
const pos_print_settings_1 = require("@/lib/pos-print-settings");
const TICKET_NOTE_RE = /\[ticket:([^\]]+)\]/i;
const TAB_NOTE_RE = /\[tab:([^\]]+)\]/i;
async function releaseHeldAfterPosPayment(merchantId, order) {
    try {
        const ticketMatch = String(order.notes || "").match(TICKET_NOTE_RE);
        const tabMatch = String(order.notes || "").match(TAB_NOTE_RE);
        const { PosOrdersService } = await Promise.resolve().then(() => __importStar(require("@/services/pos-orders.service")));
        await PosOrdersService.releaseHeldByIdentity(merchantId, {
            ticketDisplay: ticketMatch?.[1]?.trim() || null,
            tabNumber: tabMatch?.[1]?.trim() ||
                (order.guestCount != null && Number(order.guestCount) > 0
                    ? String(order.guestCount)
                    : null),
            tableId: order.tableId || null,
        });
    }
    catch (err) {
        console.warn("Held release after payment failed:", err);
    }
    if (order.tableId) {
        try {
            const { FloorPlanService } = await Promise.resolve().then(() => __importStar(require("@/services/floor-plan.service")));
            await FloorPlanService.setTableStatus(merchantId, order.tableId, "available", null);
        }
        catch {
            /* table may have been removed */
        }
    }
}
function computeEstimatedReadyAt(order, merchant) {
    if (order.scheduledFor) {
        return new Date(order.scheduledFor);
    }
    const channel = order.fulfillmentChannel || "takeaway";
    const prepMinutes = channel === "delivery"
        ? Number(merchant.deliveryEtaMinutes ?? 45)
        : Number(merchant.pickupEtaMinutes ?? 25);
    return new Date(Date.now() + prepMinutes * 60 * 1000);
}
function isInvoiceOrderRecord(order) {
    const method = String(order.paymentMethod || "")
        .toLowerCase()
        .replace(/-/g, "_");
    return method === "invoice" || !!order.invoiceNumber;
}
function isCounterTender(method) {
    const m = String(method || "")
        .trim()
        .toLowerCase()
        .replace(/-/g, "_");
    return m === "cash" || m === "card" || m === "terminal";
}
function resolveCollectPaymentMethod(requested, order) {
    const requestedRaw = String(requested || "")
        .trim()
        .toLowerCase()
        .replace(/-/g, "_");
    if (isInvoiceOrderRecord(order)) {
        if (isCounterTender(requestedRaw))
            return requestedRaw;
        return "invoice";
    }
    const requestedLater = requestedRaw.match(/^pay_later[:_](.+)$/);
    const existingRaw = String(order.paymentMethod || "cash")
        .trim()
        .toLowerCase()
        .replace(/-/g, "_");
    const wasPayLater = existingRaw === "pay_later" ||
        existingRaw === "pay-later" ||
        existingRaw.startsWith("pay_later:");
    const tender = requestedLater?.[1]
        || (["cash", "card", "terminal", "bank_transfer"].includes(requestedRaw) ? requestedRaw : "")
        || (wasPayLater ? "cash" : "")
        || (["cash", "card", "terminal", "bank_transfer"].includes(existingRaw) ? existingRaw : "")
        || "cash";
    if (wasPayLater && tender !== "bank_transfer") {
        return `pay_later:${tender}`;
    }
    return tender;
}
function usesExternalKitchenLifecycle(order) {
    const t = String(order.orderType || "").toLowerCase();
    const src = String(order.orderSource || "").toLowerCase();
    const ch = String(order.fulfillmentChannel || "").toLowerCase();
    return (t === "web_shop" ||
        t === "online" ||
        src === "online_shop" ||
        src === "justeat" ||
        src === "ubereats" ||
        ch.includes("uber") ||
        ch.includes("justeat") ||
        ch.includes("just-eat") ||
        ch.includes("doordash") ||
        ch.includes("deliveroo") ||
        ch === "web_shop" ||
        ch === "online");
}
async function enqueueOnlineOrderReceiptPrint(merchantId, orderId, order) {
    const { DeliveryPlatformService } = await Promise.resolve().then(() => __importStar(require("@/services/delivery-platform.service")));
    const source = order.orderSource === "justeat" || order.orderSource === "ubereats"
        ? order.orderSource
        : "online_shop";
    const isDelivery = order.fulfillmentChannel === "delivery";
    await DeliveryPlatformService.enqueueAutoPrint(merchantId, orderId, source, {
        printKitchen: false,
        printNotification: !isDelivery,
        printDeliveryReceipt: isDelivery,
        printReceipt: !isDelivery,
    });
}
async function sendOrderRejectedEmail(merchantId, order, merchantName) {
    const email = String(order.customerEmail || "").trim();
    if (!email)
        return;
    try {
        const { EmailService } = await Promise.resolve().then(() => __importStar(require("@/services/email.service")));
        const reason = String(order.cancelReason || "").trim();
        await EmailService.send({
            merchantId,
            to: email,
            subject: `Order ${order.orderNumber || ""} — update from ${merchantName}`,
            html: `<p>Hello${order.customerName ? ` ${order.customerName}` : ""},</p>
<p>We regret to inform you that your order <strong>${order.orderNumber || ""}</strong> could not be accepted.</p>
${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
<p>Please contact us if you have questions.</p>
<p>— ${merchantName}</p>`,
            text: `Your order ${order.orderNumber || ""} could not be accepted.${reason ? ` Reason: ${reason}` : ""} — ${merchantName}`,
            emailType: "shop_order",
        });
    }
    catch (err) {
        console.warn("Order rejection email failed:", err);
    }
}
async function sendGuestShopOrderEmail(merchantId, orderId, kind, order) {
    if (String(order.orderType || "").toLowerCase() !== "web_shop" || !order.customerEmail)
        return;
    try {
        const { ShopOrderEmailService } = await Promise.resolve().then(() => __importStar(require("@/services/shop-order-email.service")));
        await ShopOrderEmailService.sendGuestOrderEmail(merchantId, orderId, kind);
    }
    catch (err) {
        console.warn(`Shop order ${kind} email failed:`, err);
    }
}
function withResolvedItemNames(order) {
    if (!order?.items?.length)
        return order;
    return {
        ...order,
        items: order.items.map((item) => ({
            ...item,
            productName: (0, order_item_name_1.resolveOrderItemName)(item.productName, item.product?.name),
            comboSelections: Array.isArray(item.comboSelections)
                ? item.comboSelections.map((c) => ({
                    ...c,
                    productName: (0, order_item_name_1.resolveOrderItemName)(c.productName),
                }))
                : item.comboSelections,
        })),
    };
}
async function withGiftCardRemainingBalance(order) {
    const db = (0, db_1.getDb)();
    const redeemTx = await db.query.giftCardTransactions.findFirst({
        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.giftCardTransactions.orderId, order.id), (0, drizzle_orm_1.eq)(db_1.schema.giftCardTransactions.transactionType, "redeem")),
        orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.giftCardTransactions.createdAt)],
        columns: { balanceAfter: true },
    });
    const fromTx = redeemTx?.balanceAfter != null ? Number(redeemTx.balanceAfter) : null;
    const fromNotes = String(order.notes || "").match(/Gift card remaining:\s*([\d.]+)/i)?.[1];
    const parsedNotes = fromNotes != null && Number.isFinite(Number(fromNotes))
        ? Number(fromNotes)
        : null;
    const giftCardRemainingBalance = fromTx != null && Number.isFinite(fromTx)
        ? fromTx
        : parsedNotes != null
            ? parsedNotes
            : null;
    return {
        ...order,
        giftCardRemainingBalance,
    };
}
class OrderService {
    /**
     * Create order
     */
    static async createOrder(merchantId, items, customerId, orderType = "pos", paymentMethod, discountAmount = 0, notes) {
        const db = (0, db_1.getDb)();
        try {
            const merchant = await db.query.merchants.findFirst({
                where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            });
            const vatRate = merchant?.vatRate ? parseFloat(merchant.vatRate.toString()) : 0;
            const taxDiscountOpts = {
                taxIncludedInPrice: merchant?.taxIncludedInPrice === true,
                vatAfterDiscount: merchant?.vatAfterDiscount !== false,
            };
            // Calculate totals
            let subtotal = 0;
            let taxAmount = 0;
            for (const item of items) {
                const product = await db.query.products.findFirst({
                    where: (0, drizzle_orm_1.eq)(db_1.schema.products.id, item.productId),
                });
                if (!product) {
                    throw new Error(`Product ${item.productId} not found`);
                }
                const itemTotal = (0, money_1.roundMoney2)(item.unitPrice * item.quantity);
                subtotal += itemTotal;
                if (product.isTaxable) {
                    taxAmount += (0, money_1.roundMoney2)((itemTotal * vatRate) / 100);
                }
            }
            subtotal = (0, money_1.roundMoney2)(subtotal);
            taxAmount = (0, money_1.roundMoney2)(taxAmount);
            discountAmount = (0, money_1.roundMoney2)(discountAmount);
            taxAmount = (0, tax_discount_1.adjustTaxForOrderDiscount)(taxAmount, subtotal, discountAmount, taxDiscountOpts);
            const total = (0, money_1.roundTo005)(subtotal + taxAmount - discountAmount);
            // Create order
            const orderNumber = `ORD-${Date.now()}-${(0, uuid_1.v4)().substring(0, 8).toUpperCase()}`;
            const order = await db
                .insert(db_1.schema.orders)
                .values({
                merchantId,
                orderNumber,
                customerId,
                orderType,
                status: "pending",
                subtotal: subtotal.toFixed(2),
                taxAmount: taxAmount.toFixed(2),
                discountAmount: discountAmount.toFixed(2),
                total: total.toFixed(2),
                paymentMethod,
                paymentStatus: "pending",
                notes,
            })
                .returning();
            // Create order items
            for (const item of items) {
                const itemTotal = item.unitPrice * item.quantity;
                const product = await db.query.products.findFirst({
                    where: (0, drizzle_orm_1.eq)(db_1.schema.products.id, item.productId),
                });
                await db.insert(db_1.schema.orderItems).values({
                    orderId: order[0].id,
                    productId: item.productId,
                    productName: (0, order_item_name_1.resolveOrderItemName)(product?.name, item.productName),
                    quantity: item.quantity.toString(),
                    unitPrice: item.unitPrice.toString(),
                    totalPrice: itemTotal.toString(),
                    taxAmount: (itemTotal * 0.1).toString(), // Simplified tax
                });
                // Update product stock
                if (product) {
                    await db
                        .update(db_1.schema.products)
                        .set({ stock: product.stock - item.quantity })
                        .where((0, drizzle_orm_1.eq)(db_1.schema.products.id, item.productId));
                }
            }
            return order[0];
        }
        catch (error) {
            console.error("Error creating order:", error);
            throw error;
        }
    }
    /**
     * Get all orders for merchant
     */
    static async getOrders(merchantId, page = 1, limit = 20, status, startDate, endDate) {
        const db = (0, db_1.getDb)();
        try {
            const offset = (page - 1) * limit;
            let whereConditions = [(0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)];
            if (status) {
                whereConditions.push((0, drizzle_orm_1.eq)(db_1.schema.orders.status, status));
            }
            if (startDate && endDate) {
                whereConditions.push((0, drizzle_orm_1.gte)(db_1.schema.orders.createdAt, startDate));
                whereConditions.push((0, drizzle_orm_1.lte)(db_1.schema.orders.createdAt, endDate));
            }
            const orders = await db.query.orders.findMany({
                where: whereConditions.length > 0 ? (0, drizzle_orm_1.and)(...whereConditions) : undefined,
                with: {
                    items: {
                        with: {
                            product: true,
                        },
                    },
                    customer: true,
                },
                limit,
                offset,
                orderBy: (0, drizzle_orm_1.desc)(db_1.schema.orders.createdAt),
            });
            return orders.map((order) => withResolvedItemNames(order));
        }
        catch (error) {
            console.error("Error getting orders:", error);
            throw error;
        }
    }
    /**
     * Get order by ID
     */
    static async getOrderById(merchantId, orderId) {
        const db = (0, db_1.getDb)();
        try {
            const order = await db.query.orders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
                with: {
                    items: {
                        with: {
                            product: true,
                        },
                    },
                    customer: true,
                    paymentTransactions: true,
                },
            });
            if (!order) {
                throw new Error("Order not found");
            }
            const resolved = withResolvedItemNames(order);
            return await withGiftCardRemainingBalance(resolved);
        }
        catch (error) {
            console.error("Error getting order:", error);
            throw error;
        }
    }
    /**
     * Update order status
     */
    static async updateOrderStatus(merchantId, orderId, status) {
        const db = (0, db_1.getDb)();
        try {
            const updates = { status };
            if (status === "completed") {
                updates.completedAt = new Date();
            }
            const order = await db
                .update(db_1.schema.orders)
                .set(updates)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)))
                .returning();
            if (order.length === 0) {
                throw new Error("Order not found");
            }
            void Promise.resolve().then(() => __importStar(require("@/services/ods.service"))).then(({ OdsService }) => OdsService.syncFromOrder(merchantId, order[0]))
                .catch(() => { });
            return order[0];
        }
        catch (error) {
            console.error("Error updating order:", error);
            throw error;
        }
    }
    /**
     * Online / POS lifecycle actions for web_shop (and optionally POS) orders.
     *
     * Flow:
     *  pending|pending_approval → accept → accepted
     *  accepted → start_preparing → preparing
     *  preparing → mark_ready → ready
     *  ready + delivery → out_for_delivery
     *  collect_payment → paymentStatus completed
     *  complete → completed (pickup/dine_in from ready; delivery from out_for_delivery)
     *  reject → cancelled
     */
    static async applyOrderAction(merchantId, orderId, action, opts) {
        const db = (0, db_1.getDb)();
        const order = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
        });
        if (!order)
            throw new Error("Order not found");
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
            columns: {
                name: true,
                pickupEtaMinutes: true,
                deliveryEtaMinutes: true,
            },
        });
        const status = order.status || "pending";
        const channel = order.fulfillmentChannel || "takeaway";
        const awaitingApproval = status === "pending" || status === "pending_approval";
        const paymentDone = order.paymentStatus === "completed" || order.paymentStatus === "paid";
        const isCash = order.paymentMethod === "cash" ||
            order.paymentMethod === "pay_later" ||
            order.paymentMethod === "pay-later" ||
            order.paymentMethod === "invoice" ||
            order.paymentStatus === "cash" ||
            order.paymentStatus === "awaiting_payment";
        const set = async (patch) => {
            const [updated] = await db
                .update(db_1.schema.orders)
                .set(patch)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)))
                .returning();
            if (updated) {
                void Promise.resolve().then(() => __importStar(require("@/services/ods.service"))).then(({ OdsService }) => OdsService.syncFromOrder(merchantId, updated))
                    .catch(() => { });
            }
            return updated;
        };
        switch (action) {
            case "accept": {
                if (!awaitingApproval)
                    throw new Error("Order is not awaiting approval");
                const estimatedReadyAt = computeEstimatedReadyAt(order, merchant || {});
                const accepted = await set({
                    status: "accepted",
                    estimatedReadyAt,
                });
                if (order.orderSource === "justeat" || order.orderSource === "ubereats") {
                    const { DeliveryPlatformService } = await Promise.resolve().then(() => __importStar(require("@/services/delivery-platform.service")));
                    void DeliveryPlatformService.notifyPartnerOrderAccepted(merchantId, accepted).catch((err) => console.warn("Partner accept callback:", err));
                }
                try {
                    const { DeliveryPlatformService } = await Promise.resolve().then(() => __importStar(require("@/services/delivery-platform.service")));
                    const source = order.orderSource === "justeat" || order.orderSource === "ubereats"
                        ? order.orderSource
                        : "online_shop";
                    await DeliveryPlatformService.enqueueAutoPrint(merchantId, orderId, source, {
                        printKitchen: true,
                        printDeliveryReceipt: false,
                        printReceipt: false,
                        printNotification: false,
                    });
                    await db
                        .update(db_1.schema.orders)
                        .set({ printCount: (0, drizzle_orm_1.sql) `COALESCE(${db_1.schema.orders.printCount}, 0) + 1` })
                        .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId));
                }
                catch (printErr) {
                    console.warn("Accept auto-print enqueue failed:", printErr);
                }
                void Promise.resolve().then(() => __importStar(require("@/services/kitchen-ingress.service"))).then(({ enterKitchenFromOrder }) => enterKitchenFromOrder(merchantId, orderId, {
                    printKitchen: false,
                    orderSource: order.orderSource === "justeat" || order.orderSource === "ubereats"
                        ? order.orderSource
                        : "online_shop",
                }))
                    .catch(() => { });
                void sendGuestShopOrderEmail(merchantId, orderId, "confirmed", order);
                return set({ status: "preparing" });
            }
            case "start_preparing": {
                if (status !== "accepted" && !awaitingApproval) {
                    throw new Error("Order cannot start preparing from current status");
                }
                const updated = await set({ status: "preparing" });
                void Promise.resolve().then(() => __importStar(require("@/services/kitchen-ingress.service"))).then(({ enterKitchenFromOrder }) => enterKitchenFromOrder(merchantId, orderId))
                    .catch(() => { });
                return updated;
            }
            case "mark_ready": {
                if (status !== "preparing" && status !== "accepted") {
                    throw new Error("Order is not being prepared");
                }
                const updated = await set({ status: "ready" });
                void sendGuestShopOrderEmail(merchantId, orderId, "ready", order);
                return updated;
            }
            case "out_for_delivery": {
                if (channel !== "delivery")
                    throw new Error("Only delivery orders can go out for delivery");
                if (status !== "ready")
                    throw new Error("Order must be ready before delivery");
                const updated = await set({ status: "out_for_delivery" });
                if (order.orderType === "web_shop" && order.customerEmail) {
                    try {
                        const { ShopOrderEmailService } = await Promise.resolve().then(() => __importStar(require("@/services/shop-order-email.service")));
                        await ShopOrderEmailService.sendGuestOrderEmail(merchantId, orderId, "out_for_delivery");
                    }
                    catch (emailErr) {
                        console.warn("Out for delivery email failed:", emailErr);
                    }
                }
                return updated;
            }
            case "collect_payment": {
                if (paymentDone)
                    throw new Error("Payment already completed");
                {
                    const invoiceOrder = isInvoiceOrderRecord(order);
                    const method = resolveCollectPaymentMethod(opts?.paymentMethod, order);
                    const closeInternal = !usesExternalKitchenLifecycle(order);
                    const updated = await set({
                        paymentStatus: "completed",
                        paymentMethod: method,
                        ...(closeInternal
                            ? { status: "completed", completedAt: new Date() }
                            : {}),
                        ...(invoiceOrder
                            ? {
                                paymentBreakdown: [
                                    { method, amount: (0, money_1.roundMoney2)(Number(order.total) || 0) },
                                ],
                            }
                            : {}),
                    });
                    try {
                        const { InventoryService } = await Promise.resolve().then(() => __importStar(require("@/services/inventory.service")));
                        await InventoryService.deductForPaidOrder(merchantId, orderId);
                    }
                    catch (invErr) {
                        console.warn("Inventory deduct after collect_payment failed:", invErr);
                    }
                    void releaseHeldAfterPosPayment(merchantId, order);
                    // Invoice A4 at sale — skip auto receipt unless counter cash/card collection.
                    const wasPayLater = /^pay[_-]?later/i.test(String(order.paymentMethod || ""));
                    const invoiceCounter = invoiceOrder && isCounterTender(method);
                    if ((!invoiceOrder || invoiceCounter) && !wasPayLater && !opts?.skipReceiptPrint) {
                        try {
                            await enqueueOnlineOrderReceiptPrint(merchantId, orderId, order);
                        }
                        catch (printErr) {
                            console.warn("Collect payment receipt print enqueue failed:", printErr);
                        }
                    }
                    return updated;
                }
            }
            case "complete": {
                if (channel === "delivery") {
                    if (status !== "out_for_delivery" && status !== "ready") {
                        throw new Error("Delivery order must be out for delivery (or ready) to complete");
                    }
                }
                else if (status !== "ready" && status !== "preparing") {
                    throw new Error("Order must be ready to complete");
                }
                // Cash / pay-later: require payment collection first (unless already paid)
                if (!paymentDone && isCash) {
                    throw new Error("Collect payment before completing this order");
                }
                return set({ status: "completed", completedAt: new Date() });
            }
            case "complete_and_collect": {
                // Ready / out_for_delivery: collect + complete (handoff).
                // Earlier kitchen statuses: staff/admin may collect payment now and
                // leave fulfillment open (POS invoice and online shop pickup).
                const readyToHandoff = status === "ready" || status === "out_for_delivery";
                const collectWhileOpen = status === "preparing" ||
                    status === "accepted" ||
                    status === "sent_to_kitchen" ||
                    status === "completed";
                if (!readyToHandoff && !collectWhileOpen) {
                    throw new Error("Order is not ready to collect payment");
                }
                {
                    const invoiceOrder = isInvoiceOrderRecord(order);
                    const method = resolveCollectPaymentMethod(opts?.paymentMethod, order);
                    const invoiceBreakdown = invoiceOrder
                        ? {
                            paymentBreakdown: [
                                { method, amount: (0, money_1.roundMoney2)(Number(order.total) || 0) },
                            ],
                        }
                        : {};
                    const closeNow = readyToHandoff || !usesExternalKitchenLifecycle(order);
                    const updated = await set(closeNow
                        ? {
                            status: "completed",
                            paymentStatus: "completed",
                            paymentMethod: method,
                            completedAt: new Date(),
                            ...invoiceBreakdown,
                        }
                        : {
                            paymentStatus: "completed",
                            paymentMethod: method,
                            ...invoiceBreakdown,
                        });
                    try {
                        const { InventoryService } = await Promise.resolve().then(() => __importStar(require("@/services/inventory.service")));
                        await InventoryService.deductForPaidOrder(merchantId, orderId);
                    }
                    catch (invErr) {
                        console.warn("Inventory deduct after complete_and_collect failed:", invErr);
                    }
                    void releaseHeldAfterPosPayment(merchantId, order);
                    // Invoice A4 at sale — skip auto receipt unless counter cash/card collection.
                    const wasPayLater = /^pay[_-]?later/i.test(String(order.paymentMethod || ""));
                    const invoiceCounter = invoiceOrder && isCounterTender(method);
                    if ((!invoiceOrder || invoiceCounter) && !wasPayLater && !opts?.skipReceiptPrint) {
                        try {
                            await enqueueOnlineOrderReceiptPrint(merchantId, orderId, order);
                        }
                        catch (printErr) {
                            console.warn("Complete-and-collect receipt print enqueue failed:", printErr);
                        }
                    }
                    return updated;
                }
            }
            case "reject":
            case "cancel": {
                if (status === "completed")
                    throw new Error("Cannot cancel a completed order");
                const reasonText = (0, pos_print_settings_1.resolvePosCancelReason)(String(opts?.rejectReason || ""));
                const updated = await set({
                    status: "cancelled",
                    cancelReason: reasonText || null,
                    cancelledAt: new Date(),
                });
                if (action === "reject") {
                    if (order.orderType === "web_shop" && order.customerEmail) {
                        void sendGuestShopOrderEmail(merchantId, orderId, "cancelled", order);
                    }
                    else {
                        void sendOrderRejectedEmail(merchantId, { ...order, cancelReason: reasonText }, merchant?.name || "Store");
                    }
                }
                else if (order.orderType === "web_shop" && order.customerEmail) {
                    void sendGuestShopOrderEmail(merchantId, orderId, "cancelled", order);
                }
                return updated;
            }
            case "adjust_eta": {
                let next;
                if (opts?.estimatedReadyAt) {
                    next = new Date(opts.estimatedReadyAt);
                }
                else {
                    const adjust = Number(opts?.etaAdjustMinutes || 0);
                    const base = order.estimatedReadyAt ? new Date(order.estimatedReadyAt) : new Date();
                    next = new Date(base.getTime() + adjust * 60 * 1000);
                }
                if (Number.isNaN(next.getTime()))
                    throw new Error("Invalid ETA");
                return set({ estimatedReadyAt: next });
            }
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
    /**
     * Update payment status
     */
    static async updatePaymentStatus(merchantId, orderId, paymentStatus) {
        const db = (0, db_1.getDb)();
        try {
            const order = await db
                .update(db_1.schema.orders)
                .set({ paymentStatus })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)))
                .returning();
            if (order.length === 0) {
                throw new Error("Order not found");
            }
            if (paymentStatus === "completed") {
                try {
                    const { InventoryService } = await Promise.resolve().then(() => __importStar(require("@/services/inventory.service")));
                    await InventoryService.deductForPaidOrder(merchantId, orderId);
                }
                catch (invErr) {
                    console.warn("Inventory deduct after payment status failed:", invErr);
                }
            }
            return order[0];
        }
        catch (error) {
            console.error("Error updating payment status:", error);
            throw error;
        }
    }
    /**
     * Get daily sales
     */
    static async getDailySales(merchantId, date) {
        const db = (0, db_1.getDb)();
        try {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            const orders = await db.query.orders.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.status, "completed"), (0, drizzle_orm_1.gte)(db_1.schema.orders.createdAt, startOfDay), (0, drizzle_orm_1.lte)(db_1.schema.orders.createdAt, endOfDay)),
            });
            const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total.toString()), 0);
            const totalTax = orders.reduce((sum, order) => sum + parseFloat(order.taxAmount.toString()), 0);
            const totalDiscount = orders.reduce((sum, order) => sum + parseFloat(order.discountAmount.toString()), 0);
            return {
                date,
                orderCount: orders.length,
                totalRevenue,
                totalTax,
                totalDiscount,
                netRevenue: totalRevenue - totalDiscount,
            };
        }
        catch (error) {
            console.error("Error getting daily sales:", error);
            throw error;
        }
    }
    /**
     * Get sales by payment method
     */
    static async getSalesByPaymentMethod(merchantId, startDate, endDate) {
        const db = (0, db_1.getDb)();
        try {
            let whereConditions = [
                (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId),
                (0, drizzle_orm_1.eq)(db_1.schema.orders.status, "completed"),
            ];
            if (startDate && endDate) {
                whereConditions.push((0, drizzle_orm_1.gte)(db_1.schema.orders.createdAt, startDate));
                whereConditions.push((0, drizzle_orm_1.lte)(db_1.schema.orders.createdAt, endDate));
            }
            const orders = await db.query.orders.findMany({
                where: (0, drizzle_orm_1.and)(...whereConditions),
            });
            const breakdown = {};
            orders.forEach((order) => {
                const method = order.paymentMethod || "unknown";
                breakdown[method] = (breakdown[method] || 0) + parseFloat(order.total.toString());
            });
            return breakdown;
        }
        catch (error) {
            console.error("Error getting sales by payment method:", error);
            throw error;
        }
    }
    /**
     * Cancel order and restore stock
     */
    static async cancelOrder(merchantId, orderId) {
        const db = (0, db_1.getDb)();
        try {
            const order = await db.query.orders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId), (0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId)),
                with: {
                    items: true,
                },
            });
            if (!order) {
                throw new Error("Order not found");
            }
            // Restore stock
            for (const item of order.items) {
                const product = await db.query.products.findFirst({
                    where: (0, drizzle_orm_1.eq)(db_1.schema.products.id, item.productId),
                });
                if (product) {
                    await db
                        .update(db_1.schema.products)
                        .set({ stock: product.stock + item.quantity })
                        .where((0, drizzle_orm_1.eq)(db_1.schema.products.id, item.productId));
                }
            }
            // Update order status
            const updatedOrder = await db
                .update(db_1.schema.orders)
                .set({ status: "cancelled" })
                .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, orderId))
                .returning();
            return updatedOrder[0];
        }
        catch (error) {
            console.error("Error cancelling order:", error);
            throw error;
        }
    }
}
exports.OrderService = OrderService;
//# sourceMappingURL=order.service.js.map