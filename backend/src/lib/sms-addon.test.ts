/**
 * SMS addon flag — same boolean helper as isGrowthSkuAddonEnabled / isSmsAddonEnabled.
 * run: npx tsx backend/src/lib/sms-addon.test.ts
 */
import assert from "node:assert/strict";

function isSmsAddonEnabled(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true" || value === "t";
}

assert.equal(isSmsAddonEnabled(true), true);
assert.equal(isSmsAddonEnabled(false), false);
assert.equal(isSmsAddonEnabled(1), true);
assert.equal(isSmsAddonEnabled("true"), true);
assert.equal(isSmsAddonEnabled("t"), true);
assert.equal(isSmsAddonEnabled(undefined), false);

console.log("sms-addon.test.ts: ok");
