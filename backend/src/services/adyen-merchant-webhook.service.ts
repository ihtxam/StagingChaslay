import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  verifyAdyenNotificationHmac,
  type AdyenNotificationRequestItem,
} from "@/lib/adyen-webhook-hmac";
import { AdyenService } from "@/services/adyen.service";

type Merchant = typeof schema.merchants.$inferSelect;

function parseSuccess(value: unknown): boolean {
  return String(value ?? "").toLowerCase() === "true";
}

function normalizeNotificationItem(raw: unknown): AdyenNotificationRequestItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const n =
    (item.NotificationRequestItem as AdyenNotificationRequestItem | undefined) ||
    (item.notificationRequestItem as AdyenNotificationRequestItem | undefined) ||
    (raw as AdyenNotificationRequestItem);
  if (!n?.eventCode) return null;
  return n;
}

function inferPaymentMethod(
  item: AdyenNotificationRequestItem,
  merchantReference: string,
): string {
  const additional = item.additionalData || {};
  const interaction = String(additional.shopperInteraction || additional["shopperInteraction"] || "");
  const poi = String(additional.terminalId || additional["terminalId"] || "");
  if (merchantReference.startsWith("webpos-ttp-")) return "tap_to_pay";
  if (interaction.toUpperCase() === "POS" || poi) return "terminal";
  return "card";
}

export class AdyenMerchantWebhookService {
  static webhookUrl(merchantId: string): string {
    const base =
      process.env.PUBLIC_APP_URL ||
      process.env.MERCHANT_DASHBOARD_URL ||
      "https://app.rebornsense.com";
    const apiBase = base.replace(/\/$/, "").includes("api.")
      ? base.replace(/\/$/, "")
      : `${base.replace(/\/$/, "")}/api`;
    return `${apiBase}/webhooks/adyen/${merchantId}`;
  }

  static async processWebhook(merchantId: string, body: unknown): Promise<void> {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) {
      throw new Error("Merchant not found");
    }

    const payload = (body || {}) as Record<string, unknown>;
    const notificationItems = payload.notificationItems || payload.NotificationItems || [];
    if (!Array.isArray(notificationItems) || notificationItems.length === 0) {
      return;
    }

    for (const rawItem of notificationItems) {
      const item = normalizeNotificationItem(rawItem);
      if (!item) continue;

      const eventCode = String(item.eventCode || "").toUpperCase();
      const hmacRequired = eventCode !== "REPORT_AVAILABLE";
      if (hmacRequired) {
        if (!verifyAdyenNotificationHmac(item, merchant.adyenHmacKey)) {
          console.warn(
            `[adyen-webhook] HMAC verification failed for merchant ${merchantId} event ${eventCode}`,
          );
          continue;
        }
      }

      const merchantAccount = item.merchantAccountCode || "";
      if (
        merchant.adyenMerchantAccount &&
        merchantAccount &&
        merchantAccount !== merchant.adyenMerchantAccount
      ) {
        console.warn(
          `[adyen-webhook] merchantAccountCode mismatch for ${merchantId}: expected ${merchant.adyenMerchantAccount}, got ${merchantAccount}`,
        );
        continue;
      }

      await this.handleNotificationItem(merchantId, merchant, item);
    }
  }

  private static async handleNotificationItem(
    merchantId: string,
    _merchant: Merchant,
    item: AdyenNotificationRequestItem,
  ): Promise<void> {
    const eventCode = String(item.eventCode || "").toUpperCase();
    const success = parseSuccess(item.success);
    const merchantReference = String(item.merchantReference || "").trim();
    const pspReference = String(item.pspReference || "").trim();
    const amountMinor = Number(item.amount?.value ?? 0);
    const amount = amountMinor / 100;
    const currency = String(item.amount?.currency || "CHF").toUpperCase();
    const paymentMethod = inferPaymentMethod(item, merchantReference);

    if (!merchantReference && !pspReference) return;

    switch (eventCode) {
      case "AUTHORISATION":
        if (success) {
          await this.recordAuthorisedPayment(
            merchantId,
            merchantReference,
            pspReference,
            amount,
            currency,
            paymentMethod,
          );
        } else if (merchantReference) {
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

  private static async findOrderByReference(merchantId: string, merchantReference: string) {
    const db = getDb();
    const ref = merchantReference.trim();
    if (!ref) return null;

    const byClientId = await db.query.orders.findFirst({
      where: and(eq(schema.orders.merchantId, merchantId), eq(schema.orders.clientId, ref)),
    });
    if (byClientId) return byClientId;

    const prefixed = ref.startsWith(`${merchantId}-`) ? ref.slice(merchantId.length + 1) : null;
    if (prefixed) {
      const byId = await db.query.orders.findFirst({
        where: and(eq(schema.orders.merchantId, merchantId), eq(schema.orders.id, prefixed)),
      });
      if (byId) return byId;
    }

    return null;
  }

  private static async recordAuthorisedPayment(
    merchantId: string,
    merchantReference: string,
    pspReference: string,
    amount: number,
    currency: string,
    paymentMethod: string,
  ): Promise<void> {
    const db = getDb();

    if (pspReference) {
      const existing = await db.query.paymentTransactions.findFirst({
        where: and(
          eq(schema.paymentTransactions.merchantId, merchantId),
          eq(schema.paymentTransactions.adyenReference, pspReference),
        ),
      });
      if (existing) return;
    }

    const order = await this.findOrderByReference(merchantId, merchantReference);
    if (order) {
      const effectiveAmount = amount > 0 ? amount : Number(order.total) || 0;
      try {
        await AdyenService.recordPaymentTransaction(
          merchantId,
          order.id,
          effectiveAmount,
          paymentMethod,
          pspReference || `auth-${Date.now()}`,
          "captured",
          { currency },
        );
      } catch (err) {
        console.warn("[adyen-webhook] recordPaymentTransaction failed:", err);
      }

      if (pspReference) {
        await db
          .update(schema.orders)
          .set({
            adyenReference: pspReference,
            paymentStatus:
              order.paymentStatus === "awaiting_payment" ? "completed" : order.paymentStatus,
          })
          .where(eq(schema.orders.id, order.id));
      }
      return;
    }

    if (merchantReference) {
      try {
        await AdyenService.recordPaymentTransactionByClientRef(
          merchantId,
          merchantReference,
          amount,
          paymentMethod,
          pspReference || `auth-${Date.now()}`,
          "captured",
          { currency },
        );
      } catch (err) {
        console.warn("[adyen-webhook] recordPaymentTransactionByClientRef failed:", err);
      }
    }
  }

  private static async markTransactionCaptured(merchantId: string, pspReference: string): Promise<void> {
    const db = getDb();
    await db
      .update(schema.paymentTransactions)
      .set({ status: "captured", completedAt: new Date() })
      .where(
        and(
          eq(schema.paymentTransactions.merchantId, merchantId),
          eq(schema.paymentTransactions.adyenReference, pspReference),
        ),
      );
  }

  private static async recordRefund(
    merchantId: string,
    merchantReference: string,
    pspReference: string,
    amount: number,
    currency: string,
  ): Promise<void> {
    const order = await this.findOrderByReference(merchantId, merchantReference);
    if (!order) return;

    try {
      await AdyenService.recordPaymentTransaction(
        merchantId,
        order.id,
        -amount,
        "refund",
        pspReference,
        "completed",
        { currency },
      );
    } catch (err) {
      console.warn("[adyen-webhook] refund log failed:", err);
    }
  }

  private static async markOrderPaymentFailed(
    merchantId: string,
    merchantReference: string,
  ): Promise<void> {
    const order = await this.findOrderByReference(merchantId, merchantReference);
    if (!order) return;
    if (order.paymentStatus === "completed" || order.paymentStatus === "paid") return;

    const db = getDb();
    await db
      .update(schema.orders)
      .set({ paymentStatus: "failed" })
      .where(eq(schema.orders.id, order.id));
  }
}
