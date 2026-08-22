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
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const chaslay_api_key_middleware_1 = require("@/middleware/chaslay-api-key.middleware");
const receipt_public_url_1 = require("@/lib/receipt-public-url");
const sync_service_1 = require("@/services/sync.service");
const email_service_1 = require("@/services/email.service");
const router = (0, express_1.Router)();
async function findOrderForReceipt(merchantId, ref) {
    const db = (0, db_1.getDb)();
    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
    const clauses = [(0, drizzle_orm_1.eq)(db_1.schema.orders.orderNumber, ref), (0, drizzle_orm_1.eq)(db_1.schema.orders.clientId, ref)];
    if (looksLikeUuid)
        clauses.unshift((0, drizzle_orm_1.eq)(db_1.schema.orders.id, ref));
    const rows = await db
        .select({
        id: db_1.schema.orders.id,
        orderNumber: db_1.schema.orders.orderNumber,
        total: db_1.schema.orders.total,
    })
        .from(db_1.schema.orders)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.or)(...clauses)))
        .limit(1);
    return rows[0] || null;
}
router.post("/", chaslay_api_key_middleware_1.requireChaslayApiKey, async (req, res) => {
    try {
        const body = req.body ?? {};
        const id = String(body.id || body.transaction_number || "").trim();
        if (!id) {
            return res.status(400).json({ error: "id is required" });
        }
        const orderNumber = String(body.transaction_number || body.orderNumber || body.order_number || id).trim();
        const items = Array.isArray(body.items) ? body.items : [];
        const subtotal = Number(body.subtotal ?? body.total ?? 0);
        const taxTotal = Number(body.tax_total ?? 0);
        const total = Number(body.total ?? subtotal + taxTotal);
        const discountAmount = Number(body.discount_amount ?? body.item_discount_total ?? 0);
        const tipAmount = Number(body.tip_amount ?? body.tipAmount ?? 0);
        const paymentMethod = String(body.payment_method || "cash").toLowerCase();
        const isPending = paymentMethod === "pending" ||
            paymentMethod === "pay_later" ||
            paymentMethod === "invoice";
        const paymentBreakdown = Array.isArray(body.payment_breakdown)
            ? body.payment_breakdown
                .map((row) => ({
                method: String(row?.method || "").trim().toLowerCase(),
                amount: Number(row?.amount || 0),
            }))
                .filter((row) => row.method && row.amount > 0)
            : undefined;
        const pushResults = await sync_service_1.SyncService.pushSales(req.chaslayMerchantId, [
            {
                clientId: id,
                orderNumber,
                paymentMethod,
                paymentBreakdown: paymentBreakdown?.length ? paymentBreakdown : undefined,
                paymentStatus: isPending ? "awaiting_payment" : "completed",
                subtotal,
                taxAmount: taxTotal,
                discountAmount,
                tipAmount,
                total,
                completedAt: body.created_at || Date.now(),
                fulfillmentChannel: body.fulfillmentChannel || body.fulfillment_channel || undefined,
                channel: body.channel || body.fulfillment_type || body.fulfillmentType || undefined,
                scheduledFor: body.scheduledFor || body.scheduled_for || undefined,
                pickup_time_ms: body.pickup_time_ms ?? body.pickupTimeMs ?? null,
                customerId: body.customer_id || body.customerId || null,
                customerName: body.customer_name || body.customerName || null,
                customerPhone: body.customer_phone || body.customerPhone || null,
                customerEmail: body.customer_email || body.customerEmail || null,
                shippingAddress: body.shipping_address || body.shippingAddress || null,
                items: items.map((item) => ({
                    productName: item.product_name || item.productName || "Item",
                    quantity: Number(item.quantity || 1),
                    unitPrice: Number(item.unit_price ?? item.unitPrice ?? 0),
                    totalPrice: Number(item.line_total ?? item.lineTotal ?? 0),
                    weightKg: item.weight_kg != null
                        ? Number(item.weight_kg)
                        : item.weightKg != null
                            ? Number(item.weightKg)
                            : undefined,
                })),
            },
        ]);
        const pushed = pushResults[0];
        if (!pushed?.orderId || pushed.skipped) {
            return res.status(400).json({
                error: "Receipt could not be saved (empty or invalid sale data)",
            });
        }
        const order = (await findOrderForReceipt(req.chaslayMerchantId, pushed.orderId)) ||
            (await findOrderForReceipt(req.chaslayMerchantId, id));
        if (!order) {
            return res.status(502).json({ error: "Receipt publish failed — order not found after sync" });
        }
        const url = (0, receipt_public_url_1.buildReceiptPublicUrl)(order.id);
        let invoiceNumber = null;
        if (paymentMethod === "invoice") {
            try {
                const { InvoiceService } = await Promise.resolve().then(() => __importStar(require("@/services/invoice.service")));
                invoiceNumber = await InvoiceService.ensureInvoiceNumber(req.chaslayMerchantId, order.id);
            }
            catch (err) {
                console.warn("[receipts] invoice number assign failed:", err);
            }
        }
        res.status(201).json({
            id: order.id,
            clientId: id,
            url,
            invoiceNumber,
            invoicePdfPath: paymentMethod === "invoice" ? `/v1/invoices/${order.id}/pdf` : null,
        });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Receipt publish failed" });
    }
});
router.post("/:id/email", chaslay_api_key_middleware_1.requireChaslayApiKey, async (req, res) => {
    try {
        const receiptId = String(req.params.id || "").trim();
        const email = String(req.body?.email || "").trim();
        const customerName = String(req.body?.customerName || req.body?.customer_name || "").trim();
        if (!receiptId) {
            return res.status(400).json({ success: false, message: "Receipt id is required" });
        }
        if (!email.includes("@")) {
            return res.status(400).json({ success: false, message: "Valid email required" });
        }
        const order = await findOrderForReceipt(req.chaslayMerchantId, receiptId);
        const merchant = req.chaslayMerchant;
        const shopName = merchant?.name || "Shop";
        const receiptUrl = (0, receipt_public_url_1.normalizeReceiptPublicUrl)("", order?.id || receiptId);
        const orderNumber = String(req.body?.orderNumber || req.body?.transaction_number || order?.orderNumber || receiptId).trim();
        const amount = req.body?.amount != null && Number.isFinite(Number(req.body.amount))
            ? Number(req.body.amount)
            : order?.total != null
                ? Number(order.total)
                : null;
        const subject = [shopName, orderNumber ? `#${orderNumber}` : null, "Receipt"].filter(Boolean).join(" · ");
        const greeting = customerName ? `Hi ${customerName},` : "Hello,";
        const amountLine = amount != null
            ? `<p style="font-size:18px;font-weight:700;margin:12px 0;">CHF ${amount.toFixed(2)}</p>`
            : "";
        const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1c1917;">
        <h2 style="margin:0 0 8px;">${shopName}</h2>
        <p style="margin:0;color:#57534e;">${greeting} here is your receipt${orderNumber ? ` for order ${orderNumber}` : ""}.</p>
        ${amountLine}
        <p><a href="${receiptUrl}" style="display:inline-block;padding:10px 16px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">View receipt</a></p>
        <p style="color:#666;font-size:12px;word-break:break-all;">${receiptUrl}</p>
      </div>
    `;
        const text = `${shopName}\n${greeting}\nYour receipt${orderNumber ? ` for order ${orderNumber}` : ""}\n` +
            (amount != null ? `CHF ${amount.toFixed(2)}\n` : "") +
            `${receiptUrl}\n`;
        await email_service_1.EmailService.send({
            merchantId: req.chaslayMerchantId,
            to: email,
            subject,
            html,
            text,
        });
        res.json({ success: true, message: `Receipt sent to ${email}`, url: receiptUrl });
    }
    catch (error) {
        console.error("Chaslay receipt email failed:", error);
        res.status(400).json({
            success: false,
            message: error instanceof Error ? error.message : "Could not send receipt email",
        });
    }
});
exports.default = router;
//# sourceMappingURL=receipts.routes.js.map