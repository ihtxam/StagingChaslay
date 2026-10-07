"use strict";
/** Flexible catering / prepackaged menu settings on combo products. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCateringConfig = normalizeCateringConfig;
exports.isCateringProduct = isCateringProduct;
exports.clampGuestCount = clampGuestCount;
exports.normalizeModifierPriceScope = normalizeModifierPriceScope;
function normalizeCateringConfig(raw) {
    const o = (raw && typeof raw === "object" ? raw : {});
    const mode = String(o.pricingMode || "package").toLowerCase();
    const pricingMode = mode === "per_person" || mode === "mixed" ? mode : "package";
    const num = (k) => {
        const v = o[k];
        if (v == null || v === "")
            return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    };
    return {
        enabled: o.enabled === true,
        pricingMode,
        packagePrice: num("packagePrice") ?? null,
        perPersonPrice: num("perPersonPrice") ?? null,
        minGuests: num("minGuests") != null ? Math.max(1, Math.floor(num("minGuests"))) : undefined,
        maxGuests: num("maxGuests") != null ? Math.max(1, Math.floor(num("maxGuests"))) : undefined,
        defaultGuests: num("defaultGuests") != null ? Math.max(1, Math.floor(num("defaultGuests"))) : undefined,
        tierSlotId: typeof o.tierSlotId === "string" && o.tierSlotId.trim() ? o.tierSlotId.trim() : null,
        servesCount: num("servesCount") != null ? Math.max(1, Math.floor(num("servesCount"))) : undefined,
        minOrderQty: num("minOrderQty") != null ? Math.max(1, Math.floor(num("minOrderQty"))) : undefined,
        leadTimeHours: num("leadTimeHours") != null ? Math.max(0, Math.floor(num("leadTimeHours"))) : undefined,
    };
}
function isCateringProduct(productType, config) {
    if (productType !== "combo")
        return false;
    return normalizeCateringConfig(config).enabled === true;
}
function clampGuestCount(config, requested) {
    const min = config.minGuests ?? 1;
    const max = config.maxGuests ?? 999;
    const n = Math.floor(Number(requested) || config.defaultGuests || min);
    return Math.min(max, Math.max(min, n));
}
function normalizeModifierPriceScope(raw) {
    return String(raw || "fixed").toLowerCase() === "per_guest" ? "per_guest" : "fixed";
}
//# sourceMappingURL=catering-config.js.map