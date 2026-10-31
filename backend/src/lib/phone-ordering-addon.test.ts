/**
 * Phone ordering addon flag — run: npx tsx backend/src/lib/phone-ordering-addon.test.ts
 */
import assert from "node:assert/strict";
import { isPhoneOrderingAddonEnabled, isPhoneOrderingLicensed } from "./phone-ordering-addon.ts";

assert.equal(isPhoneOrderingAddonEnabled(true), true);
assert.equal(isPhoneOrderingAddonEnabled(false), false);
assert.equal(isPhoneOrderingLicensed({ phoneOrderingAddonEnabled: true }), true);
assert.equal(isPhoneOrderingLicensed({ phoneOrderingAddonEnabled: false }), false);
assert.equal(isPhoneOrderingLicensed(null), false);

console.log("phone-ordering-addon.test.ts: ok");
