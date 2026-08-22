export type WebPosEntitlementReason = "ok" | "trial" | "subscription" | "legacy" | "trial_expired" | "subscription_expired" | "suspended" | "not_found";
export type WebPosEntitlement = {
    allowed: boolean;
    reason: WebPosEntitlementReason;
    status: string;
    trialEndsAt: string | null;
    subscriptionEndsAt: string | null;
    subscriptionPlan: string | null;
    /** Whole days left on trial or subscription; null when not applicable */
    daysRemaining: number | null;
    reseller: {
        id: string;
        name: string;
        email: string;
        phone: string | null;
    } | null;
};
/**
 * Merchant-level WebPOS access (account trial / subscription).
 * Independent of Android device seat licenses.
 *
 * Rules:
 * - suspended → blocked
 * - valid subscriptionEndsAt → allowed
 * - trialEndsAt still in the future → allowed (status trial or active)
 * - status active with no dates → allowed (legacy / grandfathered)
 * - otherwise → blocked (trial or subscription expired)
 *
 * Does NOT flip merchant.status to "expired" so owners can still log in to Billing.
 */
export declare class WebPosEntitlementService {
    static getEntitlement(merchantId: string): Promise<WebPosEntitlement>;
    static assertAllowed(merchantId: string): Promise<WebPosEntitlement>;
    /** Express helper — returns false and writes 402 when blocked. */
    static guard(merchantId: string | undefined, res: {
        status: (code: number) => {
            json: (body: unknown) => void;
        };
    }): Promise<boolean>;
}
//# sourceMappingURL=webpos-entitlement.service.d.ts.map