import axios from "axios";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  PlatformSettingsService,
  formatAdyenCheckoutApiError,
} from "@/services/platform-settings.service";
import { SubscriptionPlansService } from "@/services/subscription-plans.service";

export type BillingCycle = "monthly" | "yearly";

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function planAmount(plan: { priceMonthly: string; priceYearly: string | null }, cycle: BillingCycle) {
  if (cycle === "yearly") {
    if (plan.priceYearly != null && plan.priceYearly !== "") {
      return Number(plan.priceYearly);
    }
    return Number(plan.priceMonthly) * 12;
  }
  return Number(plan.priceMonthly);
}

export class SubscriptionBillingService {
  static async getBillingOverview(merchantId: string) {
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    if (!merchant) throw new Error("Merchant not found");

    const plans = await SubscriptionPlansService.listPublic();
    const currentPlan =
      (await SubscriptionPlansService.getBySlug(merchant.subscriptionPlan || "free")) || null;

    const payments = await db.query.subscriptionPayments.findMany({
      where: eq(schema.subscriptionPayments.merchantId, merchantId),
      orderBy: [desc(schema.subscriptionPayments.createdAt)],
      limit: 20,
      with: { plan: true },
    });

    let platformAdyenConfigured = false;
    try {
      await PlatformSettingsService.resolvePlatformAdyenCredentials();
      platformAdyenConfigured = true;
    } catch {
      platformAdyenConfigured = false;
    }

    const { WebPosEntitlementService } = await import(
      "@/services/webpos-entitlement.service"
    );
    const webposEntitlement = await WebPosEntitlementService.getEntitlement(merchantId);

    return {
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        subscriptionPlan: merchant.subscriptionPlan,
        status: merchant.status,
        subscriptionEndsAt: merchant.subscriptionEndsAt,
        trialEndsAt: merchant.trialEndsAt,
      },
      currentPlan,
      plans,
      payments,
      platformAdyenConfigured,
      webposEntitlement,
    };
  }

  static async startCheckout(
    merchantId: string,
    planId: string,
    billingCycle: BillingCycle,
    returnUrl?: string
  ) {
    const db = getDb();
    const cycle: BillingCycle = billingCycle === "yearly" ? "yearly" : "monthly";
    const plan = await SubscriptionPlansService.getById(planId);

    if (!plan.isActive || !plan.isPublic) {
      throw new Error("This plan is not available for purchase");
    }

    const amount = planAmount(plan, cycle);
    const currency = (plan.currency || "CHF").toUpperCase();
    const periodStart = new Date();
    const periodEnd = addMonths(periodStart, cycle === "yearly" ? 12 : 1);

    // Free / zero-price plans: assign immediately
    if (!amount || amount <= 0) {
      await db
        .update(schema.merchants)
        .set({
          subscriptionPlan: plan.slug,
          subscriptionEndsAt: periodEnd,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(schema.merchants.id, merchantId));

      const [payment] = await db
        .insert(schema.subscriptionPayments)
        .values({
          merchantId,
          planId: plan.id,
          billingCycle: cycle,
          amount: "0",
          currency,
          status: "paid",
          paidAt: new Date(),
          periodStart,
          periodEnd,
          adyenResultCode: "Free",
        })
        .returning();

      return {
        free: true,
        payment,
        plan,
        billingCycle: cycle,
      };
    }

    const creds = await PlatformSettingsService.resolvePlatformAdyenCredentials();

    const [payment] = await db
      .insert(schema.subscriptionPayments)
      .values({
        merchantId,
        planId: plan.id,
        billingCycle: cycle,
        amount: amount.toFixed(2),
        currency,
        status: "pending",
        periodStart,
        periodEnd,
      })
      .returning();

    const reference = `sub-${merchantId.slice(0, 8)}-${payment!.id.slice(0, 8)}`;
    const defaultReturn =
      returnUrl ||
      `${process.env.MERCHANT_DASHBOARD_URL || process.env.PUBLIC_APP_URL || ""}/merchant/billing?paymentId=${payment!.id}`;

    try {
      const sessionPayload: Record<string, unknown> = {
        amount: {
          value: Math.round(amount * 100),
          currency,
        },
        merchantAccount: creds.merchantAccount,
        reference,
        returnUrl: defaultReturn,
        channel: "Web",
        countryCode: "CH",
        shopperReference: merchantId,
        clientKey: creds.clientKey,
        metadata: {
          type: "subscription",
          paymentId: payment!.id,
          merchantId,
          planId: plan.id,
          billingCycle: cycle,
        },
      };

      const response = await axios.post(`${creds.apiBase}/sessions`, sessionPayload, {
        headers: {
          "x-api-key": creds.apiKey,
          "Content-Type": "application/json",
        },
      });

      const sessionId = response.data?.id;
      const sessionData = response.data?.sessionData;
      if (!sessionId || !sessionData) {
        console.error("Adyen /sessions response missing id or sessionData:", response.data);
        throw new Error(
          "Adyen session response was incomplete. Check platform API key and merchant account match the client key account."
        );
      }

      await db
        .update(schema.subscriptionPayments)
        .set({
          adyenSessionId: sessionId,
          updatedAt: new Date(),
        })
        .where(eq(schema.subscriptionPayments.id, payment!.id));

      return {
        free: false,
        payment: { ...payment!, adyenSessionId: sessionId },
        plan,
        billingCycle: cycle,
        paymentSession: {
          id: sessionId,
          sessionData,
          clientKey: creds.clientKey,
          environment: creds.dropinEnvironment,
        },
      };
    } catch (error: any) {
      await db
        .update(schema.subscriptionPayments)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(schema.subscriptionPayments.id, payment!.id));

      const msg = formatAdyenCheckoutApiError(error, {
        apiBase: creds.apiBase,
        merchantAccount: creds.merchantAccount,
        phase: "sessions",
      });
      console.error("Subscription Adyen checkout failed:", {
        status: error?.response?.status,
        data: error?.response?.data,
        merchantAccount: creds.merchantAccount,
        apiBase: creds.apiBase,
        environment: creds.environment,
        clientKeyPrefix: creds.clientKey.slice(0, 12),
        message: msg,
      });
      throw new Error(msg);
    }
  }

  static async confirmPayment(
    merchantId: string,
    paymentId: string,
    opts?: { resultCode?: string; pspReference?: string }
  ) {
    const db = getDb();
    const payment = await db.query.subscriptionPayments.findFirst({
      where: and(
        eq(schema.subscriptionPayments.id, paymentId),
        eq(schema.subscriptionPayments.merchantId, merchantId)
      ),
      with: { plan: true },
    });

    if (!payment) throw new Error("Payment not found");
    if (payment.status === "paid") {
      return { alreadyPaid: true, payment };
    }

    const resultCode = opts?.resultCode || "Authorised";
    const ok = ["Authorised", "Received", "Pending", "PresentToShopper"].includes(resultCode);
    if (!ok) {
      await db
        .update(schema.subscriptionPayments)
        .set({
          status: "failed",
          adyenResultCode: resultCode,
          adyenPspReference: opts?.pspReference || payment.adyenPspReference,
          updatedAt: new Date(),
        })
        .where(eq(schema.subscriptionPayments.id, paymentId));
      throw new Error(`Payment not successful (${resultCode})`);
    }

    const periodStart = payment.periodStart || new Date();
    const periodEnd =
      payment.periodEnd ||
      addMonths(periodStart, payment.billingCycle === "yearly" ? 12 : 1);

    const [updated] = await db
      .update(schema.subscriptionPayments)
      .set({
        status: "paid",
        adyenResultCode: resultCode,
        adyenPspReference: opts?.pspReference || payment.adyenPspReference,
        paidAt: new Date(),
        periodStart,
        periodEnd,
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptionPayments.id, paymentId))
      .returning();

    const planSlug = payment.plan?.slug;
    if (planSlug) {
      await db
        .update(schema.merchants)
        .set({
          subscriptionPlan: planSlug,
          subscriptionEndsAt: periodEnd,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(schema.merchants.id, merchantId));
    }

    return { alreadyPaid: false, payment: updated };
  }

  /** Mark paid from Adyen webhook (by session id or merchant reference metadata) */
  static async markPaidFromWebhook(opts: {
    sessionId?: string;
    paymentId?: string;
    resultCode?: string;
    pspReference?: string;
  }) {
    const db = getDb();
    let payment = null as typeof schema.subscriptionPayments.$inferSelect | null;

    if (opts.paymentId) {
      payment =
        (await db.query.subscriptionPayments.findFirst({
          where: eq(schema.subscriptionPayments.id, opts.paymentId),
        })) || null;
    } else if (opts.sessionId) {
      payment =
        (await db.query.subscriptionPayments.findFirst({
          where: eq(schema.subscriptionPayments.adyenSessionId, opts.sessionId),
        })) || null;
    }

    if (!payment) return null;
    if (payment.status === "paid") return payment;

    return (
      await this.confirmPayment(payment.merchantId, payment.id, {
        resultCode: opts.resultCode,
        pspReference: opts.pspReference,
      })
    ).payment;
  }
}
