"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const subscription_billing_service_1 = require("@/services/subscription-billing.service");
const router = (0, express_1.Router)();
/**
 * POST /api/webhooks/adyen/subscription
 * Adyen notification webhook for platform subscription payments.
 * Configure this URL in the Adyen Customer Area for the platform account.
 */
router.post("/adyen/subscription", async (req, res) => {
    try {
        const body = req.body || {};
        const notificationItems = body.notificationItems || body.NotificationItems || [];
        if (Array.isArray(notificationItems) && notificationItems.length > 0) {
            for (const item of notificationItems) {
                const n = item.NotificationRequestItem || item.notificationRequestItem || item;
                const eventCode = n.eventCode || n.EventCode;
                const success = String(n.success ?? n.Success ?? "").toLowerCase() === "true";
                const pspReference = n.pspReference || n.PspReference;
                const merchantReference = String(n.merchantReference || n.MerchantReference || "");
                const additionalData = n.additionalData || n.AdditionalData || {};
                const recurringDetailReference = additionalData["recurring.recurringDetailReference"] ||
                    additionalData.recurringDetailReference ||
                    additionalData["tokenization.storedPaymentMethodId"];
                const paymentId = additionalData.paymentId ||
                    additionalData.metadata_paymentId ||
                    (merchantReference.startsWith("sub-") ? undefined : undefined);
                const sessionId = additionalData.checkoutSessionId || additionalData.sessionId;
                if (eventCode === "AUTHORISATION" && success) {
                    await subscription_billing_service_1.SubscriptionBillingService.markPaidFromWebhook({
                        paymentId,
                        sessionId,
                        resultCode: "Authorised",
                        pspReference,
                        recurringDetailReference,
                    });
                }
                if (eventCode === "RECURRING_CONTRACT" && success && recurringDetailReference) {
                    await subscription_billing_service_1.SubscriptionBillingService.markPaidFromWebhook({
                        paymentId,
                        sessionId,
                        resultCode: "Authorised",
                        pspReference,
                        recurringDetailReference,
                    });
                }
            }
            return res.json({ notificationResponse: "[accepted]" });
        }
        // Session / checkout-style payload
        const resultCode = body.resultCode || body.ResultCode;
        const paymentId = body.paymentId || body.metadata?.paymentId;
        const sessionId = body.sessionId || body.id;
        const pspReference = body.pspReference || body.PspReference;
        if (paymentId || sessionId) {
            await subscription_billing_service_1.SubscriptionBillingService.markPaidFromWebhook({
                paymentId,
                sessionId,
                resultCode,
                pspReference,
            });
        }
        res.json({ notificationResponse: "[accepted]" });
    }
    catch (error) {
        console.error("Adyen subscription webhook error:", error);
        // Still acknowledge to avoid retries storms; log for investigation
        res.json({ notificationResponse: "[accepted]" });
    }
});
exports.default = router;
//# sourceMappingURL=webhooks.routes.js.map