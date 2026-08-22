"use strict";
/** Shared POS / WebPOS checkout settings (panel + devices). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_POS_CHECKOUT = void 0;
exports.isRetailPosMode = isRetailPosMode;
exports.normalizePosCheckoutSettings = normalizePosCheckoutSettings;
exports.DEFAULT_POS_CHECKOUT = {
    tipsEnabled: true,
    tipPresetsPercent: [0, 5, 10, 15],
    allowCustomTip: true,
    discountsEnabled: true,
    discountPresets: [
        { id: "none", name: "None", percent: 0 },
        { id: "staff", name: "Staff", percent: 10 },
        { id: "vip", name: "VIP", percent: 15 },
    ],
    roundingStep: 0.05,
    quickCashEnabled: true,
    quickCashDenominations: [10, 20, 50, 100],
    splitBillsEnabled: true,
    maxSplitParts: 8,
    vatIncludedInPrice: false,
    courseSendMode: "fire_per_course",
    cartSide: "right",
    postSuccessTarget: "register",
    posMode: "restaurant",
    tablesEnabled: true,
    retailTakeawayEnabled: false,
    retailDeliveryEnabled: false,
    retailDineInEnabled: false,
    requireTableForDineIn: true,
};
function asNumberArray(v, fallback) {
    if (!Array.isArray(v))
        return fallback;
    const nums = v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 0);
    return nums.length ? nums : fallback;
}
function isRetailPosMode(raw) {
    return normalizePosCheckoutSettings(raw).posMode === "retail";
}
function normalizePosCheckoutSettings(raw) {
    const src = (raw && typeof raw === "object" ? raw : {});
    const presetsRaw = Array.isArray(src.discountPresets) ? src.discountPresets : null;
    const discountPresets = presetsRaw
        ? presetsRaw
            .map((p, i) => {
            const o = (p && typeof p === "object" ? p : {});
            const percent = Math.max(0, Math.min(100, Number(o.percent) || 0));
            const name = String(o.name || `${percent}%`).trim().slice(0, 40) || `${percent}%`;
            const id = String(o.id || `d${i}`).trim().slice(0, 40) || `d${i}`;
            return { id, name, percent };
        })
            .slice(0, 20)
        : exports.DEFAULT_POS_CHECKOUT.discountPresets;
    const tipPresets = asNumberArray(src.tipPresetsPercent, exports.DEFAULT_POS_CHECKOUT.tipPresetsPercent)
        .map((n) => Math.max(0, Math.min(100, n)))
        .slice(0, 8);
    const dens = asNumberArray(src.quickCashDenominations, exports.DEFAULT_POS_CHECKOUT.quickCashDenominations)
        .filter((n) => n > 0)
        .slice(0, 12);
    let roundingStep = Number(src.roundingStep);
    if (![0, 0.05, 0.1, 0.5, 1].includes(roundingStep)) {
        roundingStep = exports.DEFAULT_POS_CHECKOUT.roundingStep;
    }
    const maxSplitParts = Math.max(2, Math.min(20, Number(src.maxSplitParts) || exports.DEFAULT_POS_CHECKOUT.maxSplitParts));
    const courseSendMode = src.courseSendMode === "send_all_once" ? "send_all_once" : "fire_per_course";
    const cartSide = src.cartSide === "left" ? "left" : "right";
    const postSuccessTarget = src.postSuccessTarget === "tables" ? "tables" : "register";
    const posMode = src.posMode === "retail" ? "retail" : "restaurant";
    const requireTableForDineIn = src.requireTableForDineIn === undefined
        ? posMode !== "retail"
        : src.requireTableForDineIn !== false;
    return {
        tipsEnabled: src.tipsEnabled !== false,
        tipPresetsPercent: tipPresets.length ? tipPresets : exports.DEFAULT_POS_CHECKOUT.tipPresetsPercent,
        allowCustomTip: src.allowCustomTip !== false,
        discountsEnabled: src.discountsEnabled !== false,
        discountPresets,
        roundingStep,
        quickCashEnabled: src.quickCashEnabled !== false,
        quickCashDenominations: dens.length ? dens : exports.DEFAULT_POS_CHECKOUT.quickCashDenominations,
        splitBillsEnabled: src.splitBillsEnabled !== false,
        maxSplitParts,
        vatIncludedInPrice: src.vatIncludedInPrice === true,
        courseSendMode,
        cartSide,
        postSuccessTarget,
        posMode,
        tablesEnabled: src.tablesEnabled !== false,
        retailTakeawayEnabled: src.retailTakeawayEnabled === true,
        retailDeliveryEnabled: src.retailDeliveryEnabled === true,
        retailDineInEnabled: src.retailDineInEnabled === true,
        requireTableForDineIn,
    };
}
//# sourceMappingURL=pos-checkout-settings.js.map