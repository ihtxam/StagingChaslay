"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLATFORM_LEGAL_SETTING_KEYS = exports.DEFAULT_PLATFORM_LEGAL_ORIGIN = void 0;
exports.defaultPlatformLegalUrls = defaultPlatformLegalUrls;
exports.resolvePlatformLegalUrls = resolvePlatformLegalUrls;
/** Default marketing site for platform legal pages (shop footer). */
exports.DEFAULT_PLATFORM_LEGAL_ORIGIN = "https://rebornsense.com";
exports.PLATFORM_LEGAL_SETTING_KEYS = {
    privacyUrl: "platform_legal_privacy_url",
    termsUrl: "platform_legal_terms_url",
    cookiesUrl: "platform_legal_cookies_url",
};
function normalizeOrigin(raw) {
    const trimmed = String(raw || "").trim().replace(/\/+$/, "");
    return trimmed || exports.DEFAULT_PLATFORM_LEGAL_ORIGIN;
}
function defaultPlatformLegalUrls(origin) {
    const base = normalizeOrigin(origin);
    return {
        origin: base,
        privacy: `${base}/privacy-policy`,
        terms: `${base}/terms-of-use`,
        cookies: `${base}/cookie-policy`,
    };
}
function resolvePlatformLegalUrls(input) {
    const defaults = defaultPlatformLegalUrls();
    const pick = (stored, fallback) => {
        const v = String(stored || "").trim();
        return v || fallback;
    };
    const privacy = pick(input.privacyUrl, defaults.privacy);
    const terms = pick(input.termsUrl, defaults.terms);
    const cookies = pick(input.cookiesUrl, defaults.cookies);
    let origin = defaults.origin;
    try {
        origin = new URL(privacy).origin;
    }
    catch {
        /* keep default */
    }
    return { origin, privacy, terms, cookies };
}
//# sourceMappingURL=platform-legal-urls.js.map