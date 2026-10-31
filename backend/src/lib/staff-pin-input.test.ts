/**
 * Staff PIN helpers — run: cd backend && npx tsx src/lib/staff-pin-input.test.ts
 */
import assert from "node:assert/strict";
import { normalizeStaffPinInput } from "./staff-pin";

assert.equal(normalizeStaffPinInput("0000"), "0000");
assert.equal(normalizeStaffPinInput(" 0000 "), "0000");
assert.equal(normalizeStaffPinInput(""), "");
assert.equal(normalizeStaffPinInput(null), "");

console.log("staff-pin-input: all assertions passed");
