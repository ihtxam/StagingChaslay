/** Default marketing site for platform legal pages (shop footer). */
export declare const DEFAULT_PLATFORM_LEGAL_ORIGIN = "https://rebornsense.com";
export declare const PLATFORM_LEGAL_SETTING_KEYS: {
    readonly privacyUrl: "platform_legal_privacy_url";
    readonly termsUrl: "platform_legal_terms_url";
    readonly cookiesUrl: "platform_legal_cookies_url";
};
export type PlatformLegalUrls = {
    privacy: string;
    terms: string;
    cookies: string;
    origin: string;
};
export declare function defaultPlatformLegalUrls(origin?: string | null): PlatformLegalUrls;
export declare function resolvePlatformLegalUrls(input: {
    privacyUrl?: string | null;
    termsUrl?: string | null;
    cookiesUrl?: string | null;
}): PlatformLegalUrls;
//# sourceMappingURL=platform-legal-urls.d.ts.map