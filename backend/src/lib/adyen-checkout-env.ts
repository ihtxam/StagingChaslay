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
 * Case-sensitive: Adyen DNS uses the exact slug from Customer Area (ChaslayPayments, not chaslaypayments).
 */
export const PLATFORM_ADYEN_LIVE_URL_PREFIX = "1944d5c28c112475-ChaslayPayments";

/** Live Checkout API host suffix (Adyen docs + @adyen/api-library). */
export const LIVE_CHECKOUT_API_HOST_SUFFIX = "-checkout-live.adyenpayments.com";

export const LIVE_CHECKOUT_PREFIX_REQUIRED =
  "Live Adyen Checkout requires a live URL prefix from Adyen Customer Area " +
  "(Developers → API URLs). Set ADYEN_LIVE_URL_PREFIX to the value shown there " +
  "(for example 1944d5c28c112475-ChaslayPayments). " +
  "Do not use checkout-live.adyenpayments.com without that prefix.";

export function isValidAdyenClientKey(clientKey: string | null | undefined): boolean {
  const key = String(clientKey || "").trim();
  return key.startsWith("test_") || key.startsWith("live_");
}

export function environmentFromClientKey(
  clientKey?: string | null
): AdyenCheckoutEnvironment {
  return String(clientKey || "")
    .trim()
    .startsWith("live_")
    ? "live"
    : "test";
}

/** Shop card payments ready when merchant account, API key, and a real client key are set. */
export function shopAdyenCardReady(merchant: {
  adyenMerchantAccount?: string | null;
  adyenApiKey?: string | null;
  adyenClientId?: string | null;
}): boolean {
  return !!(
    merchant.adyenMerchantAccount &&
    merchant.adyenApiKey &&
    isValidAdyenClientKey(merchant.adyenClientId)
  );
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function looksLikeTestCheckoutUrl(url: string): boolean {
  return /checkout-test\.adyen\.com/i.test(url);
}

function looksLikeLiveCheckoutUrl(url: string): boolean {
  return /checkout-live\.adyen(?:payments)?\.com/i.test(url);
}

/** True when the host is the invalid unprefixed live Checkout hostname. */
export function isUnprefixedLiveCheckoutHost(url: string): boolean {
  const raw = String(url || "").trim();
  if (!raw) return false;
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const hostname = new URL(withProto).hostname;
    return /^checkout-live\.adyen(?:payments)?\.com$/i.test(hostname);
  } catch {
    return /^https?:\/\/checkout-live\.adyen(?:payments)?\.com(?:\/|$)/i.test(raw);
  }
}

/** Normalize prefix from env or merchant settings (Customer Area “Live URL prefix”). */
export function normalizeLiveUrlPrefix(raw?: string | null): string {
  return String(raw || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/-checkout-live.*$/i, "")
    .replace(/\/.*$/, "")
    .replace(/:+$/, "");
}

function prefixFromEnv(): string {
  return normalizeLiveUrlPrefix(
    process.env.ADYEN_LIVE_URL_PREFIX ||
      process.env.ADYEN_LIVE_ENDPOINT_PREFIX ||
      process.env.PLATFORM_ADYEN_LIVE_URL_PREFIX ||
      ""
  );
}

/**
 * Canonicalize a live URL prefix. Adyen DNS is case-sensitive for the company slug;
 * stale merchant DB values or lowercased env vars must not produce ENOTFOUND hosts.
 */
export function canonicalizeLiveUrlPrefix(raw?: string | null): string {
  const normalized = normalizeLiveUrlPrefix(raw);
  if (!normalized) return "";

  const platformHex = PLATFORM_ADYEN_LIVE_URL_PREFIX.split("-")[0] || "";
  const inputHex = normalized.split("-")[0] || "";
  if (
    platformHex &&
    inputHex.toLowerCase() === platformHex.toLowerCase()
  ) {
    return PLATFORM_ADYEN_LIVE_URL_PREFIX;
  }

  return normalized;
}

/** Platform env override → Swisspayout company default. Merchant DB prefix is ignored for shop checkout. */
export function resolveLiveUrlPrefix(_merchantPrefix?: string | null): string {
  return canonicalizeLiveUrlPrefix(prefixFromEnv()) || PLATFORM_ADYEN_LIVE_URL_PREFIX;
}

/**
 * Live Checkout API base. Prefixed company URL wins; never use the unprefixed live host.
 * `merchantPrefix` is ignored — all merchants share the platform prefix.
 */
export function liveCheckoutApiBase(_merchantPrefix?: string | null): string {
  const explicit = (
    process.env.ADYEN_API_BASE_LIVE ||
    process.env.PLATFORM_ADYEN_API_BASE_LIVE ||
    ""
  ).trim();
  if (explicit && !looksLikeTestCheckoutUrl(explicit)) {
    if (isUnprefixedLiveCheckoutHost(explicit)) {
      throw new Error(LIVE_CHECKOUT_PREFIX_REQUIRED);
    }
    return stripTrailingSlash(explicit);
  }

  const prefix = resolveLiveUrlPrefix();
  if (!prefix) {
    throw new Error(LIVE_CHECKOUT_PREFIX_REQUIRED);
  }

  return `https://${prefix}${LIVE_CHECKOUT_API_HOST_SUFFIX}/checkout/v71`;
}

export function testCheckoutApiBase(): string {
  const explicitTest = (process.env.ADYEN_API_BASE_TEST || "").trim();
  if (explicitTest) return stripTrailingSlash(explicitTest);

  const shared = (process.env.ADYEN_API_BASE || "").trim();
  if (shared && !looksLikeLiveCheckoutUrl(shared)) {
    return stripTrailingSlash(shared);
  }

  return "https://checkout-test.adyen.com/v71";
}

export function checkoutApiBase(
  clientKey?: string | null,
  liveUrlPrefix?: string | null
): string {
  return environmentFromClientKey(clientKey) === "live"
    ? liveCheckoutApiBase(liveUrlPrefix)
    : testCheckoutApiBase();
}

export function formatAdyenSessionError(error: unknown): string {
  const fallback = "Adyen payment session failed";
  if (!error || typeof error !== "object") {
    return error instanceof Error ? error.message : fallback;
  }

  const e = error as {
    response?: { status?: number; data?: Record<string, unknown> | string };
    message?: string;
  };
  if (e.message && e.message.includes("live URL prefix")) {
    return e.message;
  }
  const status = e.response?.status;
  const data = e.response?.data;
  const payload = data && typeof data === "object" ? data : undefined;
  const adyenMsg =
    typeof payload?.message === "string"
      ? payload.message
      : typeof data === "string"
        ? data
        : "";
  const errorCode = typeof payload?.errorCode === "string" ? payload.errorCode : "";
  const isUnauthorized =
    status === 401 ||
    errorCode === "000" ||
    /unauthorized/i.test(adyenMsg) ||
    /HTTP Status Response - Unauthorized/i.test(adyenMsg);

  if (isUnauthorized) {
    return (
      "Adyen rejected the API key (Unauthorized). Use the Checkout Web service API key from the same " +
      "Adyen account as the merchant account and client key (test_… or live_…). " +
      "Do not paste the API key into the client key field. Test and live credentials cannot be mixed."
    );
  }

  if (status === 403 || errorCode === "901" || /not allowed/i.test(adyenMsg)) {
    return (
      "Adyen permission denied for this merchant account. " +
      "Ensure the API key has Checkout webservice / Create payment session permission, " +
      "and that the live URL prefix is set if you are using live keys."
    );
  }

  if (adyenMsg) return adyenMsg;
  if (e.message) return e.message;
  return fallback;
}
