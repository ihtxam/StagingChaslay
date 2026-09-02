/**
 * Staff PIN helpers — run: cd backend && npx tsx src/lib/staff-pin-input.test.ts
 */
import assert from "node:assert/strict";

function normalizePinInput(pin: unknown): string {
  return String(pin ?? "")
    .trim()
    .replace(/\D/g, "");
}

assert.equal(normalizePinInput("0000"), "0000");
assert.equal(normalizePinInput(" 0000 "), "0000");
assert.equal(normalizePinInput(""), "");
assert.equal(normalizePinInput(null), "");

console.log("staff-pin-input: all assertions passed");
