"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POS_EDITION_FEATURES = void 0;
exports.merchantHasPos = merchantHasPos;
exports.showOrderCenterForMerchant = showOrderCenterForMerchant;
exports.showDeliveryHubForMerchant = showDeliveryHubForMerchant;
exports.resolveMerchantProductFlags = resolveMerchantProductFlags;
/**
 * Merchant product surface flags — keep in sync with dashboard/src/lib/merchant-product-flags.ts
 */
const edition_features_1 = require("@/lib/edition-features");
exports.POS_EDITION_FEATURES = edition_features_1.ALL_EDITION_FEATURES.filter((k) => k.startsWith("pos_"));
function merchantHasPos(input) {
    const maxPos = Math.max(0, Number(input.maxPosPosts) || 0);
    if (maxPos > 0)
        return true;
    const features = input.editionFeatures;
    if (features == null)
        return true;
    return exports.POS_EDITION_FEATURES.some((key) => (0, edition_features_1.hasEditionFeature)(features, key));
}
function showOrderCenterForMerchant(input) {
    if (!input.shopEnabled)
        return false;
    if (merchantHasPos(input))
        return false;
    if (input.orderCenterEnabled === false)
        return false;
    return true;
}
function showDeliveryHubForMerchant(input) {
    if (input.deliveryEnabled === false)
        return false;
    return (0, edition_features_1.hasEditionFeature)(input.editionFeatures ?? null, "channel_delivery");
}
function resolveMerchantProductFlags(input) {
    const hasPos = merchantHasPos(input);
    return {
        hasPos,
        showOrderCenter: showOrderCenterForMerchant(input),
        showDeliveryHub: showDeliveryHubForMerchant(input),
    };
}
//# sourceMappingURL=merchant-product-flags.js.map