export type BillingCycle = "monthly" | "yearly";
export declare class SubscriptionBillingService {
    static getBillingOverview(merchantId: string): Promise<{
        merchant: {
            id: string;
            name: string;
            email: string;
            subscriptionPlan: string | null;
            status: string;
            subscriptionEndsAt: Date | null;
            trialEndsAt: Date | null;
        };
        currentPlan: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            features: string[] | null;
            slug: string;
            sortOrder: number;
            description: string | null;
            priceMonthly: string;
            priceYearly: string | null;
            currency: string;
            maxDevices: number;
            maxProducts: number | null;
            isPublic: boolean;
            trialDays: number;
        } | null;
        plans: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            features: string[] | null;
            slug: string;
            sortOrder: number;
            description: string | null;
            priceMonthly: string;
            priceYearly: string | null;
            currency: string;
            maxDevices: number;
            maxProducts: number | null;
            isPublic: boolean;
            trialDays: number;
        }[];
        payments: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            adyenRecurringDetailReference: string | null;
            merchantId: string;
            currency: string;
            planId: string;
            billingCycle: string;
            amount: string;
            adyenSessionId: string | null;
            adyenPspReference: string | null;
            isRecurring: boolean;
            adyenResultCode: string | null;
            paidAt: Date | null;
            periodStart: Date | null;
            periodEnd: Date | null;
            plan: {
                id: string;
                name: string;
                isActive: boolean;
                createdAt: Date;
                updatedAt: Date;
                features: string[] | null;
                slug: string;
                sortOrder: number;
                description: string | null;
                priceMonthly: string;
                priceYearly: string | null;
                currency: string;
                maxDevices: number;
                maxProducts: number | null;
                isPublic: boolean;
                trialDays: number;
            };
        }[];
        platformAdyenConfigured: boolean;
        webposEntitlement: import("@/services/webpos-entitlement.service").WebPosEntitlement;
    }>;
    static startCheckout(merchantId: string, planId: string, billingCycle: BillingCycle, returnUrl?: string): Promise<{
        free: boolean;
        payment: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            adyenRecurringDetailReference: string | null;
            merchantId: string;
            currency: string;
            planId: string;
            billingCycle: string;
            amount: string;
            adyenSessionId: string | null;
            adyenPspReference: string | null;
            isRecurring: boolean;
            adyenResultCode: string | null;
            paidAt: Date | null;
            periodStart: Date | null;
            periodEnd: Date | null;
        };
        plan: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            features: string[] | null;
            slug: string;
            sortOrder: number;
            description: string | null;
            priceMonthly: string;
            priceYearly: string | null;
            currency: string;
            maxDevices: number;
            maxProducts: number | null;
            isPublic: boolean;
            trialDays: number;
        };
        billingCycle: BillingCycle;
        paymentSession?: undefined;
    } | {
        free: boolean;
        payment: {
            adyenSessionId: any;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            adyenRecurringDetailReference: string | null;
            merchantId: string;
            currency: string;
            planId: string;
            billingCycle: string;
            amount: string;
            adyenPspReference: string | null;
            isRecurring: boolean;
            adyenResultCode: string | null;
            paidAt: Date | null;
            periodStart: Date | null;
            periodEnd: Date | null;
        };
        plan: {
            id: string;
            name: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            features: string[] | null;
            slug: string;
            sortOrder: number;
            description: string | null;
            priceMonthly: string;
            priceYearly: string | null;
            currency: string;
            maxDevices: number;
            maxProducts: number | null;
            isPublic: boolean;
            trialDays: number;
        };
        billingCycle: BillingCycle;
        paymentSession: {
            id: any;
            sessionData: any;
            clientKey: string;
            environment: "live" | "test";
        };
    }>;
    static confirmPayment(merchantId: string, paymentId: string, opts?: {
        resultCode?: string;
        pspReference?: string;
        recurringDetailReference?: string;
    }): Promise<{
        alreadyPaid: boolean;
        payment: {
            id: string;
            merchantId: string;
            planId: string;
            billingCycle: string;
            amount: string;
            currency: string;
            status: string;
            adyenSessionId: string | null;
            adyenPspReference: string | null;
            adyenRecurringDetailReference: string | null;
            isRecurring: boolean;
            adyenResultCode: string | null;
            paidAt: Date | null;
            periodStart: Date | null;
            periodEnd: Date | null;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    /** Mark paid from Adyen webhook (by session id or merchant reference metadata) */
    static markPaidFromWebhook(opts: {
        sessionId?: string;
        paymentId?: string;
        resultCode?: string;
        pspReference?: string;
        recurringDetailReference?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        adyenRecurringDetailReference: string | null;
        merchantId: string;
        currency: string;
        planId: string;
        billingCycle: string;
        amount: string;
        adyenSessionId: string | null;
        adyenPspReference: string | null;
        isRecurring: boolean;
        adyenResultCode: string | null;
        paidAt: Date | null;
        periodStart: Date | null;
        periodEnd: Date | null;
    } | null>;
    /**
     * Charge merchants whose subscription period has ended using stored Adyen token.
     * Called hourly from backend scheduler.
     */
    static processRecurringRenewals(): Promise<{
        charged: number;
        failed: number;
        checked: number;
    }>;
    private static chargeStoredSubscription;
}
//# sourceMappingURL=subscription-billing.service.d.ts.map