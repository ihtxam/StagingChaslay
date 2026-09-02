"use strict";
/** Public product + domain defaults. Override with env on the new server. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENT_HOST_ALIASES = exports.LEGACY_HOST_ALIASES = exports.FROM_NAME_DEFAULT = exports.FROM_EMAIL_DEFAULT = exports.SHOP_HOST = exports.PAY_ORIGIN = exports.APP_ORIGIN = exports.BRAND_DOMAIN = exports.APP_NAME = void 0;
exports.resolveShopPublicHost = resolveShopPublicHost;
exports.rewriteLegacyPublicHost = rewriteLegacyPublicHost;
exports.APP_NAME = process.env.BRAND_NAME?.trim() || "Reborn";
exports.BRAND_DOMAIN = (process.env.DOMAIN || "rebornsense.com").replace(/^https?:\/\//, "").replace(/\/+$/, "");
exports.APP_ORIGIN = (process.env.PUBLIC_APP_URL || `https://app.${exports.BRAND_DOMAIN}`).replace(/\/+$/, "");
exports.PAY_ORIGIN = (process.env.PUBLIC_RECEIPT_ORIGIN ||
    process.env.PUBLIC_RECEIPT_BASE_URL?.replace(/\/receipts?\/?$/i, "") ||
    `https://pay.${exports.BRAND_DOMAIN}`).replace(/\/+$/, "");
/** Public shop hub hostname (path shops at https://{host}/{slug}). */
function resolveShopPublicHost() {
    const explicit = process.env.SHOP_PUBLIC_HOST?.trim();
    if (explicit)
        return explicit;
    const domain = exports.BRAND_DOMAIN.toLowerCase();
    if (domain.includes("rebornsense.com"))
        return "shop.rebornsense.com";
    const appHost = exports.APP_ORIGIN.replace(/^https?:\/\//, "").toLowerCase();
    if (appHost.startsWith("app."))
        return `shop.${appHost}`;
    if (domain.startsWith("shop."))
        return domain;
    return `shop.${domain}`;
}
exports.SHOP_HOST = resolveShopPublicHost();
exports.FROM_EMAIL_DEFAULT = `noreply@${exports.BRAND_DOMAIN.replace(/^app\./, "").replace(/^shop\./, "")}`;
exports.FROM_NAME_DEFAULT = exports.APP_NAME;
exports.LEGACY_HOST_ALIASES = [
    "https://app.chaslay.com",
    "https://api.chaslay.com",
    "https://shop.chaslay.com",
    "https://shop.app.chaslay.com",
    "https://pay.chaslay.com",
    "https://status.chaslay.com",
    "https://admin.chaslay.com",
];
exports.CURRENT_HOST_ALIASES = [
    exports.APP_ORIGIN,
    `https://app.${exports.BRAND_DOMAIN}`,
    `https://api.${exports.BRAND_DOMAIN}`,
    `https://shop.${exports.BRAND_DOMAIN}`,
    `https://${exports.SHOP_HOST}`,
    `https://pay.${exports.BRAND_DOMAIN}`,
    `https://status.${exports.BRAND_DOMAIN}`,
    `https://${exports.BRAND_DOMAIN}`,
];
function rewriteLegacyPublicHost(value) {
    return String(value || "")
        .replace(/chasly\.com/gi, exports.BRAND_DOMAIN)
        .replace(/chaslay\.com/gi, exports.BRAND_DOMAIN);
}
//# sourceMappingURL=brand.js.map