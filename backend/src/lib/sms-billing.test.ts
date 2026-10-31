/**
 * SMS billing helpers — run: npx tsx backend/src/lib/sms-billing.test.ts
 */
import assert from "node:assert/strict";
import {
  DEFAULT_SMS_UNIT_PRICE_CENTS,
  formatSmsBillChf,
  normalizeSmsUnitPriceCents,
  smsBillableCents,
} from "./sms-billing";

assert.equal(DEFAULT_SMS_UNIT_PRICE_CENTS, 15);
assert.equal(normalizeSmsUnitPriceCents(undefined), 15);
assert.equal(normalizeSmsUnitPriceCents(20), 20);
assert.equal(normalizeSmsUnitPriceCents(0), 15);
assert.equal(smsBillableCents(2, 15), 30);
assert.equal(smsBillableCents(0, 15), 15);
assert.equal(formatSmsBillChf(155), "1.55");

console.log("sms-billing.test.ts: ok");
