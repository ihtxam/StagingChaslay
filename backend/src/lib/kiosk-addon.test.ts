/**
 * Kiosk addon flag helpers — run: npx tsx backend/src/lib/kiosk-addon.test.ts
 */
import assert from "node:assert/strict";
import { isKioskAddonEnabled } from "./kiosk-addon";

assert.equal(isKioskAddonEnabled(true), true);
assert.equal(isKioskAddonEnabled(false), false);
assert.equal(isKioskAddonEnabled(1), true);
assert.equal(isKioskAddonEnabled(0), false);
assert.equal(isKioskAddonEnabled("1"), true);
assert.equal(isKioskAddonEnabled("true"), true);
assert.equal(isKioskAddonEnabled("t"), true);
assert.equal(isKioskAddonEnabled(undefined), false);
assert.equal(isKioskAddonEnabled(null), false);

console.log("kiosk-addon.test.ts: ok");
