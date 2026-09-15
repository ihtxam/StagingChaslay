/** Merchant shop Adyen Checkout (Settings → Payments) — not platform subscription Adyen. */

export type AdyenCheckoutEnvironment = "live" | "test";

const ADYEN_API_BASE_TEST =
  process.env.ADYEN_API_BASE || "https://checkout-test.adyen.com/v71";
const ADYEN_API_BASE_LIVE =
  process.env.ADYEN_API_BASE_LIVE ||
  process.env.PLATFORM_ADYEN_API_BASE_LIVE ||
  "https://checkout-live.adyen.com/v71";

/** Derive live/test from Drop-in client key prefix (test_ / live_). */
export function adyenEnvironmentFromClientKey(
  clientKey?: string | null
): AdyenCheckoutEnvironment {
  return String(clientKey || "")
    .trim()
    .startsWith("live_")
    ? "live"
    : "test";
}

/** Checkout API host matching the merchant client key environment. */
export function adyenCheckoutApiBase(clientKey?: string | null): string {
  return adyenEnvironmentFromClientKey(clientKey) === "live"
    ? ADYEN_API_BASE_LIVE
    : ADYEN_API_BASE_TEST;
}

type AxiosLikeError = {
  isAxiosError?: boolean;
  response?: {
    status?: number;
    data?: { message?: string; errorCode?: string; errorType?: string } | string;
  };
  message?: string;
};

/** Map Checkout API failures to merchant Settings → Payments guidance. */
export function formatMerchantAdyenSessionError(error: unknown): string {
  const e = error as AxiosLikeError | null;
  const status = e?.response?.status;
  const data = e?.response?.data;
  const detail =
    (typeof data === "object" && data
      ? data.message || data.errorCode || data.errorType
      : typeof data === "string"
        ? data
        : undefined) ||
    (error instanceof Error ? error.message : undefined) ||
    e?.message;

  if (status === 401 || /unauthorized/i.test(String(detail || ""))) {
    return (
      "Adyen rejected the API key (Unauthorized). In Settings → Payments, use the Checkout Web service " +
      "API key, merchant account, and client key (test_… or live_…) from the same Adyen account. " +
      "The client key field must not contain the API key."
    );
  }
  if (status === 403 || /not allowed/i.test(String(detail || ""))) {
    return (
      "Adyen permission denied for this merchant account. Ensure the API key has Checkout webservice / " +
      "Create payment session permission in Adyen Customer Area."
    );
  }
  return String(detail || "Adyen payment session failed");
}
