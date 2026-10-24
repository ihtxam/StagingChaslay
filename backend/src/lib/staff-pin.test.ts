/**
 * Staff PIN policy — run: cd backend && npx tsx src/lib/staff-pin.test.ts
 */
import assert from "node:assert/strict";
import {
  assertValidStaffPin,
  isValidStaffPin,
  normalizeStaffPinInput,
  STAFF_PIN_LENGTH,
} from "./staff-pin";

assert.equal(STAFF_PIN_LENGTH, 4);
assert.equal(normalizeStaffPinInput(" 0000 "), "0000");
assert.equal(isValidStaffPin("0000"), true);
assert.equal(isValidStaffPin("12345"), false);
assert.equal(isValidStaffPin("123"), false);
assert.throws(() => assertValidStaffPin("999"), /exactly 4 digits/);

console.log("staff-pin: all assertions passed");
