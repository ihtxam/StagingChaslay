import axios from "axios";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import {
  diagnosePlatformAdyenBundle,
  formatAdyenCheckoutApiError,
  normalizeAdyenEnvironment,
  pickPlatformAdyenSource,
  resolvePickedPlatformAdyen,
  suspectedFieldFromAdyenHttp,
  validateAdyenClientKey,
  validatePlatformAdyenApiKey,
} from "@/lib/platform-adyen-credentials";
import {
  PLATFORM_LEGAL_HTML_KEYS,
  PLATFORM_LEGAL_SLUG_TO_ID,
  defaultPlatformLegalPageTitle,
  normalizePlatformLegalHtml,
  platformLegalHtmlById,
} from "@/lib/platform-legal-content";
import {
  PLATFORM_LEGAL_SETTING_KEYS,
  resolvePlatformLegalSettings,
  type PlatformLegalSettings,
  type PlatformLegalUrls,
} from "@/lib/platform-legal-urls";
import { DEFAULT_PLATFORM_FROM_NAME, resolveMailcoFromName } from "@/lib/mailco-payload";
import {
  PLATFORM_DESKTOP_KEYS,
  normalizeDesktopHexColor,
  resolveDesktopBranding,
  type DesktopBranding,
} from "@/lib/desktop-branding";
import {
  normalizePlatformMerchantAboutHtml,
  PLATFORM_MERCHANT_ABOUT_KEY,
} from "@/lib/platform-merchant-about";

export {
  adyenDropinEnvironment,
  formatAdyenCheckoutApiError,
  validateAdyenClientKey,
} from "@/lib/platform-adyen-credentials";

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

export const PLATFORM_MAILCO_KEYS = {
  apiKey: "mailco_api_key",
  fromEmail: "mailco_from_email",
  fromName: "mailco_from_name",
  apiBase: "mailco_api_base",
  templateSlug: "mailco_template_slug",
  emailPrimary: "platform_email_primary",
} as const;

export type PlatformEmailPrimary = "mailco" | "brevo";

export type PlatformMailcoSettings = {
  apiKey?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  apiBase?: string | null;
  templateSlug?: string | null;
  emailPrimary?: PlatformEmailPrimary | string | null;
};

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
    const picked = pickPlatformAdyenSource(s, process.env);
    const health = diagnosePlatformAdyenBundle(picked);
    let configured = false;
    let resolveError: string | null = null;
    try {
      await this.resolvePlatformAdyenCredentials();
      configured = true;
    } catch (error) {
      configured = false;
      resolveError = error instanceof Error ? error.message : String(error);
    }
    const displayClientKey = picked.values.clientKey;
    const displayApiKey = picked.values.apiKey;
    return {
      merchantAccount: picked.values.merchantAccount,
      clientKey: displayClientKey,
      clientKeySet: !!displayClientKey,
      clientKeyMasked: maskSecret(displayClientKey),
      environment: picked.values.environment,
      apiKeyMasked: maskSecret(displayApiKey),
      apiKeySet: !!displayApiKey,
      hmacKeyMasked: maskSecret(picked.values.hmacKey),
      hmacKeySet: !!picked.values.hmacKey,
      usingEnvFallback: picked.source === "platform_env",
      source: picked.source,
      shopEnvIgnored: picked.ignoredShop,
      configured,
      resolveError,
      health,
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
      await this.set(PLATFORM_ADYEN_KEYS.apiKey, validatePlatformAdyenApiKey(input.apiKey));
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
    const envName = process.env.BREVO_FROM_NAME || process.env.SENDINBLUE_FROM_NAME || "Reborn";
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

  private static envMailcoApiKey() {
    return (process.env.MAILCO_API_KEY || "").trim();
  }

  private static envMailcoFromEmail() {
    return (process.env.MAILCO_FROM_EMAIL || process.env.FROM_EMAIL || process.env.MAIL_FROM || "").trim();
  }

  private static envMailcoFromName() {
    return (
      process.env.MAILCO_FROM_NAME ||
      process.env.MAIL_FROM_NAME ||
      DEFAULT_PLATFORM_FROM_NAME
    ).trim();
  }

  private static envMailcoApiBase() {
    return (process.env.MAILCO_API_BASE || "https://ees.mailco.ch/api/v1").trim().replace(/\/$/, "");
  }

  private static envMailcoTemplateSlug() {
    return (process.env.MAILCO_TEMPLATE_SLUG || "platform-transactional").trim();
  }

  private static normalizeEmailPrimary(value?: string | null): PlatformEmailPrimary {
    return String(value || "").toLowerCase() === "brevo" ? "brevo" : "mailco";
  }

  static async getMailcoSettings(): Promise<PlatformMailcoSettings> {
    const rows = await this.getMany(Object.values(PLATFORM_MAILCO_KEYS));
    return {
      apiKey: rows[PLATFORM_MAILCO_KEYS.apiKey],
      fromEmail: rows[PLATFORM_MAILCO_KEYS.fromEmail],
      fromName: rows[PLATFORM_MAILCO_KEYS.fromName],
      apiBase: rows[PLATFORM_MAILCO_KEYS.apiBase],
      templateSlug: rows[PLATFORM_MAILCO_KEYS.templateSlug],
      emailPrimary: rows[PLATFORM_MAILCO_KEYS.emailPrimary],
    };
  }

  static async getMailcoSettingsPublic() {
    const s = await this.getMailcoSettings();
    const envKey = this.envMailcoApiKey();
    const envFrom = this.envMailcoFromEmail();
    const envName = this.envMailcoFromName();
    const envBase = this.envMailcoApiBase();
    const envTemplate = this.envMailcoTemplateSlug();
    const apiKey = (s.apiKey || envKey).trim();
    const fromEmail = (s.fromEmail || envFrom).trim();
    const apiBase = (s.apiBase || envBase).trim().replace(/\/$/, "");
    const templateSlug = (s.templateSlug || envTemplate).trim() || "platform-transactional";
    const emailPrimary = this.normalizeEmailPrimary(
      s.emailPrimary || process.env.PLATFORM_EMAIL_PRIMARY
    );
    return {
      fromEmail: fromEmail || "",
      fromName: resolveMailcoFromName(s.fromName || envName, fromEmail),
      apiBase,
      templateSlug,
      emailPrimary,
      apiKeyMasked: maskSecret(apiKey),
      apiKeySet: !!apiKey,
      usingEnvFallback: !s.apiKey && !!envKey,
      configured: !!(apiKey && fromEmail),
      provider: apiKey && fromEmail ? "mailco" : null,
    };
  }

  static async updateMailcoSettings(input: {
    apiKey?: string;
    fromEmail?: string;
    fromName?: string;
    apiBase?: string;
    templateSlug?: string;
    emailPrimary?: string;
  }) {
    if (input.fromEmail !== undefined) {
      await this.set(PLATFORM_MAILCO_KEYS.fromEmail, input.fromEmail.trim() || null);
    }
    if (input.fromName !== undefined) {
      await this.set(PLATFORM_MAILCO_KEYS.fromName, input.fromName.trim() || null);
    }
    if (input.apiBase !== undefined) {
      const base = input.apiBase.trim().replace(/\/$/, "");
      await this.set(PLATFORM_MAILCO_KEYS.apiBase, base || null);
    }
    if (input.templateSlug !== undefined) {
      await this.set(PLATFORM_MAILCO_KEYS.templateSlug, input.templateSlug.trim() || null);
    }
    if (input.emailPrimary !== undefined) {
      await this.set(
        PLATFORM_MAILCO_KEYS.emailPrimary,
        this.normalizeEmailPrimary(input.emailPrimary)
      );
    }
    if (input.apiKey !== undefined && input.apiKey.trim() && !input.apiKey.includes("••••")) {
      await this.set(PLATFORM_MAILCO_KEYS.apiKey, input.apiKey.trim());
    }
    return this.getMailcoSettingsPublic();
  }

  static async getPlatformEmailPrimary(): Promise<PlatformEmailPrimary> {
    const s = await this.getMailcoSettings();
    return this.normalizeEmailPrimary(s.emailPrimary || process.env.PLATFORM_EMAIL_PRIMARY);
  }

  /** Resolved mailco credentials for platform transactional sends. */
  static async resolveMailcoCredentials() {
    const s = await this.getMailcoSettings();
    const apiKey = (s.apiKey || this.envMailcoApiKey()).trim();
    const fromEmail = (s.fromEmail || this.envMailcoFromEmail()).trim();
    const fromName = resolveMailcoFromName(s.fromName || this.envMailcoFromName(), fromEmail);
    const apiBase = (s.apiBase || this.envMailcoApiBase()).trim().replace(/\/$/, "");
    const templateSlug =
      (s.templateSlug || this.envMailcoTemplateSlug()).trim() || "platform-transactional";

    if (!apiKey || !fromEmail) {
      throw new Error(
        "Platform mailco is not configured. Set it in Superadmin → Settings → Platform email (mailco)."
      );
    }

    return { apiKey, fromEmail, fromName, apiBase, templateSlug };
  }

  /** Resolved Brevo credentials for platform sends (ignores merchant overrides). */
  static async resolveBrevoCredentials() {
    const s = await this.getBrevoSettings();
    const apiKey =
      (s.apiKey || "").trim() ||
      (process.env.BREVO_API_KEY ||
        process.env.SENDINBLUE_API_KEY ||
        process.env.SIB_API_KEY ||
        "").trim();
    const fromEmail =
      (s.fromEmail || "").trim() ||
      (process.env.BREVO_FROM_EMAIL ||
        process.env.BREVO_SENDER_EMAIL ||
        process.env.SENDINBLUE_FROM_EMAIL ||
        process.env.FROM_EMAIL ||
        process.env.MAIL_FROM ||
        "").trim();
    const fromName =
      (s.fromName || "").trim() ||
      (process.env.BREVO_FROM_NAME || process.env.SENDINBLUE_FROM_NAME || "Reborn").trim();

    if (!apiKey || !fromEmail) {
      throw new Error("Platform Brevo is not configured.");
    }

    return { apiKey, fromEmail, fromName };
  }

  /**
   * Resolve platform Adyen credentials for subscription checkout.
   * Superadmin DB (complete) or PLATFORM_ADYEN_* env only — never shop ADYEN_* or merchant Settings → Payments.
   */
  static async resolvePlatformAdyenCredentials() {
    const s = await this.getAdyenSettings();
    return resolvePickedPlatformAdyen(pickPlatformAdyenSource(s, process.env));
  }

  /**
   * Superadmin health check: local diagnosis + a TEST/LIVE /sessions ping.
   * Never returns raw secrets.
   */
  static async pingPlatformAdyenSession() {
    const s = await this.getAdyenSettings();
    const picked = pickPlatformAdyenSource(s, process.env);
    const health = diagnosePlatformAdyenBundle(picked);

    if (picked.missing.length || health.issues.some((issue) => issue.field !== "bundle")) {
      return {
        ok: false,
        pinged: false,
        ...health,
        apiBaseHost: "",
        httpStatus: null as number | null,
      };
    }

    let creds: Awaited<ReturnType<typeof resolvePickedPlatformAdyen>>;
    try {
      creds = resolvePickedPlatformAdyen(picked);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        pinged: false,
        ...health,
        issues: [...health.issues, { field: "bundle" as const, message }],
        recipe: message,
        apiBaseHost: "",
        httpStatus: null as number | null,
      };
    }

    let apiBaseHost = "";
    try {
      apiBaseHost = new URL(creds.apiBase).host;
    } catch {
      apiBaseHost = creds.apiBase;
    }

    try {
      const response = await axios.post(
        `${creds.apiBase}/sessions`,
        {
          amount: { value: 100, currency: "CHF" },
          merchantAccount: creds.merchantAccount,
          reference: `plat-ping-${Date.now()}`,
          returnUrl: "https://app.rebornsense.com/superadmin/settings",
          channel: "Web",
          countryCode: "CH",
        },
        {
          headers: {
            "x-api-key": creds.apiKey,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );
      const sessionId = typeof response.data?.id === "string" ? response.data.id : "";
      console.info("[platform-adyen] session ping ok", {
        environment: creds.environment,
        merchantAccount: creds.merchantAccount,
        apiBaseHost,
        sessionIdPrefix: sessionId.slice(0, 8),
      });
      return {
        ok: true,
        pinged: true,
        ...health,
        ready: true,
        suspectedField: null,
        recipe: "",
        environment: creds.environment,
        merchantAccount: creds.merchantAccount,
        apiBaseHost,
        httpStatus: response.status,
      };
    } catch (error) {
      const axiosError = error as {
        response?: { status?: number };
        message?: string;
      };
      const httpStatus = axiosError.response?.status ?? null;
      const recipe = formatAdyenCheckoutApiError(error, {
        apiBase: creds.apiBase,
        merchantAccount: creds.merchantAccount,
        phase: "sessions",
      });
      const suspectedField = suspectedFieldFromAdyenHttp(httpStatus ?? undefined);
      console.error("[platform-adyen] session ping failed", {
        environment: creds.environment,
        merchantAccount: creds.merchantAccount,
        apiBaseHost,
        httpStatus,
        recipe,
      });
      return {
        ok: false,
        pinged: true,
        ...health,
        ready: false,
        suspectedField,
        issues: [
          ...health.issues,
          {
            field: suspectedField,
            message:
              suspectedField === "apiKey"
                ? `Adyen ${creds.environment} rejected the API key (HTTP ${httpStatus || "error"}). Use the AQE… web service key from the same ${creds.environment} account as merchant account ${creds.merchantAccount}.`
                : suspectedField === "merchantAccount"
                  ? `Adyen denied merchant account "${creds.merchantAccount}". Confirm the exact TEST/LIVE account name for this API key.`
                  : recipe,
          },
        ],
        recipe,
        environment: creds.environment,
        merchantAccount: creds.merchantAccount,
        apiBaseHost,
        httpStatus,
      };
    }
  }

  private static async loadPlatformLegalRaw() {
    const keys = [
      ...Object.values(PLATFORM_LEGAL_SETTING_KEYS),
      ...Object.values(PLATFORM_LEGAL_HTML_KEYS),
    ];
    const rows = await this.getMany(keys);
    return {
      privacyUrl: rows[PLATFORM_LEGAL_SETTING_KEYS.privacyUrl],
      termsUrl: rows[PLATFORM_LEGAL_SETTING_KEYS.termsUrl],
      cookiesUrl: rows[PLATFORM_LEGAL_SETTING_KEYS.cookiesUrl],
      privacyHtml: rows[PLATFORM_LEGAL_HTML_KEYS.privacy],
      termsHtml: rows[PLATFORM_LEGAL_HTML_KEYS.terms],
      cookiesHtml: rows[PLATFORM_LEGAL_HTML_KEYS.cookies],
    };
  }

  static async getPlatformLegalSettings(): Promise<PlatformLegalSettings> {
    const raw = await this.loadPlatformLegalRaw();
    return resolvePlatformLegalSettings(raw);
  }

  static async getPlatformLegalUrls(): Promise<PlatformLegalUrls> {
    const settings = await this.getPlatformLegalSettings();
    return {
      origin: settings.origin,
      privacy: settings.privacy,
      terms: settings.terms,
      cookies: settings.cookies,
    };
  }

  static async updatePlatformLegalSettings(input: {
    privacyUrl?: string;
    termsUrl?: string;
    cookiesUrl?: string;
    privacy?: string;
    terms?: string;
    cookies?: string;
    privacyHtml?: string;
    termsHtml?: string;
    cookiesHtml?: string;
  }): Promise<PlatformLegalSettings> {
    const privacyUrl = input.privacyUrl ?? input.privacy;
    const termsUrl = input.termsUrl ?? input.terms;
    const cookiesUrl = input.cookiesUrl ?? input.cookies;

    if (privacyUrl !== undefined) {
      await this.set(PLATFORM_LEGAL_SETTING_KEYS.privacyUrl, String(privacyUrl).trim() || null);
    }
    if (termsUrl !== undefined) {
      await this.set(PLATFORM_LEGAL_SETTING_KEYS.termsUrl, String(termsUrl).trim() || null);
    }
    if (cookiesUrl !== undefined) {
      await this.set(PLATFORM_LEGAL_SETTING_KEYS.cookiesUrl, String(cookiesUrl).trim() || null);
    }
    if (input.privacyHtml !== undefined) {
      await this.set(
        PLATFORM_LEGAL_HTML_KEYS.privacy,
        normalizePlatformLegalHtml(input.privacyHtml) || null
      );
    }
    if (input.termsHtml !== undefined) {
      await this.set(
        PLATFORM_LEGAL_HTML_KEYS.terms,
        normalizePlatformLegalHtml(input.termsHtml) || null
      );
    }
    if (input.cookiesHtml !== undefined) {
      await this.set(
        PLATFORM_LEGAL_HTML_KEYS.cookies,
        normalizePlatformLegalHtml(input.cookiesHtml) || null
      );
    }
    return this.getPlatformLegalSettings();
  }

  /** @deprecated use updatePlatformLegalSettings */
  static async updatePlatformLegalUrls(input: {
    privacyUrl?: string;
    termsUrl?: string;
    cookiesUrl?: string;
  }): Promise<PlatformLegalUrls> {
    const settings = await this.updatePlatformLegalSettings(input);
    return {
      origin: settings.origin,
      privacy: settings.privacy,
      terms: settings.terms,
      cookies: settings.cookies,
    };
  }

  static async getPlatformLegalPageBySlug(pageSlug: string): Promise<{
    slug: string;
    title: string;
    htmlContent: string;
  } | null> {
    const id = PLATFORM_LEGAL_SLUG_TO_ID[pageSlug];
    if (!id) return null;
    const settings = await this.getPlatformLegalSettings();
    const htmlContent = platformLegalHtmlById(settings, id);
    if (!normalizePlatformLegalHtml(htmlContent)) return null;
    return {
      slug: pageSlug,
      title: defaultPlatformLegalPageTitle(id),
      htmlContent,
    };
  }

  static async getDesktopBranding(): Promise<DesktopBranding> {
    const rows = await this.getMany(Object.values(PLATFORM_DESKTOP_KEYS));
    return resolveDesktopBranding({
      splashUrl: rows[PLATFORM_DESKTOP_KEYS.splashUrl],
      iconUrl: rows[PLATFORM_DESKTOP_KEYS.iconUrl],
      appName: rows[PLATFORM_DESKTOP_KEYS.appName],
      tagline: rows[PLATFORM_DESKTOP_KEYS.tagline],
      backgroundColor: rows[PLATFORM_DESKTOP_KEYS.backgroundColor],
    });
  }

  static async updateDesktopBranding(input: {
    splashUrl?: string | null;
    iconUrl?: string | null;
    appName?: string | null;
    tagline?: string | null;
    backgroundColor?: string | null;
    clearSplash?: boolean;
    clearIcon?: boolean;
  }): Promise<DesktopBranding> {
    if (input.clearSplash) {
      await this.set(PLATFORM_DESKTOP_KEYS.splashUrl, null);
    } else if (input.splashUrl !== undefined) {
      await this.set(PLATFORM_DESKTOP_KEYS.splashUrl, String(input.splashUrl || "").trim() || null);
    }
    if (input.clearIcon) {
      await this.set(PLATFORM_DESKTOP_KEYS.iconUrl, null);
    } else if (input.iconUrl !== undefined) {
      await this.set(PLATFORM_DESKTOP_KEYS.iconUrl, String(input.iconUrl || "").trim() || null);
    }
    if (input.appName !== undefined) {
      await this.set(PLATFORM_DESKTOP_KEYS.appName, String(input.appName || "").trim().slice(0, 80) || null);
    }
    if (input.tagline !== undefined) {
      await this.set(PLATFORM_DESKTOP_KEYS.tagline, String(input.tagline || "").trim().slice(0, 160) || null);
    }
    if (input.backgroundColor !== undefined) {
      const color = String(input.backgroundColor || "").trim();
      await this.set(
        PLATFORM_DESKTOP_KEYS.backgroundColor,
        color ? normalizeDesktopHexColor(color) : null
      );
    }
    return this.getDesktopBranding();
  }

  static async getMerchantAboutHtml(): Promise<string> {
    const stored = await this.get(PLATFORM_MERCHANT_ABOUT_KEY);
    return normalizePlatformMerchantAboutHtml(stored);
  }

  static async updateMerchantAboutHtml(html: string): Promise<string> {
    const trimmed = String(html ?? "").trim();
    await this.set(PLATFORM_MERCHANT_ABOUT_KEY, trimmed || null);
    return this.getMerchantAboutHtml();
  }
}
