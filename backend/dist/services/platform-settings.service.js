"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformSettingsService = exports.PLATFORM_MAILCO_KEYS = exports.PLATFORM_BREVO_KEYS = exports.PLATFORM_ADYEN_KEYS = void 0;
exports.validateAdyenClientKey = validateAdyenClientKey;
exports.adyenDropinEnvironment = adyenDropinEnvironment;
exports.formatAdyenCheckoutApiError = formatAdyenCheckoutApiError;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
const adyen_checkout_env_1 = require("@/lib/adyen-checkout-env");
exports.PLATFORM_ADYEN_KEYS = {
    apiKey: "adyen_api_key",
    merchantAccount: "adyen_merchant_account",
    clientKey: "adyen_client_key",
    environment: "adyen_environment",
    hmacKey: "adyen_hmac_key",
};
exports.PLATFORM_BREVO_KEYS = {
    apiKey: "brevo_api_key",
    fromEmail: "brevo_from_email",
    fromName: "brevo_from_name",
};
exports.PLATFORM_MAILCO_KEYS = {
    apiKey: "mailco_api_key",
    fromEmail: "mailco_from_email",
    fromName: "mailco_from_name",
    apiBase: "mailco_api_base",
    templateSlug: "mailco_template_slug",
    emailPrimary: "platform_email_primary",
};
function maskSecret(value) {
    if (!value)
        return "";
    if (value.length <= 8)
        return "••••••••";
    return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
function normalizeAdyenEnvironment(value) {
    return value?.toUpperCase() === "LIVE" ? "LIVE" : "TEST";
}
/** Client key for Drop-in (test_… / live_…), not the web service API key (AQE…). */
function validateAdyenClientKey(clientKey, environment) {
    const key = clientKey.trim();
    if (!key) {
        throw new Error("Platform Adyen client key is missing. Set it in Superadmin → Settings → Payment (Adyen).");
    }
    if (key.startsWith("AQE") || key.startsWith("AQE0")) {
        throw new Error("Invalid client key: this looks like an Adyen API key. Use the Client Key from Customer Area → Developers → Client settings (starts with test_ or live_).");
    }
    if (!/^(test|live)_/.test(key)) {
        throw new Error("Invalid Adyen client key. It must start with test_ (test environment) or live_ (live environment).");
    }
    const env = normalizeAdyenEnvironment(environment);
    if (env === "TEST" && !key.startsWith("test_")) {
        throw new Error("Environment is TEST but the client key is not a test key (must start with test_).");
    }
    if (env === "LIVE" && !key.startsWith("live_")) {
        throw new Error("Environment is LIVE but the client key is not a live key (must start with live_).");
    }
    return key;
}
function adyenDropinEnvironment(clientKey) {
    return clientKey.trim().startsWith("live_") ? "live" : "test";
}
function adyenCheckoutApiBase(dropinEnv) {
    if (dropinEnv === "live") {
        return (0, adyen_checkout_env_1.liveCheckoutApiBase)();
    }
    return (process.env.PLATFORM_ADYEN_API_BASE ||
        process.env.ADYEN_API_BASE ||
        "https://checkout-test.adyen.com/v71");
}
/** Platform Drop-in client key — never fall back to merchant ADYEN_CLIENT_ID. */
function resolvePlatformClientKeyFromEnv() {
    return (process.env.PLATFORM_ADYEN_CLIENT_KEY ||
        process.env.ADYEN_CLIENT_KEY ||
        "");
}
function resolvePlatformApiKeyFromEnv() {
    return process.env.PLATFORM_ADYEN_API_KEY || process.env.ADYEN_API_KEY || "";
}
function resolvePlatformMerchantAccountFromEnv() {
    return (process.env.PLATFORM_ADYEN_MERCHANT_ACCOUNT ||
        process.env.ADYEN_MERCHANT_ACCOUNT ||
        "");
}
/** Map Adyen Checkout API HTTP errors to actionable Superadmin guidance. */
function formatAdyenCheckoutApiError(error, context) {
    const fallback = "Failed to start Adyen checkout";
    if (!error || typeof error !== "object") {
        return error instanceof Error ? error.message : fallback;
    }
    const e = error;
    const status = e.response?.status;
    const data = e.response?.data || {};
    const adyenMsg = typeof data.message === "string" ? data.message : "";
    const errorCode = typeof data.errorCode === "string" ? data.errorCode : "";
    const errorType = typeof data.errorType === "string" ? data.errorType : "";
    const isUnauthorized = status === 401 ||
        errorCode === "000" ||
        /unauthorized/i.test(adyenMsg) ||
        /HTTP Status Response - Unauthorized/i.test(adyenMsg);
    if (isUnauthorized) {
        const envHint = context?.apiBase?.includes("live") ? "LIVE" : "TEST";
        const keyPrefix = envHint === "LIVE" ? "live_" : "test_";
        const phase = context?.phase === "sessions" ? "POST /sessions" : "Checkout API";
        return (`Adyen ${phase} rejected the platform credentials (Unauthorized, ${envHint}). ` +
            `In Superadmin → Settings → Payment (Adyen), set all three from the same ${envHint} Adyen account: ` +
            `(1) Web service API key (starts with AQE…, not ${keyPrefix}), ` +
            `(2) merchant account "${context?.merchantAccount || "exact name from Customer Area"}", ` +
            `(3) client key (${keyPrefix}…). ` +
            `Do not mix merchant shop credentials (Settings → Payments) with platform subscription credentials.`);
    }
    if (status === 403 || errorCode === "901" || /not allowed/i.test(adyenMsg)) {
        return (`Adyen permission denied for merchant account "${context?.merchantAccount || "?"}". ` +
            `Ensure the API key has Checkout webservice / Create payment session permission in Adyen Customer Area.`);
    }
    if (adyenMsg)
        return adyenMsg;
    if (errorType && errorCode)
        return `${errorType} (${errorCode})`;
    if (e.message)
        return e.message;
    return fallback;
}
class PlatformSettingsService {
    static async get(key) {
        const db = (0, db_1.getDb)();
        const row = await db.query.platformSettings.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.platformSettings.key, key),
        });
        return row?.value ?? null;
    }
    static async set(key, value) {
        const db = (0, db_1.getDb)();
        const normalized = value === undefined || value === null ? null : String(value);
        await db
            .insert(db_1.schema.platformSettings)
            .values({ key, value: normalized, updatedAt: new Date() })
            .onConflictDoUpdate({
            target: db_1.schema.platformSettings.key,
            set: { value: normalized, updatedAt: new Date() },
        });
    }
    static async getMany(keys) {
        const out = {};
        for (const key of keys) {
            out[key] = await this.get(key);
        }
        return out;
    }
    static async getAdyenSettings() {
        const rows = await this.getMany(Object.values(exports.PLATFORM_ADYEN_KEYS));
        return {
            apiKey: rows[exports.PLATFORM_ADYEN_KEYS.apiKey],
            merchantAccount: rows[exports.PLATFORM_ADYEN_KEYS.merchantAccount],
            clientKey: rows[exports.PLATFORM_ADYEN_KEYS.clientKey],
            environment: rows[exports.PLATFORM_ADYEN_KEYS.environment] || "TEST",
            hmacKey: rows[exports.PLATFORM_ADYEN_KEYS.hmacKey],
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
        }
        catch {
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
    static async updateAdyenSettings(input) {
        if (input.merchantAccount !== undefined) {
            await this.set(exports.PLATFORM_ADYEN_KEYS.merchantAccount, input.merchantAccount.trim() || null);
        }
        const nextEnvironment = input.environment !== undefined
            ? normalizeAdyenEnvironment(input.environment)
            : normalizeAdyenEnvironment(await this.get(exports.PLATFORM_ADYEN_KEYS.environment));
        if (input.clientKey !== undefined) {
            const trimmed = input.clientKey.trim();
            if (trimmed) {
                validateAdyenClientKey(trimmed, nextEnvironment);
                await this.set(exports.PLATFORM_ADYEN_KEYS.clientKey, trimmed);
            }
            // Empty = leave existing DB value (same as API key field)
        }
        if (input.environment !== undefined) {
            await this.set(exports.PLATFORM_ADYEN_KEYS.environment, nextEnvironment);
            const existingClientKey = await this.get(exports.PLATFORM_ADYEN_KEYS.clientKey);
            if (existingClientKey) {
                validateAdyenClientKey(existingClientKey, nextEnvironment);
            }
        }
        if (input.apiKey !== undefined && input.apiKey.trim() && !input.apiKey.includes("••••")) {
            await this.set(exports.PLATFORM_ADYEN_KEYS.apiKey, input.apiKey.trim());
        }
        if (input.hmacKey !== undefined && input.hmacKey.trim() && !input.hmacKey.includes("••••")) {
            await this.set(exports.PLATFORM_ADYEN_KEYS.hmacKey, input.hmacKey.trim());
        }
        return this.getAdyenSettingsPublic();
    }
    static async getBrevoSettings() {
        const rows = await this.getMany(Object.values(exports.PLATFORM_BREVO_KEYS));
        return {
            apiKey: rows[exports.PLATFORM_BREVO_KEYS.apiKey],
            fromEmail: rows[exports.PLATFORM_BREVO_KEYS.fromEmail],
            fromName: rows[exports.PLATFORM_BREVO_KEYS.fromName],
        };
    }
    static async getBrevoSettingsPublic() {
        const s = await this.getBrevoSettings();
        const envKey = process.env.BREVO_API_KEY ||
            process.env.SENDINBLUE_API_KEY ||
            process.env.SIB_API_KEY ||
            "";
        const envFrom = process.env.BREVO_FROM_EMAIL ||
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
    static async updateBrevoSettings(input) {
        if (input.fromEmail !== undefined) {
            await this.set(exports.PLATFORM_BREVO_KEYS.fromEmail, input.fromEmail.trim() || null);
        }
        if (input.fromName !== undefined) {
            await this.set(exports.PLATFORM_BREVO_KEYS.fromName, input.fromName.trim() || null);
        }
        if (input.apiKey !== undefined && input.apiKey.trim() && !input.apiKey.includes("••••")) {
            await this.set(exports.PLATFORM_BREVO_KEYS.apiKey, input.apiKey.trim());
        }
        return this.getBrevoSettingsPublic();
    }
    static envMailcoApiKey() {
        return (process.env.MAILCO_API_KEY || "").trim();
    }
    static envMailcoFromEmail() {
        return (process.env.MAILCO_FROM_EMAIL || process.env.FROM_EMAIL || process.env.MAIL_FROM || "").trim();
    }
    static envMailcoFromName() {
        return (process.env.MAILCO_FROM_NAME || process.env.MAIL_FROM_NAME || "Reborn").trim();
    }
    static envMailcoApiBase() {
        return (process.env.MAILCO_API_BASE || "https://ees.mailco.ch/api/v1").trim().replace(/\/$/, "");
    }
    static envMailcoTemplateSlug() {
        return (process.env.MAILCO_TEMPLATE_SLUG || "platform-transactional").trim();
    }
    static normalizeEmailPrimary(value) {
        return String(value || "").toLowerCase() === "brevo" ? "brevo" : "mailco";
    }
    static async getMailcoSettings() {
        const rows = await this.getMany(Object.values(exports.PLATFORM_MAILCO_KEYS));
        return {
            apiKey: rows[exports.PLATFORM_MAILCO_KEYS.apiKey],
            fromEmail: rows[exports.PLATFORM_MAILCO_KEYS.fromEmail],
            fromName: rows[exports.PLATFORM_MAILCO_KEYS.fromName],
            apiBase: rows[exports.PLATFORM_MAILCO_KEYS.apiBase],
            templateSlug: rows[exports.PLATFORM_MAILCO_KEYS.templateSlug],
            emailPrimary: rows[exports.PLATFORM_MAILCO_KEYS.emailPrimary],
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
        const emailPrimary = this.normalizeEmailPrimary(s.emailPrimary || process.env.PLATFORM_EMAIL_PRIMARY);
        return {
            fromEmail: fromEmail || "",
            fromName: (s.fromName || envName).trim() || "Reborn",
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
    static async updateMailcoSettings(input) {
        if (input.fromEmail !== undefined) {
            await this.set(exports.PLATFORM_MAILCO_KEYS.fromEmail, input.fromEmail.trim() || null);
        }
        if (input.fromName !== undefined) {
            await this.set(exports.PLATFORM_MAILCO_KEYS.fromName, input.fromName.trim() || null);
        }
        if (input.apiBase !== undefined) {
            const base = input.apiBase.trim().replace(/\/$/, "");
            await this.set(exports.PLATFORM_MAILCO_KEYS.apiBase, base || null);
        }
        if (input.templateSlug !== undefined) {
            await this.set(exports.PLATFORM_MAILCO_KEYS.templateSlug, input.templateSlug.trim() || null);
        }
        if (input.emailPrimary !== undefined) {
            await this.set(exports.PLATFORM_MAILCO_KEYS.emailPrimary, this.normalizeEmailPrimary(input.emailPrimary));
        }
        if (input.apiKey !== undefined && input.apiKey.trim() && !input.apiKey.includes("••••")) {
            await this.set(exports.PLATFORM_MAILCO_KEYS.apiKey, input.apiKey.trim());
        }
        return this.getMailcoSettingsPublic();
    }
    static async getPlatformEmailPrimary() {
        const s = await this.getMailcoSettings();
        return this.normalizeEmailPrimary(s.emailPrimary || process.env.PLATFORM_EMAIL_PRIMARY);
    }
    /** Resolved mailco credentials for platform transactional sends. */
    static async resolveMailcoCredentials() {
        const s = await this.getMailcoSettings();
        const apiKey = (s.apiKey || this.envMailcoApiKey()).trim();
        const fromEmail = (s.fromEmail || this.envMailcoFromEmail()).trim();
        const fromName = (s.fromName || this.envMailcoFromName()).trim() || "Reborn";
        const apiBase = (s.apiBase || this.envMailcoApiBase()).trim().replace(/\/$/, "");
        const templateSlug = (s.templateSlug || this.envMailcoTemplateSlug()).trim() || "platform-transactional";
        if (!apiKey || !fromEmail) {
            throw new Error("Platform mailco is not configured. Set it in Superadmin → Settings → Platform email (mailco).");
        }
        return { apiKey, fromEmail, fromName, apiBase, templateSlug };
    }
    /** Resolved Brevo credentials for platform sends (ignores merchant overrides). */
    static async resolveBrevoCredentials() {
        const s = await this.getBrevoSettings();
        const apiKey = (s.apiKey || "").trim() ||
            (process.env.BREVO_API_KEY ||
                process.env.SENDINBLUE_API_KEY ||
                process.env.SIB_API_KEY ||
                "").trim();
        const fromEmail = (s.fromEmail || "").trim() ||
            (process.env.BREVO_FROM_EMAIL ||
                process.env.BREVO_SENDER_EMAIL ||
                process.env.SENDINBLUE_FROM_EMAIL ||
                process.env.FROM_EMAIL ||
                process.env.MAIL_FROM ||
                "").trim();
        const fromName = (s.fromName || "").trim() ||
            (process.env.BREVO_FROM_NAME || process.env.SENDINBLUE_FROM_NAME || "Reborn").trim();
        if (!apiKey || !fromEmail) {
            throw new Error("Platform Brevo is not configured.");
        }
        return { apiKey, fromEmail, fromName };
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
        let apiKey;
        let merchantAccount;
        let clientKey;
        let environment;
        if (hasDbAny) {
            if (!hasDbApi || !hasDbMerchant || !hasDbClient) {
                const missing = [];
                if (!hasDbApi)
                    missing.push("API key");
                if (!hasDbMerchant)
                    missing.push("merchant account");
                if (!hasDbClient)
                    missing.push("client key");
                throw new Error(`Platform Adyen credentials are incomplete in Superadmin settings (missing: ${missing.join(", ")}). ` +
                    `Set merchant account, API key, and client key together under Superadmin → Settings → Payment (Adyen). ` +
                    `Mixed database + environment credentials cause Adyen Unauthorized errors.`);
            }
            apiKey = s.apiKey.trim();
            merchantAccount = s.merchantAccount.trim();
            clientKey = s.clientKey.trim();
            environment = normalizeAdyenEnvironment(s.environment);
        }
        else {
            apiKey = envApiKey.trim();
            merchantAccount = envMerchant.trim();
            clientKey = envClientKey.trim();
            environment = normalizeAdyenEnvironment(process.env.PLATFORM_ADYEN_ENVIRONMENT);
        }
        const hmacKey = s.hmacKey || process.env.PLATFORM_ADYEN_HMAC_KEY || "";
        if (!apiKey || !merchantAccount) {
            throw new Error("Platform Adyen is not configured. Set it in Superadmin → Settings → Payment (Adyen).");
        }
        if (/^(test|live)_/.test(apiKey)) {
            throw new Error("Platform Adyen API key looks like a client key (test_/live_). Use the Web service API key from Adyen Customer Area → Developers → API credentials (starts with AQE…).");
        }
        const validatedClientKey = clientKey
            ? validateAdyenClientKey(clientKey, environment)
            : "";
        if (!validatedClientKey) {
            throw new Error("Platform Adyen client key is missing. Set it in Superadmin → Settings → Payment (Adyen).");
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
exports.PlatformSettingsService = PlatformSettingsService;
//# sourceMappingURL=platform-settings.service.js.map