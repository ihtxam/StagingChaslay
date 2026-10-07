"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCateringComboPricing = resolveCateringComboPricing;
exports.computeCateringBaseUnit = computeCateringBaseUnit;
exports.scaleModifierPrice = scaleModifierPrice;
exports.computeCateringLineUnitPrice = computeCateringLineUnitPrice;
const catering_config_1 = require("./catering-config");
const money_1 = require("./money");
/** Split combo picks into tier per-person rate (one slot) vs flat surcharges on other slots. */
function resolveCateringComboPricing(input) {
    const config = (0, catering_config_1.normalizeCateringConfig)(input.cateringConfig);
    const guests = (0, catering_config_1.clampGuestCount)(config, input.guestCount);
    const tierSlotId = config.tierSlotId?.trim() || null;
    let tierPerPersonRate = null;
    let comboSurchargeFlat = 0;
    for (const pick of input.comboPicks) {
        const nested = (0, money_1.roundMoney2)((pick.selectedExtras || []).reduce((s, e) => s + (Number(e.price) || 0), 0));
        const pickUnit = (0, money_1.roundMoney2)((Number(pick.extraPrice) || 0) + nested);
        const mult = Math.max(1, Math.floor(pick.qty ?? 1) || 1);
        if (tierSlotId && pick.slotId === tierSlotId) {
            tierPerPersonRate = (0, money_1.roundMoney2)(Number(pick.extraPrice) || 0);
            comboSurchargeFlat += (0, money_1.roundMoney2)(nested * mult);
        }
        else {
            comboSurchargeFlat += (0, money_1.roundMoney2)(pickUnit * mult);
        }
    }
    return { guestCount: guests, tierPerPersonRate, comboSurchargeFlat };
}
function computeCateringBaseUnit(listPrice, configRaw, guestCount, tierPerPersonRate) {
    const config = (0, catering_config_1.normalizeCateringConfig)(configRaw);
    const guests = (0, catering_config_1.clampGuestCount)(config, guestCount);
    const mode = config.pricingMode || "package";
    const packagePart = config.packagePrice != null && Number.isFinite(Number(config.packagePrice))
        ? Number(config.packagePrice)
        : (0, money_1.roundMoney2)(listPrice);
    let perPerson = Math.max(0, Number(config.perPersonPrice) || 0);
    if (tierPerPersonRate != null && Number.isFinite(Number(tierPerPersonRate))) {
        perPerson = Math.max(0, Number(tierPerPersonRate));
    }
    let baseUnit = packagePart;
    if (mode === "per_person") {
        baseUnit = (0, money_1.roundMoney2)(perPerson * guests);
    }
    else if (mode === "mixed") {
        baseUnit = (0, money_1.roundMoney2)(packagePart + perPerson * guests);
    }
    else {
        baseUnit = (0, money_1.roundMoney2)(packagePart);
    }
    return { guestCount: guests, baseUnit, config };
}
/** Apply catering multiplier to a modifier/catalog extra price. */
function scaleModifierPrice(unitPrice, priceScope, guestCount, cateringEnabled) {
    const scope = (0, catering_config_1.normalizeModifierPriceScope)(priceScope);
    if (!cateringEnabled || scope !== "per_guest") {
        return (0, money_1.roundMoney2)(unitPrice);
    }
    const guests = Math.max(1, Math.floor(guestCount) || 1);
    return (0, money_1.roundMoney2)(unitPrice * guests);
}
function computeCateringLineUnitPrice(input) {
    const { guestCount, baseUnit } = computeCateringBaseUnit(input.listPrice, input.cateringConfig, input.guestCount, input.tierPerPersonRate);
    const unitPrice = (0, money_1.roundMoney2)(baseUnit + input.deliveryMarkup + input.extrasTotal + input.comboSurcharge);
    return { unitPrice, guestCount };
}
//# sourceMappingURL=catering-pricing.js.map