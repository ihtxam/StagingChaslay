/**
 * Platform (Reborn subscription) Adyen credentials.
 *
 * Billing / package checkout MUST use Superadmin → Settings → Payment (Adyen)
 * — never merchant shop Adyen (Settings → Payments) and never ADYEN_API_KEY /
 * ADYEN_CLIENT_KEY / ADYEN_MERCHANT_ACCOUNT shop env fallbacks.
 */

import { liveCheckoutApiBase, testCheckoutApiBase } from "@/lib/adyen-checkout-env";

export type PlatformAdyenLocale = "en" | "fr" | "de";

export type PlatformAdyenDbFields = {
  apiKey?: string | null;
  merchantAccount?: string | null;
  clientKey?: string | null;
  environment?: string | null;
  hmacKey?: string | null;
};

/** Merchant Settings → Payments (shop) — must never be used for subscriptions. */
export type MerchantShopAdyenFields = {
  adyenApiKey?: string | null;
  adyenMerchantAccount?: string | null;
  adyenClientId?: string | null;
};

export type EnvLike = Record<string, string | undefined>;

export type PlatformAdyenSource =
  | "superadmin_db"
  | "platform_env"
  | "incomplete_db"
  | "none";

export type PickedPlatformAdyen = {
  source: PlatformAdyenSource;
  values: {
    apiKey: string;
    merchantAccount: string;
    clientKey: string;
    environment: "TEST" | "LIVE";
    hmacKey: string;
  };
  missing: Array<"apiKey" | "merchantAccount" | "clientKey">;
  /** Shop env vars or merchant.adyen* were present and deliberately ignored. */
  ignoredShop: boolean;
};

export type PlatformAdyenIssue = {
  field: "apiKey" | "merchantAccount" | "clientKey" | "environment" | "bundle";
  message: string;
};

export type PlatformAdyenDiagnosis = {
  ready: boolean;
  source: PlatformAdyenSource;
  missing: PickedPlatformAdyen["missing"];
  issues: PlatformAdyenIssue[];
  suspectedField: PlatformAdyenIssue["field"] | null;
  shopEnvIgnored: boolean;
  environment: "TEST" | "LIVE";
  merchantAccount: string;
  apiKeySet: boolean;
  apiKeyLooksLikeClientKey: boolean;
  apiKeyLooksLikeWebService: boolean;
  clientKeySet: boolean;
  clientKeyPrefix: "test_" | "live_" | "";
  recipe: string;
};

export const MERCHANT_BILLING_UNAVAILABLE: Record<PlatformAdyenLocale, string> = {
  en: "Billing is temporarily unavailable. Please try again later.",
  fr: "La facturation est temporairement indisponible. Veuillez réessayer plus tard.",
  de: "Die Abrechnung ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.",
};

export const BILLING_UNAVAILABLE_CODE = "BILLING_UNAVAILABLE";

const SHOP_ENV_KEYS = [
  "ADYEN_API_KEY",
  "ADYEN_CLIENT_KEY",
  "ADYEN_CLIENT_ID",
  "ADYEN_MERCHANT_ACCOUNT",
] as const;

export function normalizeAdyenEnvironment(value?: string | null): "TEST" | "LIVE" {
  return value?.toUpperCase() === "LIVE" ? "LIVE" : "TEST";
}

function trim(value?: string | null): string {
  return String(value || "").trim();
}

export function platformPanelLocale(raw?: string | null): PlatformAdyenLocale {
  const lang = String(raw || "en").toLowerCase().slice(0, 2);
  if (lang === "fr") return "fr";
  if (lang === "de") return "de";
  return "en";
}

export function merchantBillingUnavailableMessage(locale?: string | null): string {
  return MERCHANT_BILLING_UNAVAILABLE[platformPanelLocale(locale)];
}

export function isPlatformBillingCredentialFailure(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error || "");
  return (
    /platform credentials|Platform Adyen|Superadmin → Settings → Payment/i.test(msg) ||
    /Adyen (POST \/sessions|Checkout API) rejected/i.test(msg) ||
    /Adyen permission denied for merchant account/i.test(msg) ||
    /HTTP Status Response - Unauthorized/i.test(msg) ||
    (/Unauthorized/i.test(msg) && /Adyen/i.test(msg)) ||
    /client key looks like|API key looks like a client key/i.test(msg) ||
    /Mixed database \+ environment credentials/i.test(msg) ||
    /not configured\. Set it in Superadmin/i.test(msg)
  );
}

export function merchantFacingBillingPayload(
  error: unknown,
  locale?: string | null,
  fallback = "Failed to start checkout"
): { error: string; code?: typeof BILLING_UNAVAILABLE_CODE } {
  if (isPlatformBillingCredentialFailure(error)) {
    return {
      error: merchantBillingUnavailableMessage(locale),
      code: BILLING_UNAVAILABLE_CODE,
    };
  }
  return {
    error: error instanceof Error ? error.message : fallback,
  };
}

/** Shop ADYEN_* env — ignored for platform billing. */
export function shopAdyenEnvPresent(env: EnvLike = process.env): boolean {
  return SHOP_ENV_KEYS.some((key) => !!trim(env[key]));
}

export function merchantShopAdyenPresent(shop?: MerchantShopAdyenFields | null): boolean {
  if (!shop) return false;
  return !!(
    trim(shop.adyenApiKey) ||
    trim(shop.adyenMerchantAccount) ||
    trim(shop.adyenClientId)
  );
}

export function platformAdyenEnvOnly(env: EnvLike = process.env) {
  return {
    apiKey: trim(env.PLATFORM_ADYEN_API_KEY),
    merchantAccount: trim(env.PLATFORM_ADYEN_MERCHANT_ACCOUNT),
    clientKey: trim(env.PLATFORM_ADYEN_CLIENT_KEY),
    environment: normalizeAdyenEnvironment(env.PLATFORM_ADYEN_ENVIRONMENT),
    hmacKey: trim(env.PLATFORM_ADYEN_HMAC_KEY),
  };
}

/**
 * Pick the Superadmin / PLATFORM_ADYEN_* bundle only.
 * Never copies ADYEN_* shop env or merchant.adyen* into the result.
 */
export function pickPlatformAdyenSource(
  db: PlatformAdyenDbFields,
  env: EnvLike = process.env,
  merchantShop?: MerchantShopAdyenFields | null
): PickedPlatformAdyen {
  const dbApi = trim(db.apiKey);
  const dbMerchant = trim(db.merchantAccount);
  const dbClient = trim(db.clientKey);
  const hasDbAny = !!(dbApi || dbMerchant || dbClient);
  const ignoredShop = shopAdyenEnvPresent(env) || merchantShopAdyenPresent(merchantShop);

  if (hasDbAny) {
    const missing: PickedPlatformAdyen["missing"] = [];
    if (!dbApi) missing.push("apiKey");
    if (!dbMerchant) missing.push("merchantAccount");
    if (!dbClient) missing.push("clientKey");
    return {
      source: missing.length ? "incomplete_db" : "superadmin_db",
      values: {
        apiKey: dbApi,
        merchantAccount: dbMerchant,
        clientKey: dbClient,
        environment: normalizeAdyenEnvironment(db.environment),
        hmacKey: trim(db.hmacKey) || trim(env.PLATFORM_ADYEN_HMAC_KEY),
      },
      missing,
      ignoredShop,
    };
  }

  const plat = platformAdyenEnvOnly(env);
  const missing: PickedPlatformAdyen["missing"] = [];
  if (!plat.apiKey) missing.push("apiKey");
  if (!plat.merchantAccount) missing.push("merchantAccount");
  if (!plat.clientKey) missing.push("clientKey");
  return {
    source: missing.length ? "none" : "platform_env",
    values: {
      apiKey: plat.apiKey,
      merchantAccount: plat.merchantAccount,
      clientKey: plat.clientKey,
      environment: plat.environment,
      hmacKey: plat.hmacKey,
    },
    missing,
    ignoredShop,
  };
}

export function validatePlatformAdyenApiKey(apiKey: string): string {
  const key = apiKey.trim();
  if (!key) {
    throw new Error(
      "Platform Adyen API key is missing. Set it in Superadmin → Settings → Payment (Adyen)."
    );
  }
  if (/^(test|live)_/.test(key)) {
    throw new Error(
      "Platform Adyen API key looks like a client key (test_/live_). Use the Web service API key from Adyen Customer Area → Developers → API credentials (starts with AQE…)."
    );
  }
  return key;
}

/** Client key for Drop-in (test_… / live_…), not the web service API key (AQE…). */
export function validateAdyenClientKey(
  clientKey: string,
  environment?: string | null
): string {
  const key = clientKey.trim();
  if (!key) {
    throw new Error(
      "Platform Adyen client key is missing. Set it in Superadmin → Settings → Payment (Adyen)."
    );
  }
  if (key.startsWith("AQE") || key.startsWith("AQE0")) {
    throw new Error(
      "Invalid client key: this looks like an Adyen API key. Use the Client Key from Customer Area → Developers → Client settings (starts with test_ or live_)."
    );
  }
  if (!/^(test|live)_/.test(key)) {
    throw new Error(
      "Invalid Adyen client key. It must start with test_ (test environment) or live_ (live environment)."
    );
  }
  const env = normalizeAdyenEnvironment(environment);
  if (env === "TEST" && !key.startsWith("test_")) {
    throw new Error(
      "Environment is TEST but the client key is not a test key (must start with test_)."
    );
  }
  if (env === "LIVE" && !key.startsWith("live_")) {
    throw new Error(
      "Environment is LIVE but the client key is not a live key (must start with live_)."
    );
  }
  return key;
}

export function adyenDropinEnvironment(clientKey: string): "live" | "test" {
  return clientKey.trim().startsWith("live_") ? "live" : "test";
}

/** Checkout API host from the client-key environment — never a shop live URL for TEST keys. */
export function platformCheckoutApiBase(dropinEnv: "live" | "test"): string {
  if (dropinEnv === "live") {
    return liveCheckoutApiBase();
  }
  const platform = trim(process.env.PLATFORM_ADYEN_API_BASE);
  if (platform && !/live/i.test(platform)) {
    return platform.replace(/\/+$/, "");
  }
  return testCheckoutApiBase();
}

export function superadminAdyenRecipe(opts?: {
  environment?: "TEST" | "LIVE";
  merchantAccount?: string;
  missing?: string[];
}): string {
  const envHint = opts?.environment || "TEST";
  const keyPrefix = envHint === "LIVE" ? "live_" : "test_";
  const missing =
    opts?.missing?.length ? ` Missing: ${opts.missing.join(", ")}.` : "";
  return (
    `In Superadmin → Settings → Payment (Adyen), set all three from the same ${envHint} Adyen account: ` +
    `(1) Web service API key (starts with AQE…, not ${keyPrefix}), ` +
    `(2) merchant account "${opts?.merchantAccount || "exact name from Customer Area"}", ` +
    `(3) client key (${keyPrefix}…). ` +
    `Do not mix merchant shop credentials (Settings → Payments) with platform subscription credentials.` +
    missing
  );
}

export function diagnosePlatformAdyenBundle(picked: PickedPlatformAdyen): PlatformAdyenDiagnosis {
  const issues: PlatformAdyenIssue[] = [];
  const { values, missing, source } = picked;
  const apiKeyLooksLikeClientKey = /^(test|live)_/.test(values.apiKey);
  const apiKeyLooksLikeWebService = values.apiKey.startsWith("AQE");
  const clientKeyPrefix = values.clientKey.startsWith("live_")
    ? "live_"
    : values.clientKey.startsWith("test_")
      ? "test_"
      : "";

  if (source === "none" || source === "incomplete_db") {
    for (const field of missing) {
      issues.push({
        field,
        message:
          field === "apiKey"
            ? "Web service API key is missing (must start with AQE…)."
            : field === "merchantAccount"
              ? "Merchant account is missing."
              : "Client key is missing (must start with test_ or live_).",
      });
    }
  }

  if (values.apiKey && apiKeyLooksLikeClientKey) {
    issues.push({
      field: "apiKey",
      message: "API key looks like a client key (test_/live_). Paste the AQE… web service key instead.",
    });
  } else if (values.apiKey && !apiKeyLooksLikeWebService) {
    issues.push({
      field: "apiKey",
      message: "API key does not start with AQE…. Confirm it is the Checkout web service key, not the client key.",
    });
  }

  if (values.clientKey && values.clientKey.startsWith("AQE")) {
    issues.push({
      field: "clientKey",
      message: "Client key looks like an API key (AQE…). Use test_… or live_… from Client settings.",
    });
  } else if (values.clientKey && !clientKeyPrefix) {
    issues.push({
      field: "clientKey",
      message: "Client key must start with test_ or live_.",
    });
  } else if (values.clientKey && clientKeyPrefix) {
    const envFromKey = clientKeyPrefix === "live_" ? "LIVE" : "TEST";
    if (envFromKey !== values.environment) {
      issues.push({
        field: "environment",
        message: `Environment is ${values.environment} but the client key is ${clientKeyPrefix} (${envFromKey}).`,
      });
    }
  }

  if (picked.ignoredShop && (source === "none" || source === "incomplete_db")) {
    issues.push({
      field: "bundle",
      message:
        "Shop Adyen credentials (ADYEN_API_KEY / Settings → Payments) are present but ignored. Set the three platform fields in Superadmin.",
    });
  }

  const suspectedField = issues[0]?.field || null;
  const ready = missing.length === 0 && issues.length === 0 && (source === "superadmin_db" || source === "platform_env");

  return {
    ready,
    source,
    missing,
    issues,
    suspectedField,
    shopEnvIgnored: picked.ignoredShop,
    environment: values.environment,
    merchantAccount: values.merchantAccount,
    apiKeySet: !!values.apiKey,
    apiKeyLooksLikeClientKey,
    apiKeyLooksLikeWebService,
    clientKeySet: !!values.clientKey,
    clientKeyPrefix,
    recipe: superadminAdyenRecipe({
      environment: values.environment,
      merchantAccount: values.merchantAccount,
      missing,
    }),
  };
}

/** Map Adyen Checkout API HTTP errors to Superadmin-only guidance (never show to merchants). */
export function formatAdyenCheckoutApiError(
  error: unknown,
  context?: { apiBase?: string; merchantAccount?: string; phase?: "sessions" }
): string {
  const fallback = "Failed to start Adyen checkout";
  if (!error || typeof error !== "object") {
    return error instanceof Error ? error.message : fallback;
  }

  const e = error as {
    response?: { status?: number; data?: Record<string, unknown> };
    message?: string;
  };
  const status = e.response?.status;
  const data = e.response?.data || {};
  const adyenMsg = typeof data.message === "string" ? data.message : "";
  const errorCode = typeof data.errorCode === "string" ? data.errorCode : "";
  const errorType = typeof data.errorType === "string" ? data.errorType : "";
  const isUnauthorized =
    status === 401 ||
    errorCode === "000" ||
    /unauthorized/i.test(adyenMsg) ||
    /HTTP Status Response - Unauthorized/i.test(adyenMsg);

  const envHint = context?.apiBase?.includes("live") ? "LIVE" : "TEST";

  if (isUnauthorized) {
    const phase = context?.phase === "sessions" ? "POST /sessions" : "Checkout API";
    return (
      `Adyen ${phase} rejected the platform credentials (Unauthorized, ${envHint}). ` +
      superadminAdyenRecipe({
        environment: envHint,
        merchantAccount: context?.merchantAccount,
      })
    );
  }

  if (status === 403 || errorCode === "901" || /not allowed/i.test(adyenMsg)) {
    return (
      `Adyen permission denied for merchant account "${context?.merchantAccount || "?"}". ` +
      `Ensure the API key has Checkout webservice / Create payment session permission in Adyen Customer Area.`
    );
  }

  if (adyenMsg) return adyenMsg;
  if (errorType && errorCode) return `${errorType} (${errorCode})`;
  if (e.message) return e.message;
  return fallback;
}

export function suspectedFieldFromAdyenHttp(status?: number): PlatformAdyenIssue["field"] {
  if (status === 401) return "apiKey";
  if (status === 403) return "merchantAccount";
  return "bundle";
}

export function resolvePickedPlatformAdyen(picked: PickedPlatformAdyen) {
  if (picked.source === "incomplete_db") {
    const labels = picked.missing.map((field) =>
      field === "apiKey" ? "API key" : field === "merchantAccount" ? "merchant account" : "client key"
    );
    throw new Error(
      `Platform Adyen credentials are incomplete in Superadmin settings (missing: ${labels.join(", ")}). ` +
        superadminAdyenRecipe({
          environment: picked.values.environment,
          merchantAccount: picked.values.merchantAccount,
          missing: labels,
        })
    );
  }

  const apiKey = validatePlatformAdyenApiKey(picked.values.apiKey);
  const merchantAccount = picked.values.merchantAccount;
  if (!merchantAccount) {
    throw new Error(
      "Platform Adyen is not configured. Set it in Superadmin → Settings → Payment (Adyen)."
    );
  }
  const clientKey = validateAdyenClientKey(picked.values.clientKey, picked.values.environment);
  const dropinEnvironment = adyenDropinEnvironment(clientKey);
  const apiBase = platformCheckoutApiBase(dropinEnvironment);

  return {
    apiKey,
    merchantAccount,
    clientKey,
    environment: dropinEnvironment === "live" ? ("LIVE" as const) : ("TEST" as const),
    dropinEnvironment,
    hmacKey: picked.values.hmacKey,
    apiBase,
    source: picked.source,
  };
}
