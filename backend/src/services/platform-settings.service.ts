import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export const PLATFORM_ADYEN_KEYS = {
  apiKey: "adyen_api_key",
  merchantAccount: "adyen_merchant_account",
  clientKey: "adyen_client_key",
  environment: "adyen_environment",
  hmacKey: "adyen_hmac_key",
} as const;

export const PLATFORM_BREVO_KEYS = {
  apiKey: "brevo_api_key",
  fromEmail: "brevo_from_email",
  fromName: "brevo_from_name",
} as const;

export type PlatformAdyenSettings = {
  apiKey?: string | null;
  merchantAccount?: string | null;
  clientKey?: string | null;
  environment?: "TEST" | "LIVE" | string | null;
  hmacKey?: string | null;
};

function maskSecret(value?: string | null) {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

function normalizeAdyenEnvironment(value?: string | null): "TEST" | "LIVE" {
  return value?.toUpperCase() === "LIVE" ? "LIVE" : "TEST";
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

function adyenCheckoutApiBase(dropinEnv: "live" | "test"): string {
  if (dropinEnv === "live") {
    return (
      process.env.PLATFORM_ADYEN_API_BASE ||
      process.env.ADYEN_API_BASE_LIVE ||
      "https://checkout-live.adyen.com/v71"
    );
  }
  return (
    process.env.PLATFORM_ADYEN_API_BASE ||
    process.env.ADYEN_API_BASE ||
    "https://checkout-test.adyen.com/v71"
  );
}

/** Platform Drop-in client key — never fall back to merchant ADYEN_CLIENT_ID. */
function resolvePlatformClientKeyFromEnv(): string {
  return (
    process.env.PLATFORM_ADYEN_CLIENT_KEY ||
    process.env.ADYEN_CLIENT_KEY ||
    ""
  );
}

function resolvePlatformApiKeyFromEnv(): string {
  return process.env.PLATFORM_ADYEN_API_KEY || process.env.ADYEN_API_KEY || "";
}

function resolvePlatformMerchantAccountFromEnv(): string {
  return (
    process.env.PLATFORM_ADYEN_MERCHANT_ACCOUNT ||
    process.env.ADYEN_MERCHANT_ACCOUNT ||
    ""
  );
}

/** Map Adyen Checkout API HTTP errors to actionable Superadmin guidance. */
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

  if (isUnauthorized) {
    const envHint = context?.apiBase?.includes("live") ? "LIVE" : "TEST";
    const keyPrefix = envHint === "LIVE" ? "live_" : "test_";
    const phase = context?.phase === "sessions" ? "POST /sessions" : "Checkout API";
    return (
      `Adyen ${phase} rejected the platform credentials (Unauthorized, ${envHint}). ` +
      `In Superadmin → Settings → Payment (Adyen), set all three from the same ${envHint} Adyen account: ` +
      `(1) Web service API key (starts with AQE…, not ${keyPrefix}), ` +
      `(2) merchant account "${context?.merchantAccount || "exact name from Customer Area"}", ` +
      `(3) client key (${keyPrefix}…). ` +
      `Do not mix merchant shop credentials (Settings → Payments) with platform subscription credentials.`
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

export class PlatformSettingsService {
  static async get(key: string): Promise<string | null> {
    const db = getDb();
    const row = await db.query.platformSettings.findFirst({
      where: eq(schema.platformSettings.key, key),
    });
    return row?.value ?? null;
  }

  static async set(key: string, value: string | null | undefined) {
    const db = getDb();
    const normalized = value === undefined || value === null ? null : String(value);
    await db
      .insert(schema.platformSettings)
      .values({ key, value: normalized, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: schema.platformSettings.key,
        set: { value: normalized, updatedAt: new Date() },
      });
  }

  static async getMany(keys: string[]) {
    const out: Record<string, string | null> = {};
    for (const key of keys) {
      out[key] = await this.get(key);
    }
    return out;
  }

  static async getAdyenSettings(): Promise<PlatformAdyenSettings> {
    const rows = await this.getMany(Object.values(PLATFORM_ADYEN_KEYS));
    return {
      apiKey: rows[PLATFORM_ADYEN_KEYS.apiKey],
      merchantAccount: rows[PLATFORM_ADYEN_KEYS.merchantAccount],
      clientKey: rows[PLATFORM_ADYEN_KEYS.clientKey],
      environment: rows[PLATFORM_ADYEN_KEYS.environment] || "TEST",
      hmacKey: rows[PLATFORM_ADYEN_KEYS.hmacKey],
    };
  }

  /** Public/safe view for superadmin UI (secrets masked) */
  static async getAdyenSettingsPublic() {
    const s = await this.getAdyenSettings();
    const hasDbAny = !!(s.apiKey || s.merchantAccount || s.clientKey);
    const envFallback = !hasDbAny && !!resolvePlatformApiKeyFromEnv();
    let configured = false;
    try {
      await this.resolvePlatformAdyenCredentials();
      configured = true;
    } catch {
      configured = false;
    }
    const displayClientKey = s.clientKey || resolvePlatformClientKeyFromEnv() || "";
    const displayApiKey = s.apiKey || resolvePlatformApiKeyFromEnv();
    return {
      merchantAccount: s.merchantAccount || resolvePlatformMerchantAccountFromEnv() || "",
      clientKey: displayClientKey,
      clientKeySet: !!(s.clientKey || resolvePlatformClientKeyFromEnv()),
      clientKeyMasked: maskSecret(displayClientKey),
      environment: (s.environment || process.env.PLATFORM_ADYEN_ENVIRONMENT || "TEST").toUpperCase(),
      apiKeyMasked: maskSecret(displayApiKey),
      apiKeySet: !!(s.apiKey || resolvePlatformApiKeyFromEnv()),
      hmacKeyMasked: maskSecret(s.hmacKey || process.env.PLATFORM_ADYEN_HMAC_KEY),
      hmacKeySet: !!(s.hmacKey || process.env.PLATFORM_ADYEN_HMAC_KEY),
      usingEnvFallback: envFallback,
      configured,
    };
  }

  static async updateAdyenSettings(input: {
    apiKey?: string;
    merchantAccount?: string;
    clientKey?: string;
    environment?: string;
    hmacKey?: string;
  }) {
    if (input.merchantAccount !== undefined) {
      await this.set(PLATFORM_ADYEN_KEYS.merchantAccount, input.merchantAccount.trim() || null);
    }
    const nextEnvironment =
      input.environment !== undefined
        ? normalizeAdyenEnvironment(input.environment)
        : normalizeAdyenEnvironment(await this.get(PLATFORM_ADYEN_KEYS.environment));

    if (input.clientKey !== undefined) {
      const trimmed = input.clientKey.trim();
      if (trimmed) {
        validateAdyenClientKey(trimmed, nextEnvironment);
        await this.set(PLATFORM_ADYEN_KEYS.clientKey, trimmed);
      }
      // Empty = leave existing DB value (same as API key field)
    }
    if (input.environment !== undefined) {
      await this.set(PLATFORM_ADYEN_KEYS.environment, nextEnvironment);
      const existingClientKey = await this.get(PLATFORM_ADYEN_KEYS.clientKey);
      if (existingClientKey) {
        validateAdyenClientKey(existingClientKey, nextEnvironment);
      }
    }
    if (input.apiKey !== undefined && input.apiKey.trim() && !input.apiKey.includes("••••")) {
      await this.set(PLATFORM_ADYEN_KEYS.apiKey, input.apiKey.trim());
    }
    if (input.hmacKey !== undefined && input.hmacKey.trim() && !input.hmacKey.includes("••••")) {
      await this.set(PLATFORM_ADYEN_KEYS.hmacKey, input.hmacKey.trim());
    }
    return this.getAdyenSettingsPublic();
  }

  static async getBrevoSettings() {
    const rows = await this.getMany(Object.values(PLATFORM_BREVO_KEYS));
    return {
      apiKey: rows[PLATFORM_BREVO_KEYS.apiKey],
      fromEmail: rows[PLATFORM_BREVO_KEYS.fromEmail],
      fromName: rows[PLATFORM_BREVO_KEYS.fromName],
    };
  }

  static async getBrevoSettingsPublic() {
    const s = await this.getBrevoSettings();
    const envKey =
      process.env.BREVO_API_KEY ||
      process.env.SENDINBLUE_API_KEY ||
      process.env.SIB_API_KEY ||
      "";
    const envFrom =
      process.env.BREVO_FROM_EMAIL ||
      process.env.BREVO_SENDER_EMAIL ||
      process.env.SENDINBLUE_FROM_EMAIL ||
      process.env.FROM_EMAIL ||
      process.env.MAIL_FROM ||
      "";
    const envName = process.env.BREVO_FROM_NAME || process.env.SENDINBLUE_FROM_NAME || "Chaslay";
    const apiKey = s.apiKey || envKey;
    const fromEmail = s.fromEmail || envFrom;
    return {
      fromEmail: fromEmail || "",
      fromName: s.fromName || envName,
      apiKeyMasked: maskSecret(apiKey),
      apiKeySet: !!apiKey,
      usingEnvFallback: !s.apiKey && !!envKey,
      configured: !!(apiKey && fromEmail),
      provider: apiKey && fromEmail ? "brevo" : null,
    };
  }

  static async updateBrevoSettings(input: {
    apiKey?: string;
    fromEmail?: string;
    fromName?: string;
  }) {
    if (input.fromEmail !== undefined) {
      await this.set(PLATFORM_BREVO_KEYS.fromEmail, input.fromEmail.trim() || null);
    }
    if (input.fromName !== undefined) {
      await this.set(PLATFORM_BREVO_KEYS.fromName, input.fromName.trim() || null);
    }
    if (input.apiKey !== undefined && input.apiKey.trim() && !input.apiKey.includes("••••")) {
      await this.set(PLATFORM_BREVO_KEYS.apiKey, input.apiKey.trim());
    }
    return this.getBrevoSettingsPublic();
  }

  /**
   * Resolve platform Adyen credentials for subscription checkout.
   * Uses a complete DB bundle or a complete env bundle — never mixes the two (causes 401 Unauthorized).
   */
  static async resolvePlatformAdyenCredentials() {
    const s = await this.getAdyenSettings();
    const hasDbApi = !!s.apiKey?.trim();
    const hasDbMerchant = !!s.merchantAccount?.trim();
    const hasDbClient = !!s.clientKey?.trim();
    const hasDbAny = hasDbApi || hasDbMerchant || hasDbClient;

    const envApiKey = resolvePlatformApiKeyFromEnv();
    const envMerchant = resolvePlatformMerchantAccountFromEnv();
    const envClientKey = resolvePlatformClientKeyFromEnv();

    let apiKey: string;
    let merchantAccount: string;
    let clientKey: string;
    let environment: "TEST" | "LIVE";

    if (hasDbAny) {
      if (!hasDbApi || !hasDbMerchant || !hasDbClient) {
        const missing: string[] = [];
        if (!hasDbApi) missing.push("API key");
        if (!hasDbMerchant) missing.push("merchant account");
        if (!hasDbClient) missing.push("client key");
        throw new Error(
          `Platform Adyen credentials are incomplete in Superadmin settings (missing: ${missing.join(", ")}). ` +
            `Set merchant account, API key, and client key together under Superadmin → Settings → Payment (Adyen). ` +
            `Mixed database + environment credentials cause Adyen Unauthorized errors.`
        );
      }
      apiKey = s.apiKey!.trim();
      merchantAccount = s.merchantAccount!.trim();
      clientKey = s.clientKey!.trim();
      environment = normalizeAdyenEnvironment(s.environment);
    } else {
      apiKey = envApiKey.trim();
      merchantAccount = envMerchant.trim();
      clientKey = envClientKey.trim();
      environment = normalizeAdyenEnvironment(process.env.PLATFORM_ADYEN_ENVIRONMENT);
    }

    const hmacKey = s.hmacKey || process.env.PLATFORM_ADYEN_HMAC_KEY || "";

    if (!apiKey || !merchantAccount) {
      throw new Error(
        "Platform Adyen is not configured. Set it in Superadmin → Settings → Payment (Adyen)."
      );
    }

    if (/^(test|live)_/.test(apiKey)) {
      throw new Error(
        "Platform Adyen API key looks like a client key (test_/live_). Use the Web service API key from Adyen Customer Area → Developers → API credentials (starts with AQE…)."
      );
    }

    const validatedClientKey = clientKey
      ? validateAdyenClientKey(clientKey, environment)
      : "";

    if (!validatedClientKey) {
      throw new Error(
        "Platform Adyen client key is missing. Set it in Superadmin → Settings → Payment (Adyen)."
      );
    }

    const dropinEnvironment = adyenDropinEnvironment(validatedClientKey);
    const apiBase = adyenCheckoutApiBase(dropinEnvironment);

    return {
      apiKey,
      merchantAccount,
      clientKey: validatedClientKey,
      environment: dropinEnvironment === "live" ? "LIVE" : "TEST",
      dropinEnvironment,
      hmacKey,
      apiBase,
    };
  }
}
