"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const order_item_name_1 = require("@/lib/order-item-name");
const adyen_receipt_1 = require("@/lib/adyen-receipt");
const merchant_settings_service_1 = require("@/services/merchant-settings.service");
const guest_order_number_1 = require("@/lib/guest-order-number");
const router = (0, express_1.Router)();
/** Any hex UUID (v1–v8), not just RFC 4122 v1–v5. Postgres accepts all of these. */
function isPgUuid(ref) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
}
function lookupWhere(ref) {
    const clauses = [(0, drizzle_orm_1.eq)(db_1.schema.orders.orderNumber, ref), (0, drizzle_orm_1.eq)(db_1.schema.orders.clientId, ref)];
    if (isPgUuid(ref)) {
        clauses.unshift((0, drizzle_orm_1.eq)(db_1.schema.orders.id, ref));
    }
    return (0, drizzle_orm_1.or)(...clauses);
}
/**
 * Public receipt lookup must not SELECT * on merchants/products.
 * Relational `with: { merchant: true, items: { product: true } }` pulls every
 * schema column (signage flags, recipe yield, staff_id, …). If drizzle-kit push
 * lagged, Postgres throws and the page shows "Failed to load receipt" for every QR.
 */
async function findReceiptOrder(ref) {
    const db = (0, db_1.getDb)();
    const where = lookupWhere(ref);
    const rich = () => db
        .select({
        id: db_1.schema.orders.id,
        clientId: db_1.schema.orders.clientId,
        orderNumber: db_1.schema.orders.orderNumber,
        tabNumber: db_1.schema.orders.tabNumber,
        notes: db_1.schema.orders.notes,
        customerName: db_1.schema.orders.customerName,
        fulfillmentChannel: db_1.schema.orders.fulfillmentChannel,
        paymentMethod: db_1.schema.orders.paymentMethod,
        paymentStatus: db_1.schema.orders.paymentStatus,
        status: db_1.schema.orders.status,
        subtotal: db_1.schema.orders.subtotal,
        taxAmount: db_1.schema.orders.taxAmount,
        discountAmount: db_1.schema.orders.discountAmount,
        total: db_1.schema.orders.total,
        tipAmount: db_1.schema.orders.tipAmount,
        roundingAmount: db_1.schema.orders.roundingAmount,
        tableLabel: db_1.schema.orders.tableLabel,
        guestCount: db_1.schema.orders.guestCount,
        completedAt: db_1.schema.orders.completedAt,
        createdAt: db_1.schema.orders.createdAt,
        pointsEarned: db_1.schema.orders.pointsEarned,
        adyenCustomerReceiptJson: db_1.schema.orders.adyenCustomerReceiptJson,
        businessName: db_1.schema.merchants.name,
        address: db_1.schema.merchants.address,
        city: db_1.schema.merchants.city,
        phone: db_1.schema.merchants.phone,
        vatNumber: db_1.schema.merchants.vatNumber,
        vatRate: db_1.schema.merchants.vatRate,
        taxTakeawayRate: db_1.schema.merchants.taxTakeawayRate,
        taxDineInRate: db_1.schema.merchants.taxDineInRate,
        taxDeliveryRate: db_1.schema.merchants.taxDeliveryRate,
        taxIncludedInPrice: db_1.schema.merchants.taxIncludedInPrice,
        vatAfterDiscount: db_1.schema.merchants.vatAfterDiscount,
    })
        .from(db_1.schema.orders)
        .leftJoin(db_1.schema.merchants, (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, db_1.schema.orders.merchantId))
        .where(where)
        .limit(1);
    const minimal = () => db
        .select({
        id: db_1.schema.orders.id,
        clientId: db_1.schema.orders.clientId,
        orderNumber: db_1.schema.orders.orderNumber,
        tabNumber: db_1.schema.orders.tabNumber,
        notes: db_1.schema.orders.notes,
        customerName: db_1.schema.orders.customerName,
        fulfillmentChannel: db_1.schema.orders.fulfillmentChannel,
        paymentMethod: db_1.schema.orders.paymentMethod,
        paymentStatus: db_1.schema.orders.paymentStatus,
        status: db_1.schema.orders.status,
        subtotal: db_1.schema.orders.subtotal,
        taxAmount: db_1.schema.orders.taxAmount,
        discountAmount: db_1.schema.orders.discountAmount,
        total: db_1.schema.orders.total,
        tipAmount: db_1.schema.orders.tipAmount,
        tableLabel: db_1.schema.orders.tableLabel,
        guestCount: db_1.schema.orders.guestCount,
        completedAt: db_1.schema.orders.completedAt,
        createdAt: db_1.schema.orders.createdAt,
        businessName: db_1.schema.merchants.name,
        address: db_1.schema.merchants.address,
        city: db_1.schema.merchants.city,
        phone: db_1.schema.merchants.phone,
        vatNumber: db_1.schema.merchants.vatNumber,
        vatRate: db_1.schema.merchants.vatRate,
    })
        .from(db_1.schema.orders)
        .leftJoin(db_1.schema.merchants, (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, db_1.schema.orders.merchantId))
        .where(where)
        .limit(1);
    try {
        const rows = await rich();
        return rows[0] || null;
    }
    catch (err) {
        console.warn("[receipts] rich order query failed, using minimal columns:", err);
        const rows = await minimal();
        const row = rows[0];
        if (!row)
            return null;
        return {
            ...row,
            roundingAmount: null,
            pointsEarned: null,
            adyenCustomerReceiptJson: null,
            taxTakeawayRate: null,
            taxDineInRate: null,
            taxDeliveryRate: null,
            taxIncludedInPrice: null,
            vatAfterDiscount: null,
        };
    }
}
async function findReceiptByKitchenShout(ref) {
    const shout = ref.replace(/^#/, "").trim();
    if (!shout || shout.length > 40 || isPgUuid(ref))
        return null;
    const db = (0, db_1.getDb)();
    try {
        const rows = await db
            .select({
            id: db_1.schema.orders.id,
            clientId: db_1.schema.orders.clientId,
            orderNumber: db_1.schema.orders.orderNumber,
        tabNumber: db_1.schema.orders.tabNumber,
            notes: db_1.schema.orders.notes,
            customerName: db_1.schema.orders.customerName,
            fulfillmentChannel: db_1.schema.orders.fulfillmentChannel,
            paymentMethod: db_1.schema.orders.paymentMethod,
            paymentStatus: db_1.schema.orders.paymentStatus,
            status: db_1.schema.orders.status,
            subtotal: db_1.schema.orders.subtotal,
            taxAmount: db_1.schema.orders.taxAmount,
            discountAmount: db_1.schema.orders.discountAmount,
            total: db_1.schema.orders.total,
            tipAmount: db_1.schema.orders.tipAmount,
            tableLabel: db_1.schema.orders.tableLabel,
            guestCount: db_1.schema.orders.guestCount,
            completedAt: db_1.schema.orders.completedAt,
            createdAt: db_1.schema.orders.createdAt,
            businessName: db_1.schema.merchants.name,
            address: db_1.schema.merchants.address,
            city: db_1.schema.merchants.city,
            phone: db_1.schema.merchants.phone,
            vatNumber: db_1.schema.merchants.vatNumber,
            vatRate: db_1.schema.merchants.vatRate,
        })
            .from(db_1.schema.orders)
            .leftJoin(db_1.schema.merchants, (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, db_1.schema.orders.merchantId))
            .where((0, drizzle_orm_1.sql) `${db_1.schema.orders.notes} ILIKE ${"%[ticket:" + shout + "]%"}`)
            .limit(1);
        const row = rows[0];
        if (!row)
            return null;
        return {
            ...row,
            roundingAmount: null,
            pointsEarned: null,
            adyenCustomerReceiptJson: null,
            taxTakeawayRate: null,
            taxDineInRate: null,
            taxDeliveryRate: null,
            taxIncludedInPrice: null,
            vatAfterDiscount: null,
        };
    }
    catch (err) {
        console.warn("[receipts] kitchen-shout lookup failed:", err);
        return null;
    }
}
async function loadReceiptItems(orderId) {
    const db = (0, db_1.getDb)();
    try {
        return await db
            .select({
            productName: db_1.schema.orderItems.productName,
            quantity: db_1.schema.orderItems.quantity,
            unitPrice: db_1.schema.orderItems.unitPrice,
            totalPrice: db_1.schema.orderItems.totalPrice,
            selectedExtras: db_1.schema.orderItems.selectedExtras,
            comboSelections: db_1.schema.orderItems.comboSelections,
            seatNumber: db_1.schema.orderItems.seatNumber,
        })
            .from(db_1.schema.orderItems)
            .where((0, drizzle_orm_1.eq)(db_1.schema.orderItems.orderId, orderId));
    }
    catch (err) {
        console.warn("[receipts] rich items query failed, using core columns:", err);
        return db
            .select({
            productName: db_1.schema.orderItems.productName,
            quantity: db_1.schema.orderItems.quantity,
            unitPrice: db_1.schema.orderItems.unitPrice,
            totalPrice: db_1.schema.orderItems.totalPrice,
        })
            .from(db_1.schema.orderItems)
            .where((0, drizzle_orm_1.eq)(db_1.schema.orderItems.orderId, orderId));
    }
}
/**
 * GET /api/receipts/:ref
 * Public digital receipt lookup by order UUID, orderNumber, POS clientId, or kitchen shout.
 */
router.get("/:ref", async (req, res) => {
    try {
        let ref = String(req.params.ref || "").trim();
        try {
            ref = decodeURIComponent(ref);
        }
        catch {
            /* keep raw */
        }
        if (ref.includes("://")) {
            const parts = ref.replace(/\/+$/, "").split("/");
            ref = parts[parts.length - 1] || ref;
        }
        if (!ref || ref.length > 120) {
            return res.status(400).json({ error: "Invalid receipt reference" });
        }
        const order = (await findReceiptOrder(ref)) || (await findReceiptByKitchenShout(ref));
        if (!order) {
            return res.status(404).json({ error: "Receipt not found" });
        }
        const items = await loadReceiptItems(order.id);
        const adyenCustomerReceipt = (0, adyen_receipt_1.parseAdyenReceiptJson)(order.adyenCustomerReceiptJson);
        const channel = (order.fulfillmentChannel || "takeaway");
        const taxRate = merchant_settings_service_1.MerchantSettingsService.channelTaxRate({
            vatRate: order.vatRate,
            taxTakeawayRate: order.taxTakeawayRate,
            taxDineInRate: order.taxDineInRate,
            taxDeliveryRate: order.taxDeliveryRate,
        }, channel);
        const notes = String(order.notes || "");
        const memberMatch = notes.match(/\[member:([^\]]+)\]/i);
        const ptsEarnMatch = notes.match(/\[pts_earn:(\d+)\]/i);
        const ptsBalMatch = notes.match(/\[pts_bal:(\d+)\]/i);
        const memberName = memberMatch?.[1]?.trim() || null;
        const pointsEarned = order.pointsEarned != null && Number(order.pointsEarned) > 0
            ? Number(order.pointsEarned)
            : ptsEarnMatch?.[1]
                ? Number(ptsEarnMatch[1])
                : 0;
        const pointsBalance = ptsBalMatch?.[1] != null ? Number(ptsBalMatch[1]) : null;
        const meta = (0, guest_order_number_1.parseOrderMetaFromNotes)(notes);
        const orderDisplay = meta.ticketDisplay || null;
        const tabNumber = order.tabNumber || meta.tabNumber || null;
        const guestNumber = (0, guest_order_number_1.guestOrderNumber)({
            orderNumber: order.orderNumber,
            orderDisplay,
            tabNumber,
        });
        res.json({
            success: true,
            receipt: {
                id: order.id,
                clientId: order.clientId,
                orderNumber: order.orderNumber,
                guestOrderNumber: guestNumber || order.orderNumber,
                orderDisplay,
                tabNumber,
                businessName: order.businessName,
                address: [order.address, order.city].filter(Boolean).join(", "),
                phone: order.phone,
                vatNumber: order.vatNumber,
                customerName: order.customerName,
                memberName,
                pointsEarned,
                pointsBalance,
                channel: order.fulfillmentChannel,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                status: order.status,
                subtotal: order.subtotal,
                taxAmount: order.taxAmount,
                taxRate,
                vatIncludedInPrice: order.taxIncludedInPrice === true,
                vatAfterDiscount: order.vatAfterDiscount !== false,
                discountAmount: order.discountAmount,
                total: order.total,
                tipAmount: order.tipAmount,
                roundingAmount: order.roundingAmount,
                tableLabel: order.tableLabel,
                guestCount: order.guestCount,
                notes: order.notes,
                completedAt: order.completedAt || order.createdAt,
                adyenCustomerReceipt,
                adyenPaymentReceiptText: adyenCustomerReceipt
                    ? (0, adyen_receipt_1.adyenReceiptToPlainText)(adyenCustomerReceipt, 40)
                    : null,
                items: items.map((i) => ({
                    name: (0, order_item_name_1.resolveOrderItemName)(i.productName),
                    quantity: i.quantity,
                    unitPrice: i.unitPrice,
                    lineTotal: i.totalPrice,
                    seatNumber: i.seatNumber ?? null,
                    selectedExtras: i.selectedExtras || [],
                    comboSelections: i.comboSelections || [],
                })),
            },
        });
    }
    catch (error) {
        console.error("Error loading receipt:", error);
        res.status(500).json({ error: "Failed to load receipt" });
    }
});
exports.default = router;
//# sourceMappingURL=receipts.routes.js.map