/**
 * Catering pricing — run: cd backend && npx tsx src/lib/catering-pricing.test.ts
 */
import assert from "node:assert/strict";
import {
  computeCateringBaseUnit,
  computeCateringLineUnitPrice,
  scaleModifierPrice,
} from "./catering-pricing.ts";

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

assert.equal(computeCateringBaseUnit(99, cfgPackage, 10).baseUnit, 30);
assert.equal(computeCateringBaseUnit(99, cfgPerPerson, 4).baseUnit, 140);
assert.equal(computeCateringBaseUnit(99, cfgMixed, 4).baseUnit, 30);
assert.equal(computeCateringBaseUnit(99, cfgMixed, 1).guestCount, 2);

assert.equal(scaleModifierPrice(2, "per_guest", 10, true), 20);
assert.equal(scaleModifierPrice(2, "per_guest", 10, false), 2);
assert.equal(scaleModifierPrice(50, "fixed", 10, true), 50);

const line = computeCateringLineUnitPrice({
  listPrice: 30,
  cateringConfig: cfgPerPerson,
  guestCount: 2,
  comboSurcharge: 0,
  extrasTotal: 4,
  deliveryMarkup: 0,
});
assert.equal(line.unitPrice, 74);
assert.equal(line.guestCount, 2);

console.log("catering-pricing.test.ts OK");
