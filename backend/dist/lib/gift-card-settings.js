"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_GIFT_CARD_SETTINGS = void 0;
exports.normalizeGiftCardSettings = normalizeGiftCardSettings;
exports.validateGiftAmount = validateGiftAmount;
const membership_plans_1 = require("@/lib/membership-plans");
exports.DEFAULT_GIFT_CARD_SETTINGS = {
    enabled: false,
    presetDenominations: [20, 50, 100, 150],
    minAmount: 5,
    maxAmount: 500,
    reloadEnabled: true,
    customAmountEnabled: true,
    onlinePurchaseEnabled: true,
    membershipEnabled: false,
    membershipPlans: [],
};
function roundMoney2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}
function normalizeGiftCardSettings(raw) {
    const src = raw && typeof raw === "object" && !Array.isArray(raw)
        ? raw
        : {};
    const presetsRaw = Array.isArray(src.presetDenominations)
        ? src.presetDenominations
        : exports.DEFAULT_GIFT_CARD_SETTINGS.presetDenominations;
    const presets = [
        ...new Set(presetsRaw
            .map((v) => roundMoney2(Number(v)))
            .filter((n) => Number.isFinite(n) && n > 0)),
    ].sort((a, b) => a - b);
    let minAmount = roundMoney2(Number(src.minAmount ?? exports.DEFAULT_GIFT_CARD_SETTINGS.minAmount));
    let maxAmount = roundMoney2(Number(src.maxAmount ?? exports.DEFAULT_GIFT_CARD_SETTINGS.maxAmount));
    if (!Number.isFinite(minAmount) || minAmount < 0)
        minAmount = exports.DEFAULT_GIFT_CARD_SETTINGS.minAmount;
    if (!Number.isFinite(maxAmount) || maxAmount < minAmount) {
        maxAmount = Math.max(minAmount, exports.DEFAULT_GIFT_CARD_SETTINGS.maxAmount);
    }
    const membershipPlans = (0, membership_plans_1.normalizeMembershipPlans)(src.membershipPlans);
    return {
        enabled: src.enabled === true,
        presetDenominations: presets.length
            ? presets
            : [...exports.DEFAULT_GIFT_CARD_SETTINGS.presetDenominations],
        minAmount,
        maxAmount,
        reloadEnabled: src.reloadEnabled !== false,
        customAmountEnabled: src.customAmountEnabled !== false,
        onlinePurchaseEnabled: src.onlinePurchaseEnabled !== false,
        membershipEnabled: src.membershipEnabled === true,
        membershipPlans,
    };
}
function validateGiftAmount(amount, settings) {
    const n = roundMoney2(Number(amount));
    if (!Number.isFinite(n) || n <= 0) {
        return { ok: false, error: "Valid amount is required" };
    }
    if (n < settings.minAmount || n > settings.maxAmount) {
        return {
            ok: false,
            error: `Amount must be between CHF ${settings.minAmount.toFixed(2)} and CHF ${settings.maxAmount.toFixed(2)}`,
        };
    }
    return { ok: true, amount: n };
}
//# sourceMappingURL=gift-card-settings.js.map