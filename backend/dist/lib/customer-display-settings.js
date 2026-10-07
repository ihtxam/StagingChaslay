"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CUSTOMER_DISPLAY_SETTINGS = void 0;
exports.generateCdsToken = generateCdsToken;
exports.normalizeCustomerDisplaySettings = normalizeCustomerDisplaySettings;
exports.buildCdsPublicUrl = buildCdsPublicUrl;
const crypto_1 = require("crypto");
const brand_1 = require("@/lib/brand");
exports.DEFAULT_CUSTOMER_DISPLAY_SETTINGS = {
    enabled: true,
    promoSlides: [],
    slideIntervalSec: 8,
    theme: "light",
};
function generateCdsToken() {
    return (0, crypto_1.randomBytes)(24).toString("hex");
}
function normalizeCustomerDisplaySettings(raw) {
    if (!raw || typeof raw !== "object") {
        return {
            ...exports.DEFAULT_CUSTOMER_DISPLAY_SETTINGS,
            accessToken: generateCdsToken(),
        };
    }
    const src = raw;
    const slidesRaw = src.promoSlides;
    const promoSlides = Array.isArray(slidesRaw)
        ? slidesRaw
            .map((s) => {
            if (!s || typeof s !== "object")
                return null;
            const slide = s;
            return {
                imageUrl: String(slide.imageUrl || "").trim() || undefined,
                overlayText: String(slide.overlayText || "").trim() || undefined,
                title: String(slide.title || "").trim() || undefined,
                subtitle: String(slide.subtitle || "").trim() || undefined,
            };
        })
            .filter(Boolean)
        : exports.DEFAULT_CUSTOMER_DISPLAY_SETTINGS.promoSlides;
    let accessToken = String(src.accessToken || "").trim();
    // Do not mint a new token on partial JSON — CdsService persists one when missing.
    const shortCode = String(src.shortCode || "").trim() || undefined;
    const themeRaw = String(src.theme || "light").toLowerCase();
    const theme = themeRaw === "dark" ? "dark" : "light";
    const interval = Math.round(Number(src.slideIntervalSec));
    const slideIntervalSec = Number.isFinite(interval)
        ? Math.min(60, Math.max(3, interval))
        : exports.DEFAULT_CUSTOMER_DISPLAY_SETTINGS.slideIntervalSec;
    return {
        accessToken: accessToken || undefined,
        shortCode,
        enabled: src.enabled !== false,
        promoSlides,
        slideIntervalSec,
        theme,
    };
}
/** Stable public CDS URL — merchant slug path never rotates with access tokens. */
function buildCdsPublicUrl(merchantSlug, shortCode, appOrigin = brand_1.APP_ORIGIN) {
    const origin = String(appOrigin || brand_1.APP_ORIGIN).replace(/\/+$/, "");
    const slug = String(merchantSlug || "").trim();
    if (slug)
        return `${origin}/cds/m/${encodeURIComponent(slug)}`;
    const code = String(shortCode || "").trim();
    if (code)
        return `${origin}/cds/${encodeURIComponent(code)}`;
    return `${origin}/cds/`;
}
//# sourceMappingURL=customer-display-settings.js.map