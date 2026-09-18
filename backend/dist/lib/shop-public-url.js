"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shopAdyenCardReady = exports.isValidAdyenClientKey = void 0;
exports.shopPublicBaseUrl = shopPublicBaseUrl;
exports.shopPublicOrigin = shopPublicOrigin;
exports.parseOriginCandidate = parseOriginCandidate;
exports.isAllowedShopOrigin = isAllowedShopOrigin;
exports.resolveShopCheckoutOrigin = resolveShopCheckoutOrigin;
exports.sanitizeShopPathPrefix = sanitizeShopPathPrefix;
exports.shopPathPrefixForOrigin = shopPathPrefixForOrigin;
exports.buildShopPaymentReturnUrl = buildShopPaymentReturnUrl;
exports.shopOrderPaymentReturnUrl = shopOrderPaymentReturnUrl;
exports.shopGiftCardPaymentReturnUrl = shopGiftCardPaymentReturnUrl;
exports.shopTablePaymentReturnUrl = shopTablePaymentReturnUrl;
const brand_1 = require("@/lib/brand");
const adyen_checkout_env_1 = require("@/lib/adyen-checkout-env");
Object.defineProperty(exports, "isValidAdyenClientKey", { enumerable: true, get: function () { return adyen_checkout_env_1.isValidAdyenClientKey; } });
Object.defineProperty(exports, "shopAdyenCardReady", { enumerable: true, get: function () { return adyen_checkout_env_1.shopAdyenCardReady; } });
const PLATFORM_HOST_RE = /(^|\.)(chaslay\.com|rebornsense\.com|webprintmedia\.swiss)$/i;
function brandApex() {
    return (0, brand_1.resolveShopPublicHost)()
        .toLowerCase()
        .replace(/^shop\./, "")
        .replace(/^app\./, "");
}
function normalizeHostname(value) {
    return String(value || "")
        .trim()
        .replace(/^https?:\/\//, "")
        .replace(/\/+$/, "")
        .split("/")[0]
        ?.split(":")[0]
        ?.toLowerCase() || "";
}
/** Public shop base URL (custom domain → subdomain → shop hub /{slug}). */
function shopPublicBaseUrl(merchant) {
    const shopHost = (0, brand_1.resolveShopPublicHost)();
    const custom = normalizeHostname(String(merchant.customDomain || ""));
    if (custom)
        return `https://${custom}`;
    const sub = String(merchant.subdomain || "").trim();
    if (sub)
        return `https://${sub}.${brandApex()}`;
    const slug = String(merchant.slug || "").trim();
    if (slug)
        return `https://${shopHost}/${encodeURIComponent(slug)}`;
    return `https://${shopHost}`;
}
function shopPublicOrigin(merchant) {
    try {
        return new URL(shopPublicBaseUrl(merchant)).origin;
    }
    catch {
        return `https://${(0, brand_1.resolveShopPublicHost)()}`;
    }
}
function parseOriginCandidate(raw) {
    const value = String(raw || "").trim();
    if (!value)
        return null;
    try {
        const url = new URL(value.includes("://") ? value : `https://${value}`);
        const host = url.hostname.toLowerCase();
        const isLocal = host === "localhost" || host === "127.0.0.1";
        if (url.protocol === "https:" || (url.protocol === "http:" && isLocal)) {
            return `${url.protocol}//${url.host}`;
        }
        return null;
    }
    catch {
        return null;
    }
}
function isAllowedShopOrigin(origin, merchant) {
    const parsed = parseOriginCandidate(origin);
    if (!parsed)
        return false;
    const host = new URL(parsed).hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1")
        return true;
    if (PLATFORM_HOST_RE.test(host))
        return true;
    const custom = normalizeHostname(String(merchant.customDomain || ""));
    if (custom && (host === custom || host === `www.${custom}` || `www.${host}` === custom)) {
        return true;
    }
    const sub = String(merchant.subdomain || "").trim().toLowerCase();
    if (sub && host === `${sub}.${brandApex()}`)
        return true;
    return false;
}
function resolveShopCheckoutOrigin(merchant, ...candidates) {
    for (const candidate of candidates) {
        const parsed = parseOriginCandidate(candidate);
        if (parsed && isAllowedShopOrigin(parsed, merchant))
            return parsed;
    }
    return shopPublicOrigin(merchant);
}
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/** Client-provided shopBasePath (`''`, `/{slug}`, `/shop/{slug}`, plus optional `/l/{loc}`). */
function sanitizeShopPathPrefix(raw, merchant) {
    const slug = String(merchant.slug || "").trim();
    const value = String(raw || "").trim().replace(/\/+$/, "");
    if (!value)
        return "";
    if (!slug)
        return /^\/(?:shop)?(?:\/l\/[-a-z0-9]+)?$/i.test(value) ? value : null;
    const re = new RegExp(`^(?:/shop)?(?:/${escapeRegex(slug)})?(?:/l/[-a-z0-9]+)?$`, "i");
    return re.test(value) ? value : null;
}
function shopPathPrefixForOrigin(merchant, origin) {
    const parsed = parseOriginCandidate(origin);
    const host = parsed ? new URL(parsed).hostname.toLowerCase() : "";
    const slug = String(merchant.slug || "").trim();
    const custom = normalizeHostname(String(merchant.customDomain || ""));
    if (custom && (host === custom || host === `www.${custom}` || `www.${host}` === custom)) {
        return "";
    }
    const sub = String(merchant.subdomain || "").trim().toLowerCase();
    if (sub && host === `${sub}.${brandApex()}`)
        return "";
    const shopHost = (0, brand_1.resolveShopPublicHost)().toLowerCase();
    if (host === shopHost || host.startsWith("shop.")) {
        return slug ? `/${encodeURIComponent(slug)}` : "";
    }
    return slug ? `/shop/${encodeURIComponent(slug)}` : "/shop";
}
function buildShopPaymentReturnUrl(opts) {
    const origin = resolveShopCheckoutOrigin(opts.merchant, opts.origin, ...(opts.extraCandidates || []));
    const rawPath = opts.shopPath;
    const fromClient = rawPath == null || String(rawPath).trim() === ""
        ? null
        : sanitizeShopPathPrefix(rawPath, opts.merchant);
    const prefix = fromClient != null ? fromClient : shopPathPrefixForOrigin(opts.merchant, origin);
    const suffix = opts.suffix.startsWith("/") ? opts.suffix : `/${opts.suffix}`;
    return `${origin}${prefix}${suffix}`;
}
function shopOrderPaymentReturnUrl(merchant, orderId, opts = {}) {
    const params = new URLSearchParams(opts.query || { paid: "1" });
    return buildShopPaymentReturnUrl({
        merchant,
        origin: opts.origin,
        shopPath: opts.shopPath,
        extraCandidates: opts.extraCandidates,
        suffix: `/order/${encodeURIComponent(orderId)}?${params.toString()}`,
    });
}
function shopGiftCardPaymentReturnUrl(merchant, purchaseId, opts = {}) {
    return buildShopPaymentReturnUrl({
        merchant,
        origin: opts.origin,
        shopPath: opts.shopPath,
        extraCandidates: opts.extraCandidates,
        suffix: `/gift-cards/confirm/${encodeURIComponent(purchaseId)}?paid=1`,
    });
}
function shopTablePaymentReturnUrl(merchant, tableId, opts = {}) {
    const params = new URLSearchParams({ paid: "1" });
    if (opts.sessionToken)
        params.set("s", opts.sessionToken);
    return buildShopPaymentReturnUrl({
        merchant,
        origin: opts.origin,
        shopPath: opts.shopPath,
        extraCandidates: opts.extraCandidates,
        suffix: `/table/${encodeURIComponent(tableId)}?${params.toString()}`,
    });
}
//# sourceMappingURL=shop-public-url.js.map