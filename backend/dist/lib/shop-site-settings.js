"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeGaMeasurementId = normalizeGaMeasurementId;
exports.normalizeShopSiteSettings = normalizeShopSiteSettings;
exports.localizedShopCopy = localizedShopCopy;
exports.resolveShopDocumentSeo = resolveShopDocumentSeo;
const category_colors_1 = require("@/lib/category-colors");
const EMPTY = {
    brandColor: null,
    metaTitle: {},
    metaDescription: {},
    gaMeasurementId: null,
    faviconUrl: null,
};
const LOCALES = ["en", "fr", "de", "it"];
function trimCopy(raw, max) {
    if (!raw || typeof raw !== "object")
        return {};
    const src = raw;
    const out = {};
    for (const loc of LOCALES) {
        const v = typeof src[loc] === "string" ? src[loc].trim() : "";
        if (v)
            out[loc] = v.slice(0, max);
    }
    return out;
}
function normalizeGaMeasurementId(raw) {
    const id = String(raw || "")
        .trim()
        .toUpperCase();
    if (!id)
        return null;
    if (!/^G-[A-Z0-9]{4,20}$/.test(id))
        return null;
    return id;
}
function normalizeShopSiteSettings(raw) {
    if (!raw || typeof raw !== "object")
        return { ...EMPTY, metaTitle: {}, metaDescription: {} };
    const src = raw;
    const colorRaw = typeof src.brandColor === "string" ? src.brandColor.trim() : "";
    const brandColor = colorRaw && (0, category_colors_1.isValidHexColor)(colorRaw) ? (0, category_colors_1.normalizeHexColor)(colorRaw).toLowerCase() : null;
    const faviconUrl = typeof src.faviconUrl === "string" && src.faviconUrl.trim() ? src.faviconUrl.trim().slice(0, 500) : null;
    return {
        brandColor,
        metaTitle: trimCopy(src.metaTitle, 60),
        metaDescription: trimCopy(src.metaDescription, 160),
        gaMeasurementId: normalizeGaMeasurementId(src.gaMeasurementId),
        faviconUrl,
    };
}
function localizedShopCopy(copy, locale, fallbackLocale = "en") {
    const loc = String(locale || fallbackLocale)
        .toLowerCase()
        .slice(0, 2);
    const fallback = String(fallbackLocale || "en")
        .toLowerCase()
        .slice(0, 2);
    return ((copy?.[loc] || "").trim() ||
        (copy?.[fallback] || "").trim() ||
        (copy?.en || "").trim() ||
        "");
}
/** Prefer Online Shop SEO settings; page/builder copy is fallback only. */
function resolveShopDocumentSeo(site, locale, fallbacks) {
    return {
        title: localizedShopCopy(site?.metaTitle, locale) || String(fallbacks?.title || "").trim(),
        description: localizedShopCopy(site?.metaDescription, locale) || String(fallbacks?.description || "").trim(),
        faviconUrl: site?.faviconUrl || null,
    };
}
//# sourceMappingURL=shop-site-settings.js.map