import axios from "axios";
import { and, desc, eq, lte } from "drizzle-orm";
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
        storePaymentMethod: true,
        recurringProcessingModel: "Subscription",
        shopperInteraction: "Ecommerce",
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
    opts?: {
      resultCode?: string;
      pspReference?: string;
      recurringDetailReference?: string;
    }
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
        adyenRecurringDetailReference:
          opts?.recurringDetailReference || payment.adyenRecurringDetailReference,
        paidAt: new Date(),
        periodStart,
        periodEnd,
        updatedAt: new Date(),
      })
      .where(eq(schema.subscriptionPayments.id, paymentId))
      .returning();

    const planSlug = payment.plan?.slug;
    if (planSlug) {
      const merchantPatch: Record<string, unknown> = {
        subscriptionPlan: planSlug,
        subscriptionEndsAt: periodEnd,
        subscriptionBillingCycle: payment.billingCycle,
        status: "active",
        updatedAt: new Date(),
      };
      const recurringRef =
        opts?.recurringDetailReference || payment.adyenRecurringDetailReference;
      if (recurringRef) {
        merchantPatch.adyenRecurringDetailReference = recurringRef;
      }
      await db
        .update(schema.merchants)
        .set(merchantPatch as typeof schema.merchants.$inferInsert)
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
    recurringDetailReference?: string;
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
        recurringDetailReference: opts.recurringDetailReference,
      })
    ).payment;
  }

  /**
   * Charge merchants whose subscription period has ended using stored Adyen token.
   * Called hourly from backend scheduler.
   */
  static async processRecurringRenewals() {
    const db = getDb();
    const now = new Date();
    const dueMerchants = await db.query.merchants.findMany({
      where: and(
        eq(schema.merchants.status, "active"),
        lte(schema.merchants.subscriptionEndsAt, now)
      ),
    });

    let charged = 0;
    let failed = 0;

    for (const merchant of dueMerchants) {
      const token = String(merchant.adyenRecurringDetailReference || "").trim();
      const cycle = (merchant.subscriptionBillingCycle === "yearly"
        ? "yearly"
        : "monthly") as BillingCycle;
      if (!token) {
        await db
          .update(schema.merchants)
          .set({ status: "expired", updatedAt: new Date() })
          .where(eq(schema.merchants.id, merchant.id));
        failed += 1;
        continue;
      }

      const plan =
        (await SubscriptionPlansService.getBySlug(merchant.subscriptionPlan || "free")) || null;
      if (!plan || !plan.isActive) {
        failed += 1;
        continue;
      }

      const amount = planAmount(plan, cycle);
      if (!amount || amount <= 0) {
        const periodEnd = addMonths(now, cycle === "yearly" ? 12 : 1);
        await db
          .update(schema.merchants)
          .set({ subscriptionEndsAt: periodEnd, updatedAt: new Date() })
          .where(eq(schema.merchants.id, merchant.id));
        continue;
      }

      try {
        await this.chargeStoredSubscription(merchant.id, plan.id, cycle, token, amount);
        charged += 1;
      } catch (err) {
        console.error(`Recurring subscription charge failed for ${merchant.id}:`, err);
        await db
          .update(schema.merchants)
          .set({ status: "suspended", updatedAt: new Date() })
          .where(eq(schema.merchants.id, merchant.id));
        failed += 1;
      }
    }

    return { charged, failed, checked: dueMerchants.length };
  }

  private static async chargeStoredSubscription(
    merchantId: string,
    planId: string,
    cycle: BillingCycle,
    recurringDetailReference: string,
    amount: number
  ) {
    const db = getDb();
    const plan = await SubscriptionPlansService.getById(planId);
    const currency = (plan.currency || "CHF").toUpperCase();
    const creds = await PlatformSettingsService.resolvePlatformAdyenCredentials();
    const periodStart = new Date();
    const periodEnd = addMonths(periodStart, cycle === "yearly" ? 12 : 1);

    const [payment] = await db
      .insert(schema.subscriptionPayments)
      .values({
        merchantId,
        planId: plan.id,
        billingCycle: cycle,
        amount: amount.toFixed(2),
        currency,
        status: "pending",
        isRecurring: true,
        adyenRecurringDetailReference: recurringDetailReference,
        periodStart,
        periodEnd,
      })
      .returning();

    const reference = `sub-renew-${merchantId.slice(0, 8)}-${payment!.id.slice(0, 8)}`;

    const response = await axios.post(
      `${creds.apiBase}/payments`,
      {
        amount: { value: Math.round(amount * 100), currency },
        merchantAccount: creds.merchantAccount,
        reference,
        shopperReference: merchantId,
        shopperInteraction: "ContAuth",
        recurringProcessingModel: "Subscription",
        paymentMethod: {
          type: "scheme",
          storedPaymentMethodId: recurringDetailReference,
        },
        metadata: {
          type: "subscription_renewal",
          paymentId: payment!.id,
          merchantId,
          planId: plan.id,
          billingCycle: cycle,
        },
      },
      {
        headers: {
          "x-api-key": creds.apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    const resultCode = String(response.data?.resultCode || "");
    const ok = ["Authorised", "Received"].includes(resultCode);
    if (!ok) {
      await db
        .update(schema.subscriptionPayments)
        .set({ status: "failed", adyenResultCode: resultCode, updatedAt: new Date() })
        .where(eq(schema.subscriptionPayments.id, payment!.id));
      throw new Error(`Recurring charge declined (${resultCode})`);
    }

    await this.confirmPayment(merchantId, payment!.id, {
      resultCode,
      pspReference: response.data?.pspReference,
      recurringDetailReference,
    });
  }
}
