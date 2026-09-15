"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_SURFACE_PRESETS = exports.MERCHANT_PRODUCT_SURFACES = void 0;
exports.isMerchantProductSurface = isMerchantProductSurface;
exports.inferProductSurface = inferProductSurface;
const edition_features_1 = require("@/lib/edition-features");
exports.MERCHANT_PRODUCT_SURFACES = [
    "shop_only",
    "website_only",
    "shop_website",
    "full_pos",
];
const POS_FEATURES = edition_features_1.ALL_EDITION_FEATURES.filter((k) => k.startsWith("pos_"));
const SHOP_FEATURES = [
    "online_shop",
    "online_payments",
    "channel_takeaway",
    "channel_delivery",
    "channel_online_orders",
    "offers",
    "loyalty",
    "gift_cards",
    "reports",
    "staff_roles",
    "reservations",
];
const WEBSITE_FEATURES = ["website_cms"];
exports.PRODUCT_SURFACE_PRESETS = {
    shop_only: {
        label: "Shop only",
        description: "Online ordering kiosk/QR — Order Center, no till (WebPOS hidden).",
        editionName: "Shop only (no POS)",
        shopEnabled: true,
        cmsHomepageEnabled: false,
        maxPosPosts: 0,
        features: [...SHOP_FEATURES],
    },
    website_only: {
        label: "Website / CMS only",
        description: "Published homepage and pages — menu ordering optional off.",
        editionName: "Website CMS only",
        shopEnabled: true,
        cmsHomepageEnabled: true,
        maxPosPosts: 0,
        features: [...WEBSITE_FEATURES, "online_shop", "reports", "staff_roles"],
    },
    shop_website: {
        label: "Shop + Website",
        description: "Online shop plus CMS homepage — Order Center, no POS till.",
        editionName: "Shop + Website (no POS)",
        shopEnabled: true,
        cmsHomepageEnabled: true,
        maxPosPosts: 0,
        features: [...SHOP_FEATURES, ...WEBSITE_FEATURES],
    },
    full_pos: {
        label: "Shop + Website + POS",
        description: "Full till (WebPOS), online shop, and website CMS.",
        editionName: "Full POS + Shop",
        shopEnabled: true,
        cmsHomepageEnabled: true,
        maxPosPosts: 1,
        features: [...edition_features_1.ALL_EDITION_FEATURES],
    },
};
function isMerchantProductSurface(raw) {
    return typeof raw === "string" && exports.MERCHANT_PRODUCT_SURFACES.includes(raw);
}
/** Guess surface from merchant flags (for display). */
function inferProductSurface(input) {
    const hasPos = Math.max(0, Number(input.maxPosPosts) || 0) > 0 || !!input.hasPosEdition;
    const shop = !!input.shopEnabled;
    const cms = !!input.cmsHomepageEnabled;
    if (hasPos)
        return "full_pos";
    if (shop && cms)
        return "shop_website";
    if (cms)
        return "website_only";
    if (shop)
        return "shop_only";
    return null;
}
//# sourceMappingURL=merchant-product-surface.js.map