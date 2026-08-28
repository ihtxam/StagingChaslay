"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCategoryExtraDeliveryPrice = parseCategoryExtraDeliveryPrice;
exports.buildCategoryDeliveryPricingMap = buildCategoryDeliveryPricingMap;
exports.resolveShopItemDeliveryMarkup = resolveShopItemDeliveryMarkup;
const money_1 = require("@/lib/money");
function parseCategoryExtraDeliveryPrice(value) {
    const n = Number(value ?? 0);
    if (!Number.isFinite(n) || n < 0)
        return 0;
    return (0, money_1.roundMoney2)(n);
}
function buildCategoryDeliveryPricingMap(categories) {
    const map = new Map();
    for (const cat of categories) {
        map.set(cat.id, {
            deliveryPricingEnabled: cat.deliveryPricingEnabled === true,
            extraDeliveryPrice: parseCategoryExtraDeliveryPrice(cat.extraDeliveryPrice),
        });
    }
    return map;
}
/** Per-item delivery markup/surcharge for shop catalog lines. */
function resolveShopItemDeliveryMarkup(config, channel, categoryId, categoryMap) {
    if (channel !== "delivery")
        return 0;
    if (config.categoryPricingEnabled === true) {
        if (!categoryId)
            return 0;
        const cat = categoryMap.get(categoryId);
        if (!cat?.deliveryPricingEnabled)
            return 0;
        return cat.extraDeliveryPrice > 0 ? cat.extraDeliveryPrice : 0;
    }
    const global = Number(config.deliveryMenuMarkup ?? 0);
    return Number.isFinite(global) && global > 0 ? (0, money_1.roundMoney2)(global) : 0;
}
//# sourceMappingURL=shop-delivery-pricing.js.map