/**
 * Merchant shop Checkout API environment (test vs live).
 * Derived from the Drop-in client key (test_… / live_…), never from platform ADYEN_ENVIRONMENT.
 *
 * Live Checkout API hosts MUST include the company-specific prefix on adyenpayments.com.
 * Merchants do not enter this: the Swisspayout/Chaslay company prefix is applied automatically
 * (override with ADYEN_LIVE_URL_PREFIX).
 */
export type AdyenCheckoutEnvironment = "live" | "test";
/**
 * Swisspayout / Chaslay Adyen company live prefix.
 * Shared for all merchants — they do not need to paste an endpoint URL.
 * Override with ADYEN_LIVE_URL_PREFIX when the company prefix changes.
 * Case-sensitive: Adyen DNS uses the exact slug from Customer Area (Chaslay, not chaslay).
 */
export declare const PLATFORM_ADYEN_LIVE_URL_PREFIX = "1797a841fbb37ca7-Chaslay";
/** Live Checkout API host suffix (Adyen docs + @adyen/api-library). */
export declare const LIVE_CHECKOUT_API_HOST_SUFFIX = "-checkout-live.adyenpayments.com";
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
 * Canonicalize a live URL prefix. Adyen DNS is case-sensitive for the company slug;
 * stale merchant DB values or lowercased env vars must not produce ENOTFOUND hosts.
 */
export declare function canonicalizeLiveUrlPrefix(raw?: string | null): string;
/** Platform env override → Swisspayout company default. Merchant DB prefix is ignored for shop checkout. */
export declare function resolveLiveUrlPrefix(_merchantPrefix?: string | null): string;
/**
 * Live Checkout API base. Prefixed company URL wins; never use the unprefixed live host.
 * `merchantPrefix` comes from merchant settings (adyenLiveUrlPrefix) when env is unset.
 */
export declare function liveCheckoutApiBase(merchantPrefix?: string | null): string;
export declare function testCheckoutApiBase(): string;
export declare function checkoutApiBase(clientKey?: string | null, liveUrlPrefix?: string | null): string;
export declare function formatAdyenSessionError(error: unknown): string;
