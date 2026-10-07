"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCartGiftTiers = normalizeCartGiftTiers;
exports.cartPaidSubtotal = cartPaidSubtotal;
exports.evaluateCartGiftTiers = evaluateCartGiftTiers;
exports.validateCartFreeGiftLine = validateCartFreeGiftLine;
const money_1 = require("./money");
const shop_currency_1 = require("./shop-currency");
function normalizeCartGiftTiers(raw) {
    if (!raw || typeof raw !== "object")
        return [];
    const tiers = raw.cartGiftTiers;
    if (!Array.isArray(tiers))
        return [];
    return tiers
        .map((t, idx) => {
        const minCartTotal = (0, money_1.roundMoney2)(Number(t?.minCartTotal) || 0);
        const productIds = Array.isArray(t?.productIds)
            ? [...new Set(t.productIds.map(String).filter(Boolean))]
            : [];
        const label = t?.label != null ? String(t.label).trim().slice(0, 120) : undefined;
        return { minCartTotal, productIds, label, _idx: idx };
    })
        .filter((t) => t.minCartTotal > 0 && t.productIds.length > 0)
        .sort((a, b) => a.minCartTotal - b.minCartTotal || a._idx - b._idx)
        .map(({ _idx, ...t }) => t);
}
/** Paid merchandise subtotal (excludes loyalty rewards and cart free-gift lines). */
function cartPaidSubtotal(lines) {
    return (0, money_1.roundMoney2)(lines
        .filter((l) => !l.loyaltyReward &&
        !(l.cartFreeGiftOfferId && l.cartFreeGiftTierIndex != null))
        .reduce((s, l) => s + (Number(l.unitPrice) || 0) * (Number(l.quantity) || 0), 0));
}
function evaluateCartGiftTiers(input) {
    const { tiers, subtotal, claimedByTier } = input;
    return tiers.map((tier, tierIndex) => {
        const unlocked = subtotal + 0.001 >= tier.minCartTotal;
        const remaining = unlocked ? 0 : (0, money_1.roundMoney2)(Math.max(0, tier.minCartTotal - subtotal));
        return {
            tierIndex,
            minCartTotal: tier.minCartTotal,
            productIds: tier.productIds,
            label: tier.label,
            unlocked,
            remaining,
            claimedProductId: claimedByTier.get(tierIndex) ?? null,
        };
    });
}
function validateCartFreeGiftLine(input) {
    const tier = input.tiers[input.tierIndex];
    if (!tier)
        return "Invalid free gift tier";
    if (input.paidSubtotal + 0.001 < tier.minCartTotal) {
        const cur = input.currency || "CHF";
        return `Cart total must be at least ${(0, shop_currency_1.formatShopMoney)(tier.minCartTotal, cur)} for this free gift`;
    }
    if (!tier.productIds.includes(input.productId)) {
        return "Product is not allowed for this free gift tier";
    }
    void input.offerId;
    return null;
}
//# sourceMappingURL=cart-free-gift.js.map