export declare const PLATFORM_ADYEN_KEYS: {
    readonly apiKey: "adyen_api_key";
    readonly merchantAccount: "adyen_merchant_account";
    readonly clientKey: "adyen_client_key";
    readonly environment: "adyen_environment";
    readonly hmacKey: "adyen_hmac_key";
};
export declare const PLATFORM_BREVO_KEYS: {
    readonly apiKey: "brevo_api_key";
    readonly fromEmail: "brevo_from_email";
    readonly fromName: "brevo_from_name";
};
export declare const PLATFORM_MAILCO_KEYS: {
    readonly apiKey: "mailco_api_key";
    readonly fromEmail: "mailco_from_email";
    readonly fromName: "mailco_from_name";
    readonly apiBase: "mailco_api_base";
    readonly templateSlug: "mailco_template_slug";
    readonly emailPrimary: "platform_email_primary";
};
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
/** Client key for Drop-in (test_… / live_…), not the web service API key (AQE…). */
export declare function validateAdyenClientKey(clientKey: string, environment?: string | null): string;
export declare function adyenDropinEnvironment(clientKey: string): "live" | "test";
/** Map Adyen Checkout API HTTP errors to actionable Superadmin guidance. */
export declare function formatAdyenCheckoutApiError(error: unknown, context?: {
    apiBase?: string;
    merchantAccount?: string;
    phase?: "sessions";
}): string;
export declare class PlatformSettingsService {
    static get(key: string): Promise<string | null>;
    static set(key: string, value: string | null | undefined): Promise<void>;
    static getMany(keys: string[]): Promise<Record<string, string | null>>;
    static getAdyenSettings(): Promise<PlatformAdyenSettings>;
    /** Public/safe view for superadmin UI (secrets masked) */
    static getAdyenSettingsPublic(): Promise<{
        merchantAccount: string;
        clientKey: string;
        clientKeySet: boolean;
        clientKeyMasked: string;
        environment: string;
        apiKeyMasked: string;
        apiKeySet: boolean;
        hmacKeyMasked: string;
        hmacKeySet: boolean;
        usingEnvFallback: boolean;
        configured: boolean;
    }>;
    static updateAdyenSettings(input: {
        apiKey?: string;
        merchantAccount?: string;
        clientKey?: string;
        environment?: string;
        hmacKey?: string;
    }): Promise<{
        merchantAccount: string;
        clientKey: string;
        clientKeySet: boolean;
        clientKeyMasked: string;
        environment: string;
        apiKeyMasked: string;
        apiKeySet: boolean;
        hmacKeyMasked: string;
        hmacKeySet: boolean;
        usingEnvFallback: boolean;
        configured: boolean;
    }>;
    static getBrevoSettings(): Promise<{
        apiKey: string | null;
        fromEmail: string | null;
        fromName: string | null;
    }>;
    static getBrevoSettingsPublic(): Promise<{
        fromEmail: string;
        fromName: string;
        apiKeyMasked: string;
        apiKeySet: boolean;
        usingEnvFallback: boolean;
        configured: boolean;
        provider: string | null;
    }>;
    static updateBrevoSettings(input: {
        apiKey?: string;
        fromEmail?: string;
        fromName?: string;
    }): Promise<{
        fromEmail: string;
        fromName: string;
        apiKeyMasked: string;
        apiKeySet: boolean;
        usingEnvFallback: boolean;
        configured: boolean;
        provider: string | null;
    }>;
    private static envMailcoApiKey;
    private static envMailcoFromEmail;
    private static envMailcoFromName;
    private static envMailcoApiBase;
    private static envMailcoTemplateSlug;
    private static normalizeEmailPrimary;
    static getMailcoSettings(): Promise<PlatformMailcoSettings>;
    static getMailcoSettingsPublic(): Promise<{
        fromEmail: string;
        fromName: string;
        apiBase: string;
        templateSlug: string;
        emailPrimary: PlatformEmailPrimary;
        apiKeyMasked: string;
        apiKeySet: boolean;
        usingEnvFallback: boolean;
        configured: boolean;
        provider: string | null;
    }>;
    static updateMailcoSettings(input: {
        apiKey?: string;
        fromEmail?: string;
        fromName?: string;
        apiBase?: string;
        templateSlug?: string;
        emailPrimary?: string;
    }): Promise<{
        fromEmail: string;
        fromName: string;
        apiBase: string;
        templateSlug: string;
        emailPrimary: PlatformEmailPrimary;
        apiKeyMasked: string;
        apiKeySet: boolean;
        usingEnvFallback: boolean;
        configured: boolean;
        provider: string | null;
    }>;
    static getPlatformEmailPrimary(): Promise<PlatformEmailPrimary>;
    /** Resolved mailco credentials for platform transactional sends. */
    static resolveMailcoCredentials(): Promise<{
        apiKey: string;
        fromEmail: string;
        fromName: string;
        apiBase: string;
        templateSlug: string;
    }>;
    /** Resolved Brevo credentials for platform sends (ignores merchant overrides). */
    static resolveBrevoCredentials(): Promise<{
        apiKey: string;
        fromEmail: string;
        fromName: string;
    }>;
    /**
     * Resolve platform Adyen credentials for subscription checkout.
     * Uses a complete DB bundle or a complete env bundle — never mixes the two (causes 401 Unauthorized).
     */
    static resolvePlatformAdyenCredentials(): Promise<{
        apiKey: string;
        merchantAccount: string;
        clientKey: string;
        environment: string;
        dropinEnvironment: "live" | "test";
        hmacKey: string;
        apiBase: string;
    }>;
}
//# sourceMappingURL=platform-settings.service.d.ts.map