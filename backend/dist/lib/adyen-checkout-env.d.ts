/**
 * Merchant shop Checkout API environment (test vs live).
 * Derived from the Drop-in client key (test_… / live_…), never from platform ADYEN_ENVIRONMENT.
 *
 * Live Checkout API hosts MUST include the company-specific prefix from Adyen Customer Area
 * (Developers → API URLs), e.g. `{prefix}-checkout-live.adyen.com`. The unprefixed host
 * `checkout-live.adyen.com` is invalid and causes getaddrinfo ENOTFOUND.
 */
export type AdyenCheckoutEnvironment = "live" | "test";
export declare const LIVE_CHECKOUT_PREFIX_REQUIRED: string;
export declare function isValidAdyenClientKey(clientKey: string | null | undefined): boolean;
export declare function environmentFromClientKey(clientKey?: string | null): AdyenCheckoutEnvironment;
/** Shop card payments ready when merchant account, API key, and a real client key are set. */
export declare function shopAdyenCardReady(merchant: {
    adyenMerchantAccount?: string | null;
    adyenApiKey?: string | null;
    adyenClientId?: string | null;
}): boolean;
/** True when the host is the invalid unprefixed live Checkout hostname. */
export declare function isUnprefixedLiveCheckoutHost(url: string): boolean;
/** Normalize prefix from env or merchant settings (Customer Area “Live URL prefix”). */
export declare function normalizeLiveUrlPrefix(raw?: string | null): string;
/**
 * Live Checkout API base. Prefixed company URL wins; never use the unprefixed live host.
 * `merchantPrefix` comes from merchant settings (adyenLiveUrlPrefix) when env is unset.
 */
export declare function liveCheckoutApiBase(merchantPrefix?: string | null): string;
export declare function testCheckoutApiBase(): string;
export declare function checkoutApiBase(clientKey?: string | null, liveUrlPrefix?: string | null): string;
export declare function formatAdyenSessionError(error: unknown): string;
//# sourceMappingURL=adyen-checkout-env.d.ts.map