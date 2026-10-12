/**
 * Catering addon is off unless explicitly enabled.
 * Run: npx tsx backend/src/lib/catering-addon.test.ts
 */
import assert from "node:assert/strict";
import { isCateringAddonEnabled, isCateringLicensed } from "./catering-addon";

assert.equal(isCateringAddonEnabled(true), true);
assert.equal(isCateringAddonEnabled(false), false);
assert.equal(isCateringAddonEnabled(1), true);
assert.equal(isCateringAddonEnabled(0), false);
assert.equal(isCateringAddonEnabled("true"), true);
assert.equal(isCateringAddonEnabled(undefined), false);
assert.equal(isCateringAddonEnabled(null), false);

assert.equal(isCateringLicensed(null), false);
assert.equal(isCateringLicensed({}), false);
assert.equal(isCateringLicensed({ cateringEnabled: false }), false);
assert.equal(isCateringLicensed({ cateringAddonEnabled: true }), true);
assert.equal(isCateringLicensed({ cateringEnabled: true }), true);

console.log("catering-addon.test.ts: ok");
