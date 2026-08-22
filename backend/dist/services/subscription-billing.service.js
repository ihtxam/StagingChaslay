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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionBillingService = void 0;
const axios_1 = __importDefault(require("axios"));
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const platform_settings_service_1 = require("@/services/platform-settings.service");
const subscription_plans_service_1 = require("@/services/subscription-plans.service");
function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}
function planAmount(plan, cycle) {
    if (cycle === "yearly") {
        if (plan.priceYearly != null && plan.priceYearly !== "") {
            return Number(plan.priceYearly);
        }
        return Number(plan.priceMonthly) * 12;
    }
    return Number(plan.priceMonthly);
}
class SubscriptionBillingService {
    static async getBillingOverview(merchantId) {
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId),
        });
        if (!merchant)
            throw new Error("Merchant not found");
        const plans = await subscription_plans_service_1.SubscriptionPlansService.listPublic();
        const currentPlan = (await subscription_plans_service_1.SubscriptionPlansService.getBySlug(merchant.subscriptionPlan || "free")) || null;
        const payments = await db.query.subscriptionPayments.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.subscriptionPayments.merchantId, merchantId),
            orderBy: [(0, drizzle_orm_1.desc)(db_1.schema.subscriptionPayments.createdAt)],
            limit: 20,
            with: { plan: true },
        });
        let platformAdyenConfigured = false;
        try {
            await platform_settings_service_1.PlatformSettingsService.resolvePlatformAdyenCredentials();
            platformAdyenConfigured = true;
        }
        catch {
            platformAdyenConfigured = false;
        }
        const { WebPosEntitlementService } = await Promise.resolve().then(() => __importStar(require("@/services/webpos-entitlement.service")));
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
    static async startCheckout(merchantId, planId, billingCycle, returnUrl) {
        const db = (0, db_1.getDb)();
        const cycle = billingCycle === "yearly" ? "yearly" : "monthly";
        const plan = await subscription_plans_service_1.SubscriptionPlansService.getById(planId);
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
                .update(db_1.schema.merchants)
                .set({
                subscriptionPlan: plan.slug,
                subscriptionEndsAt: periodEnd,
                status: "active",
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
            const [payment] = await db
                .insert(db_1.schema.subscriptionPayments)
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
        const creds = await platform_settings_service_1.PlatformSettingsService.resolvePlatformAdyenCredentials();
        const [payment] = await db
            .insert(db_1.schema.subscriptionPayments)
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
        const reference = `sub-${merchantId.slice(0, 8)}-${payment.id.slice(0, 8)}`;
        const defaultReturn = returnUrl ||
            `${process.env.MERCHANT_DASHBOARD_URL || process.env.PUBLIC_APP_URL || ""}/merchant/billing?paymentId=${payment.id}`;
        try {
            const sessionPayload = {
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
                    paymentId: payment.id,
                    merchantId,
                    planId: plan.id,
                    billingCycle: cycle,
                },
            };
            const response = await axios_1.default.post(`${creds.apiBase}/sessions`, sessionPayload, {
                headers: {
                    "x-api-key": creds.apiKey,
                    "Content-Type": "application/json",
                },
            });
            const sessionId = response.data?.id;
            const sessionData = response.data?.sessionData;
            if (!sessionId || !sessionData) {
                console.error("Adyen /sessions response missing id or sessionData:", response.data);
                throw new Error("Adyen session response was incomplete. Check platform API key and merchant account match the client key account.");
            }
            await db
                .update(db_1.schema.subscriptionPayments)
                .set({
                adyenSessionId: sessionId,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptionPayments.id, payment.id));
            return {
                free: false,
                payment: { ...payment, adyenSessionId: sessionId },
                plan,
                billingCycle: cycle,
                paymentSession: {
                    id: sessionId,
                    sessionData,
                    clientKey: creds.clientKey,
                    environment: creds.dropinEnvironment,
                },
            };
        }
        catch (error) {
            await db
                .update(db_1.schema.subscriptionPayments)
                .set({ status: "failed", updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptionPayments.id, payment.id));
            const msg = (0, platform_settings_service_1.formatAdyenCheckoutApiError)(error, {
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
    static async confirmPayment(merchantId, paymentId, opts) {
        const db = (0, db_1.getDb)();
        const payment = await db.query.subscriptionPayments.findFirst({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.subscriptionPayments.id, paymentId), (0, drizzle_orm_1.eq)(db_1.schema.subscriptionPayments.merchantId, merchantId)),
            with: { plan: true },
        });
        if (!payment)
            throw new Error("Payment not found");
        if (payment.status === "paid") {
            return { alreadyPaid: true, payment };
        }
        const resultCode = opts?.resultCode || "Authorised";
        const ok = ["Authorised", "Received", "Pending", "PresentToShopper"].includes(resultCode);
        if (!ok) {
            await db
                .update(db_1.schema.subscriptionPayments)
                .set({
                status: "failed",
                adyenResultCode: resultCode,
                adyenPspReference: opts?.pspReference || payment.adyenPspReference,
                updatedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptionPayments.id, paymentId));
            throw new Error(`Payment not successful (${resultCode})`);
        }
        const periodStart = payment.periodStart || new Date();
        const periodEnd = payment.periodEnd ||
            addMonths(periodStart, payment.billingCycle === "yearly" ? 12 : 1);
        const [updated] = await db
            .update(db_1.schema.subscriptionPayments)
            .set({
            status: "paid",
            adyenResultCode: resultCode,
            adyenPspReference: opts?.pspReference || payment.adyenPspReference,
            adyenRecurringDetailReference: opts?.recurringDetailReference || payment.adyenRecurringDetailReference,
            paidAt: new Date(),
            periodStart,
            periodEnd,
            updatedAt: new Date(),
        })
            .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptionPayments.id, paymentId))
            .returning();
        const planSlug = payment.plan?.slug;
        if (planSlug) {
            const merchantPatch = {
                subscriptionPlan: planSlug,
                subscriptionEndsAt: periodEnd,
                subscriptionBillingCycle: payment.billingCycle,
                status: "active",
                updatedAt: new Date(),
            };
            const recurringRef = opts?.recurringDetailReference || payment.adyenRecurringDetailReference;
            if (recurringRef) {
                merchantPatch.adyenRecurringDetailReference = recurringRef;
            }
            await db
                .update(db_1.schema.merchants)
                .set(merchantPatch)
                .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchantId));
        }
        return { alreadyPaid: false, payment: updated };
    }
    /** Mark paid from Adyen webhook (by session id or merchant reference metadata) */
    static async markPaidFromWebhook(opts) {
        const db = (0, db_1.getDb)();
        let payment = null;
        if (opts.paymentId) {
            payment =
                (await db.query.subscriptionPayments.findFirst({
                    where: (0, drizzle_orm_1.eq)(db_1.schema.subscriptionPayments.id, opts.paymentId),
                })) || null;
        }
        else if (opts.sessionId) {
            payment =
                (await db.query.subscriptionPayments.findFirst({
                    where: (0, drizzle_orm_1.eq)(db_1.schema.subscriptionPayments.adyenSessionId, opts.sessionId),
                })) || null;
        }
        if (!payment)
            return null;
        if (payment.status === "paid")
            return payment;
        return (await this.confirmPayment(payment.merchantId, payment.id, {
            resultCode: opts.resultCode,
            pspReference: opts.pspReference,
            recurringDetailReference: opts.recurringDetailReference,
        })).payment;
    }
    /**
     * Charge merchants whose subscription period has ended using stored Adyen token.
     * Called hourly from backend scheduler.
     */
    static async processRecurringRenewals() {
        const db = (0, db_1.getDb)();
        const now = new Date();
        const dueMerchants = await db.query.merchants.findMany({
            where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.merchants.status, "active"), (0, drizzle_orm_1.lte)(db_1.schema.merchants.subscriptionEndsAt, now)),
        });
        let charged = 0;
        let failed = 0;
        for (const merchant of dueMerchants) {
            const token = String(merchant.adyenRecurringDetailReference || "").trim();
            const cycle = (merchant.subscriptionBillingCycle === "yearly"
                ? "yearly"
                : "monthly");
            if (!token) {
                await db
                    .update(db_1.schema.merchants)
                    .set({ status: "expired", updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchant.id));
                failed += 1;
                continue;
            }
            const plan = (await subscription_plans_service_1.SubscriptionPlansService.getBySlug(merchant.subscriptionPlan || "free")) || null;
            if (!plan || !plan.isActive) {
                failed += 1;
                continue;
            }
            const amount = planAmount(plan, cycle);
            if (!amount || amount <= 0) {
                const periodEnd = addMonths(now, cycle === "yearly" ? 12 : 1);
                await db
                    .update(db_1.schema.merchants)
                    .set({ subscriptionEndsAt: periodEnd, updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchant.id));
                continue;
            }
            try {
                await this.chargeStoredSubscription(merchant.id, plan.id, cycle, token, amount);
                charged += 1;
            }
            catch (err) {
                console.error(`Recurring subscription charge failed for ${merchant.id}:`, err);
                await db
                    .update(db_1.schema.merchants)
                    .set({ status: "suspended", updatedAt: new Date() })
                    .where((0, drizzle_orm_1.eq)(db_1.schema.merchants.id, merchant.id));
                failed += 1;
            }
        }
        return { charged, failed, checked: dueMerchants.length };
    }
    static async chargeStoredSubscription(merchantId, planId, cycle, recurringDetailReference, amount) {
        const db = (0, db_1.getDb)();
        const plan = await subscription_plans_service_1.SubscriptionPlansService.getById(planId);
        const currency = (plan.currency || "CHF").toUpperCase();
        const creds = await platform_settings_service_1.PlatformSettingsService.resolvePlatformAdyenCredentials();
        const periodStart = new Date();
        const periodEnd = addMonths(periodStart, cycle === "yearly" ? 12 : 1);
        const [payment] = await db
            .insert(db_1.schema.subscriptionPayments)
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
        const reference = `sub-renew-${merchantId.slice(0, 8)}-${payment.id.slice(0, 8)}`;
        const response = await axios_1.default.post(`${creds.apiBase}/payments`, {
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
                paymentId: payment.id,
                merchantId,
                planId: plan.id,
                billingCycle: cycle,
            },
        }, {
            headers: {
                "x-api-key": creds.apiKey,
                "Content-Type": "application/json",
            },
        });
        const resultCode = String(response.data?.resultCode || "");
        const ok = ["Authorised", "Received"].includes(resultCode);
        if (!ok) {
            await db
                .update(db_1.schema.subscriptionPayments)
                .set({ status: "failed", adyenResultCode: resultCode, updatedAt: new Date() })
                .where((0, drizzle_orm_1.eq)(db_1.schema.subscriptionPayments.id, payment.id));
            throw new Error(`Recurring charge declined (${resultCode})`);
        }
        await this.confirmPayment(merchantId, payment.id, {
            resultCode,
            pspReference: response.data?.pspReference,
            recurringDetailReference,
        });
    }
}
exports.SubscriptionBillingService = SubscriptionBillingService;
//# sourceMappingURL=subscription-billing.service.js.map