"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHOP_SIZE_MODIFIER_GROUP_ID = void 0;
exports.inStockProductSpecifications = inStockProductSpecifications;
exports.specificationOptionPriceDelta = specificationOptionPriceDelta;
const money_1 = require("@/lib/money");
/** Matches client synthetic size group id in shop-modifier-utils. */
exports.SHOP_SIZE_MODIFIER_GROUP_ID = "__sizes__";
function inStockProductSpecifications(specifications) {
    if (!Array.isArray(specifications))
        return [];
    return specifications
        .filter((raw) => !!raw &&
        typeof raw === "object" &&
        typeof raw.name === "string" &&
        !!raw.name?.trim() &&
        (raw.saleStatus || "in_stock") !== "out_of_stock")
        .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0))
        .map((s, i) => ({
        id: String(s.id || `spec-${i + 1}`).trim(),
        name: String(s.name).trim(),
        price: (0, money_1.roundMoney2)(Number(s.price) || 0),
        isDefault: !!s.isDefault,
    }));
}
function specificationOptionPriceDelta(basePrice, specPrice) {
    return (0, money_1.roundMoney2)(specPrice - (0, money_1.roundMoney2)(basePrice));
}
//# sourceMappingURL=shop-product-specifications.js.map