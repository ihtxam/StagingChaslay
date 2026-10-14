import { Router, Request, Response } from "express";
import { SubscriptionBillingService } from "@/services/subscription-billing.service";
import { AdyenMerchantWebhookService } from "@/services/adyen-merchant-webhook.service";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";
import {
  extractWebhookSecret,
  parsePhoneInbound,
  phoneTicketNotes,
  PHONE_ORDER_SOURCE,
} from "@/lib/phone-ordering-webhook";
import {
  isPhoneOrderingReady,
  normalizePhoneOrderingSettings,
  timingSafeEqualSecret,
} from "@/lib/phone-ordering-settings";
import { OrderService } from "@/services/order.service";

const router = Router();

/**
 * POST /api/webhooks/adyen/subscription
 * Adyen notification webhook for platform subscription payments.
 * Configure this URL in the Adyen Customer Area for the platform account.
 */
router.post("/adyen/subscription", async (req: Request, res: Response) => {
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
        const recurringDetailReference =
          additionalData["recurring.recurringDetailReference"] ||
          additionalData.recurringDetailReference ||
          additionalData["tokenization.storedPaymentMethodId"];
        const paymentId =
          additionalData.paymentId ||
          additionalData.metadata_paymentId ||
          (merchantReference.startsWith("sub-") ? undefined : undefined);
        const sessionId = additionalData.checkoutSessionId || additionalData.sessionId;

        if (eventCode === "AUTHORISATION" && success) {
          await SubscriptionBillingService.markPaidFromWebhook({
            paymentId,
            sessionId,
            resultCode: "Authorised",
            pspReference,
            recurringDetailReference,
          });
        }

        if (eventCode === "RECURRING_CONTRACT" && success && recurringDetailReference) {
          await SubscriptionBillingService.markPaidFromWebhook({
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
      await SubscriptionBillingService.markPaidFromWebhook({
        paymentId,
        sessionId,
        resultCode,
        pspReference,
      });
    }

    res.json({ notificationResponse: "[accepted]" });
  } catch (error) {
    console.error("Adyen subscription webhook error:", error);
    // Still acknowledge to avoid retries storms; log for investigation
    res.json({ notificationResponse: "[accepted]" });
  }
});

/**
 * POST /api/webhooks/adyen/:merchantId
 * Per-merchant Adyen Standard notification webhook (Tap to Pay, terminal POI, shop card).
 * Configure in the merchant's Adyen Customer Area with their webhook HMAC key.
 */
router.post("/adyen/:merchantId", async (req: Request, res: Response) => {
  const merchantId = String(req.params.merchantId || "").trim();
  if (!merchantId) {
    return res.status(400).json({ notificationResponse: "[invalid]" });
  }

  try {
    await AdyenMerchantWebhookService.processWebhook(merchantId, req.body || {});
    return res.json({ notificationResponse: "[accepted]" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Merchant not found") {
      return res.status(404).json({ notificationResponse: "[invalid]" });
    }
    console.error(`Adyen merchant webhook error (${merchantId}):`, error);
    // Acknowledge to avoid retry storms; investigate via logs
    return res.json({ notificationResponse: "[accepted]" });
  }
});

/**
 * GET /api/webhooks/phone/:merchantId
 * Health for the phone-ordering inbound channel (no secret).
 */
router.get("/phone/:merchantId", async (req: Request, res: Response) => {
  const merchantId = String(req.params.merchantId || "").trim();
  if (!merchantId) return res.status(400).json({ ok: false, error: "Merchant ID is required" });
  try {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
      columns: { id: true, phoneOrderingSettings: true },
    });
    if (!merchant) return res.status(404).json({ ok: false, error: "Merchant not found" });
    const settings = normalizePhoneOrderingSettings(
      (merchant as { phoneOrderingSettings?: Record<string, unknown> | null }).phoneOrderingSettings
    );
    return res.json({
      ok: true,
      service: "phone-ordering",
      enabled: settings.enabled === true,
      configured: isPhoneOrderingReady(settings),
    });
  } catch (error) {
    console.error("Phone ordering health error:", error);
    return res.status(500).json({ ok: false, error: "Phone ordering health failed" });
  }
});

/**
 * POST /api/webhooks/phone/:merchantId
 * Twilio or generic SMS/voice inbound. Creates a phone-source staff ticket.
 */
router.post("/phone/:merchantId", async (req: Request, res: Response) => {
  const merchantId = String(req.params.merchantId || "").trim();
  if (!merchantId) return res.status(400).json({ ok: false, error: "Merchant ID is required" });
  try {
    const { ensurePhoneOrderingSchema } = await import("@/lib/ensure-merchant-schema");
    await ensurePhoneOrderingSchema();
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) return res.status(404).json({ ok: false, error: "Merchant not found" });
    const settings = normalizePhoneOrderingSettings(
      (merchant as { phoneOrderingSettings?: Record<string, unknown> | null }).phoneOrderingSettings
    );
    if (!settings.enabled) {
      return res.status(403).json({ ok: false, error: "Phone ordering is disabled" });
    }
    if (!settings.webhookSecret) {
      return res.status(403).json({ ok: false, error: "Phone ordering webhook secret is not set" });
    }
    const provided = extractWebhookSecret({
      headers: req.headers as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
      body: (req.body || {}) as Record<string, unknown>,
    });
    if (!timingSafeEqualSecret(settings.webhookSecret, provided)) {
      return res.status(401).json({ ok: false, error: "Invalid webhook secret" });
    }
    const inbound = parsePhoneInbound((req.body || {}) as Record<string, unknown>);
    const order = await OrderService.createOrder(
      merchantId,
      [],
      undefined,
      "pos",
      undefined,
      0,
      phoneTicketNotes(inbound),
      null,
      {
        orderSource: PHONE_ORDER_SOURCE,
        customerName: inbound.customerName,
        customerPhone: inbound.from,
        status: "pending_approval",
        paymentStatus: "pending",
      }
    );
    return res.status(201).json({ ok: true, order, inbound });
  } catch (error) {
    console.error("Phone ordering webhook error:", error);
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Failed to create phone order",
    });
  }
});

export default router;