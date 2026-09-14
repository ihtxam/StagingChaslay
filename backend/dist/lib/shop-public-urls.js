"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHiddenMerchantShopUrl = isHiddenMerchantShopUrl;
exports.filterMerchantShopUrl = filterMerchantShopUrl;
exports.primaryMerchantShopPublicUrl = primaryMerchantShopPublicUrl;
exports.listMerchantShopPublicLinks = listMerchantShopPublicLinks;
/** Demo / legacy shop URLs that must not appear in merchant settings. */
const HIDDEN_MERCHANT_SHOP_URL_PATTERNS = [
    /^https?:\/\/demo\.chaslay\.com(?:\/|$)/i,
    /^https?:\/\/shop\.app\.chaslay\.com\/demo(?:\/|$)/i,
];
function isHiddenMerchantShopUrl(url) {
    const value = String(url || "").trim();
    if (!value)
        return false;
    return HIDDEN_MERCHANT_SHOP_URL_PATTERNS.some((pattern) => pattern.test(value));
}
/** Returns null when the URL should be hidden from merchants. */
function filterMerchantShopUrl(url) {
    const value = String(url || "").trim();
    if (!value || isHiddenMerchantShopUrl(value))
        return null;
    return value;
}
/** One customer-facing shop URL for CMS/settings (custom domain wins over shop hub). */
function primaryMerchantShopPublicUrl(input) {
    return filterMerchantShopUrl(input.shopCustomDomainUrl) || filterMerchantShopUrl(input.shopPathUrl);
}
/** Public shop links shown to merchants — single canonical URL, no panel/subdomain duplicates. */
function listMerchantShopPublicLinks(input) {
    const custom = filterMerchantShopUrl(input.shopCustomDomainUrl);
    const website = filterMerchantShopUrl(input.shopPathUrl);
    if (custom)
        return [{ key: "shopCustomDomainLink", url: custom }];
    if (website)
        return [{ key: "shopWebsiteLink", url: website }];
    return [];
}
//# sourceMappingURL=shop-public-urls.js.map