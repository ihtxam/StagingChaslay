/**
 * Kiosk settings defaults — run: npx tsx backend/src/lib/kiosk-settings.test.ts
 */
import assert from "node:assert/strict";
import { DEFAULT_KIOSK_SETTINGS, normalizeKioskSettings } from "./kiosk-settings";

assert.equal(DEFAULT_KIOSK_SETTINGS.categoryNav, "left");

const empty = normalizeKioskSettings({});
assert.equal(empty.categoryNav, "left");

const top = normalizeKioskSettings({ categoryNav: "top" });
assert.equal(top.categoryNav, "top");

const junk = normalizeKioskSettings({ categoryNav: "sideways" });
assert.equal(junk.categoryNav, "left");

console.log("kiosk-settings.test.ts: ok");
