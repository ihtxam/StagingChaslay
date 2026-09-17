/**
 * Merchant shop Checkout API environment (test vs live).
 * Derived from the Drop-in client key (test_… / live_…), never from platform ADYEN_ENVIRONMENT.
 */

export type AdyenCheckoutEnvironment = "live" | "test";

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
  return /checkout-live\.adyen\.com/i.test(url);
}

/** Live Checkout API base. Prefixed company URL wins; never reuse the test host. */
export function liveCheckoutApiBase(): string {
  const explicit = (
    process.env.ADYEN_API_BASE_LIVE ||
    process.env.PLATFORM_ADYEN_API_BASE_LIVE ||
    ""
  ).trim();
  if (explicit && !looksLikeTestCheckoutUrl(explicit)) {
    return stripTrailingSlash(explicit);
  }

  const prefix = (
    process.env.ADYEN_LIVE_URL_PREFIX ||
    process.env.ADYEN_LIVE_ENDPOINT_PREFIX ||
    process.env.PLATFORM_ADYEN_LIVE_URL_PREFIX ||
    ""
  )
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/-checkout-live.*$/i, "")
    .replace(/\/.*$/, "");
  if (prefix) {
    return `https://${prefix}-checkout-live.adyen.com/checkout/v71`;
  }

  return "https://checkout-live.adyen.com/checkout/v71";
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

export function checkoutApiBase(clientKey?: string | null): string {
  return environmentFromClientKey(clientKey) === "live"
    ? liveCheckoutApiBase()
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
