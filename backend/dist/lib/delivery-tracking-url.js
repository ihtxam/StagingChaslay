"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildGuestOrderTrackingUrl = buildGuestOrderTrackingUrl;
exports.generateDeliveryTrackingToken = generateDeliveryTrackingToken;
exports.buildDriverClaimUrl = buildDriverClaimUrl;
const crypto_1 = require("crypto");
/** Guest tracking URL (no login) for shop order confirmation page. */
function buildGuestOrderTrackingUrl(merchant, orderId, token) {
    const base = (process.env.PUBLIC_APP_URL ||
        process.env.MERCHANT_DASHBOARD_URL ||
        process.env.WEB_SHOP_URL ||
        "http://localhost:5173").replace(/\/$/, "");
    const slug = merchant.slug || merchant.subdomain || "shop";
    const params = new URLSearchParams({ track: token });
    return `${base}/shop/${encodeURIComponent(slug)}/order/${orderId}?${params.toString()}`;
}
function generateDeliveryTrackingToken() {
    return (0, crypto_1.randomBytes)(24).toString("hex");
}
function appBaseUrl() {
    return (process.env.PUBLIC_APP_URL ||
        process.env.MERCHANT_DASHBOARD_URL ||
        process.env.WEB_SHOP_URL ||
        "http://localhost:5173").replace(/\/$/, "");
}
/** QR on delivery slip — driver scans to claim the order. */
function buildDriverClaimUrl(orderId, token) {
    const params = new URLSearchParams({ claim: orderId, token });
    return `${appBaseUrl()}/merchant/delivery/driver?${params.toString()}`;
}
//# sourceMappingURL=delivery-tracking-url.js.map