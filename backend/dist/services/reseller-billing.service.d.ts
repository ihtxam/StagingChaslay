/** Platform settings key for reseller ? Chaslay monthly price list (CHF). */
export declare const RESELLER_BILLING_PRICES_KEY = "reseller_billing_prices";
/** Billable add-on keys (feature prices map). */
export type BillableFeatureKey = "online_shop" | "loyalty" | "gift_cards" | "terminals" | "website_cms" | "online_payments" | "offers" | "reservations" | "inventory" | "digital_signage" | "kds" | "ods";
export declare const BILLABLE_FEATURE_KEYS: BillableFeatureKey[];
export type ResellerBillingPrices = {
    currency: string;
    /** Monthly fee per merchant that has at least one active POS license */
    basePosMonthly: number;
    featurePrices: Partial<Record<BillableFeatureKey, number>>;
};
/**
 * Detect which billable add-ons are active for a merchant.
 * Prefer concrete merchant flags / terminals over edition-only capability.
 */
export declare function detectActiveBillableFeatures(merchant: {
    shopEnabled?: boolean | null;
    loyaltyEnabled?: boolean | null;
    webposGiftCardEnabled?: boolean | null;
    giftCardSettings?: unknown;
    reservationsEnabled?: boolean | null;
    inventoryAddonEnabled?: boolean | null;
    signageAddonEnabled?: boolean | null;
    kdsAddonEnabled?: boolean | null;
    odsAddonEnabled?: boolean | null;
    adyenApiKey?: string | null;
    customDomain?: string | null;
    editionFeatures?: string[] | null;
    hasActiveTerminal?: boolean;
}): BillableFeatureKey[];
export declare class ResellerBillingService {
    static defaultPrices(): ResellerBillingPrices;
    static getPriceList(): Promise<ResellerBillingPrices>;
    static setPriceList(input: Partial<ResellerBillingPrices>): Promise<ResellerBillingPrices>;
    /**
     * Invoice-style summary for a reseller.
     * Billing unit: merchants with ?1 active (non-expired) POS license.
     * Period is informational (current calendar month by default); amounts are monthly rates.
     */
    static getResellerInvoice(resellerId: string, opts?: {
        year?: number;
        month?: number;
    }): Promise<{
        reseller: {
            id: string;
            name: string;
            email: string;
            status: string;
            licenseSeats: number;
            seatsUsed: number;
            seatsRemaining: number;
        };
        period: {
            year: number;
            month: number;
            label: string;
            start: string;
            end: string;
            note: string;
        };
        pricingUnit: string;
        stats: {
            merchantCount: number;
            activeOrTrialCount: number;
            suspendedCount: number;
            billableMerchantCount: number;
            deviceCount: number;
            licenseSeatsAllocated: number;
            licenseSeatsUsed: number;
            licenseSeatsRemaining: number;
        };
        currency: string;
        prices: ResellerBillingPrices;
        merchants: {
            merchantId: string;
            name: string;
            status: string;
            billable: boolean;
            activeLicenses: number;
            devices: number;
            activeFeatures: BillableFeatureKey[];
        }[];
        lines: {
            code: string;
            description: string;
            quantity: number;
            unitPrice: number;
            amount: number;
        }[];
        subtotalBase: number;
        subtotalFeatures: number;
        totalDue: number;
    }>;
    /** Lightweight stats for reseller list rows */
    static getResellerStatsMap(resellerIds: string[]): Promise<Map<string, {
        merchantCount: number;
        activeOrTrialCount: number;
        suspendedCount: number;
        seatsUsed: number;
        billableMerchantCount: number;
        deviceCount: number;
    }>>;
}
//# sourceMappingURL=reseller-billing.service.d.ts.map