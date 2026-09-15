"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdyenMerchantWebhookService = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const adyen_webhook_hmac_1 = require("@/lib/adyen-webhook-hmac");
const adyen_service_1 = require("@/services/adyen.service");
function parseSuccess(value) {
    return String(value ?? "").toLowerCase() === "true";
}
function normalizeNotificationItem(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const item = raw;
    const n = item.NotificationRequestItem ||
        item.notificationRequestItem ||
        raw;
    if (!n?.eventCode)
        return null;
    return n;
}
function inferPaymentMethod(item, merchantReference) {
    const additional = item.additionalData || {};
    const interaction = String(additional.shopperInteraction || additional["shopperInteraction"] || "");
    const poi = String(additional.terminalId || additional["terminalId"] || "");
    if (merchantReference.startsWith("webpos-ttp-"))
        return "tap_to_pay";
    if (interaction.toUpperCase() === "POS" || poi)
        return "terminal";
    return "card";
}
class AdyenMerchantWebhookService {
    static webhookUrl(merchantId) {
        const base = process.env.PUBLIC_APP_URL ||
            process.env.MERCHANT_DASHBOARD_URL ||
            "https://app.rebornsense.com";
        const apiBase = base.replace(/\/$/, "").includes("api.")
            ? base.replace(/\/$/, "")
            : `${base.replace(/\/$/, "")}/api`;
        return `${apiBase}/webhooks/adyen/${merchantId}`;
    }
    /** Prefer the host the merchant is using (chaslay vs rebornSense) for copy-paste URLs. */
    static webhookUrlFromRequest(merchantId, req) {
        const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0]?.trim();
        const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0]?.trim();
        if (host && proto) {
            const origin = `${proto}://${host}`.replace(/\/$/, "");
            const apiBase = origin.includes("/api") ? origin : `${origin}/api`;
            return `${apiBase}/webhooks/adyen/${merchantId}`;
        }
        return this.webhookUrl(merchantId);
    }
    static async processWebhook(merchantId, body) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant) {
            throw new Error("Merchant not found");
        }
        const payload = (body || {});
        const notificationItems = payload.notificationItems || payload.NotificationItems || [];
        if (!Array.isArray(notificationItems) || notificationItems.length === 0) {
            return;
        }
        for (const rawItem of notificationItems) {
            const item = normalizeNotificationItem(rawItem);
            if (!item)
                continue;
            const eventCode = String(item.eventCode || "").toUpperCase();
            const hmacRequired = eventCode !== "REPORT_AVAILABLE";
            if (hmacRequired) {
                if (!(0, adyen_webhook_hmac_1.verifyAdyenNotificationHmac)(item, merchant.adyenHmacKey)) {
                    console.warn(`[adyen-webhook] HMAC verification failed for merchant ${merchantId} event ${eventCode}`);
                    continue;
                }
            }
            const merchantAccount = item.merchantAccountCode || "";
            if (merchant.adyenMerchantAccount &&
                merchantAccount &&
                merchantAccount !== merchant.adyenMerchantAccount) {
                console.warn(`[adyen-webhook] merchantAccountCode mismatch for ${merchantId}: expected ${merchant.adyenMerchantAccount}, got ${merchantAccount}`);
                continue;
            }
            await this.handleNotificationItem(merchantId, merchant, item);
        }
    }
    static async handleNotificationItem(merchantId, _merchant, item) {
        const eventCode = String(item.eventCode || "").toUpperCase();
        const success = parseSuccess(item.success);
        const merchantReference = String(item.merchantReference || "").trim();
        const pspReference = String(item.pspReference || "").trim();
        const amountMinor = Number(item.amount?.value ?? 0);
        const amount = amountMinor / 100;
        const currency = String(item.amount?.currency || "CHF").toUpperCase();
        const paymentMethod = inferPaymentMethod(item, merchantReference);
        if (!merchantReference && !pspReference)
            return;
        switch (eventCode) {
            case "AUTHORISATION":
                if (success) {
                    await this.recordAuthorisedPayment(merchantId, merchantReference, pspReference, amount, currency, paymentMethod);
                }
                else if (merchantReference) {
                    await this.markOrderPaymentFailed(merchantId, merchantReference);
                }
                break;
            case "CAPTURE":
                if (success && pspReference) {
                    await this.markTransactionCaptured(merchantId, pspReference);
                }
                break;
            case "REFUND":
            case "CANCEL_OR_REFUND":
                if (success && pspReference && amount > 0) {
                    await this.recordRefund(merchantId, merchantReference, pspReference, amount, currency);
                }
                break;
            case "CANCELLATION":
                if (success && merchantReference) {
                    await this.markOrderPaymentFailed(merchantId, merchantReference);
                }
                break;
            default:
                break;
        }
    }
    static async findOrderByReference(merchantId, merchantReference) {
        const db = (0, db_1.getDb)();
        const ref = merchantReference.trim();
        if (!ref)
            return null;
        const byClientId = await db.query.orders.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.clientId, ref)),
        });
        if (byClientId)
            return byClientId;
        const prefixed = ref.startsWith(`${merchantId}-`) ? ref.slice(merchantId.length + 1) : null;
        if (prefixed) {
            const byId = await db.query.orders.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.orders.id, prefixed)),
            });
            if (byId)
                return byId;
        }
        return null;
    }
    static async recordAuthorisedPayment(merchantId, merchantReference, pspReference, amount, currency, paymentMethod) {
        const db = (0, db_1.getDb)();
        if (pspReference) {
            const existing = await db.query.paymentTransactions.findFirst({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.paymentTransactions.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.paymentTransactions.adyenReference, pspReference)),
            });
            if (existing)
                return;
        }
        const order = await this.findOrderByReference(merchantId, merchantReference);
        if (order) {
            const effectiveAmount = amount > 0 ? amount : Number(order.total) || 0;
            try {
                await adyen_service_1.AdyenService.recordPaymentTransaction(merchantId, order.id, effectiveAmount, paymentMethod, pspReference || `auth-${Date.now()}`, "captured", { currency });
            }
            catch (err) {
                console.warn("[adyen-webhook] recordPaymentTransaction failed:", err);
            }
            if (pspReference) {
                await db
                    .update(db_1.schema.orders)
                    .set({
                    adyenReference: pspReference,
                    paymentStatus: order.paymentStatus === "awaiting_payment" ? "completed" : order.paymentStatus,
                })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, order.id));
            }
            return;
        }
        if (merchantReference) {
            try {
                await adyen_service_1.AdyenService.recordPaymentTransactionByClientRef(merchantId, merchantReference, amount, paymentMethod, pspReference || `auth-${Date.now()}`, "captured", { currency });
            }
            catch (err) {
                console.warn("[adyen-webhook] recordPaymentTransactionByClientRef failed:", err);
            }
        }
    }
    static async markTransactionCaptured(merchantId, pspReference) {
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.paymentTransactions)
            .set({ status: "captured", completedAt: new Date() })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.paymentTransactions.merchantId, merchantId), (0, drizzle_orm_1.eq)(db_1.schema.paymentTransactions.adyenReference, pspReference)));
    }
    static async recordRefund(merchantId, merchantReference, pspReference, amount, currency) {
        const order = await this.findOrderByReference(merchantId, merchantReference);
        if (!order)
            return;
        try {
            await adyen_service_1.AdyenService.recordPaymentTransaction(merchantId, order.id, -amount, "refund", pspReference, "completed", { currency });
        }
        catch (err) {
            console.warn("[adyen-webhook] refund log failed:", err);
        }
    }
    static async markOrderPaymentFailed(merchantId, merchantReference) {
        const order = await this.findOrderByReference(merchantId, merchantReference);
        if (!order)
            return;
        if (order.paymentStatus === "completed" || order.paymentStatus === "paid")
            return;
        const db = (0, db_1.getDb)();
        await db
            .update(db_1.schema.orders)
            .set({ paymentStatus: "failed" })
            .where((0, drizzle_orm_1.eq)(db_1.schema.orders.id, order.id));
    }
}
exports.AdyenMerchantWebhookService = AdyenMerchantWebhookService;
//# sourceMappingURL=adyen-merchant-webhook.service.js.map