"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CUSTOMER_DISPLAY_SETTINGS = void 0;
exports.generateCdsToken = generateCdsToken;
exports.normalizeCustomerDisplaySettings = normalizeCustomerDisplaySettings;
const crypto_1 = require("crypto");
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
    if (!accessToken)
        accessToken = generateCdsToken();
    const shortCode = String(src.shortCode || "").trim() || undefined;
    const themeRaw = String(src.theme || "light").toLowerCase();
    const theme = themeRaw === "dark" ? "dark" : "light";
    const interval = Math.round(Number(src.slideIntervalSec));
    const slideIntervalSec = Number.isFinite(interval)
        ? Math.min(60, Math.max(3, interval))
        : exports.DEFAULT_CUSTOMER_DISPLAY_SETTINGS.slideIntervalSec;
    return {
        accessToken,
        shortCode,
        enabled: src.enabled !== false,
        promoSlides,
        slideIntervalSec,
        theme,
    };
}
//# sourceMappingURL=customer-display-settings.js.map