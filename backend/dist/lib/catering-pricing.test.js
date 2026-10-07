"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Catering pricing — run: cd backend && npx tsx src/lib/catering-pricing.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const catering_pricing_ts_1 = require("./catering-pricing.ts");
const cfgPackage = { enabled: true, pricingMode: "package", packagePrice: 30 };
const cfgPerPerson = { enabled: true, pricingMode: "per_person", perPersonPrice: 35 };
const cfgMixed = {
    enabled: true,
    pricingMode: "mixed",
    packagePrice: 10,
    perPersonPrice: 5,
    minGuests: 2,
    maxGuests: 100,
};
strict_1.default.equal((0, catering_pricing_ts_1.computeCateringBaseUnit)(99, cfgPackage, 10).baseUnit, 30);
strict_1.default.equal((0, catering_pricing_ts_1.computeCateringBaseUnit)(99, cfgPerPerson, 4).baseUnit, 140);
strict_1.default.equal((0, catering_pricing_ts_1.computeCateringBaseUnit)(99, cfgMixed, 4).baseUnit, 30);
strict_1.default.equal((0, catering_pricing_ts_1.computeCateringBaseUnit)(99, cfgMixed, 1).guestCount, 2);
strict_1.default.equal((0, catering_pricing_ts_1.scaleModifierPrice)(2, "per_guest", 10, true), 20);
strict_1.default.equal((0, catering_pricing_ts_1.scaleModifierPrice)(2, "per_guest", 10, false), 2);
strict_1.default.equal((0, catering_pricing_ts_1.scaleModifierPrice)(50, "fixed", 10, true), 50);
const line = (0, catering_pricing_ts_1.computeCateringLineUnitPrice)({
    listPrice: 30,
    cateringConfig: cfgPerPerson,
    guestCount: 2,
    comboSurcharge: 0,
    extrasTotal: 4,
    deliveryMarkup: 0,
});
strict_1.default.equal(line.unitPrice, 74);
strict_1.default.equal(line.guestCount, 2);
const tierCfg = {
    enabled: true,
    pricingMode: "per_person",
    perPersonPrice: 0,
    minGuests: 15,
    tierSlotId: "protein",
};
const tierSplit = (0, catering_pricing_ts_1.resolveCateringComboPricing)({
    cateringConfig: tierCfg,
    guestCount: 15,
    comboPicks: [
        { slotId: "protein", extraPrice: 12 },
        { slotId: "beans", extraPrice: 0 },
    ],
});
strict_1.default.equal(tierSplit.tierPerPersonRate, 12);
strict_1.default.equal(tierSplit.comboSurchargeFlat, 0);
const tacoBar = (0, catering_pricing_ts_1.computeCateringLineUnitPrice)({
    listPrice: 0,
    cateringConfig: tierCfg,
    guestCount: 15,
    comboSurcharge: tierSplit.comboSurchargeFlat,
    extrasTotal: 0,
    deliveryMarkup: 0,
    tierPerPersonRate: tierSplit.tierPerPersonRate,
});
strict_1.default.equal(tacoBar.unitPrice, 180);
console.log("catering-pricing.test.ts OK");
//# sourceMappingURL=catering-pricing.test.js.map