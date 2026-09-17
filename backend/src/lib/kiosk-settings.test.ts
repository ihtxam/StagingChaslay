/**
 * Kiosk settings defaults — run: npx tsx backend/src/lib/kiosk-settings.test.ts
 */
import assert from "node:assert/strict";
import { DEFAULT_KIOSK_SETTINGS, normalizeKioskSettings } from "./kiosk-settings";

assert.equal(DEFAULT_KIOSK_SETTINGS.kioskLayout, "restaurant");
assert.equal(DEFAULT_KIOSK_SETTINGS.categoryNav, "left");

const empty = normalizeKioskSettings({});
assert.equal(empty.kioskLayout, "restaurant");
assert.equal(empty.categoryNav, "left");

const top = normalizeKioskSettings({ categoryNav: "top" });
assert.equal(top.categoryNav, "top");
assert.equal(top.kioskLayout, "restaurant");

const junk = normalizeKioskSettings({ categoryNav: "sideways" });
assert.equal(junk.categoryNav, "left");

const groceryDefault = normalizeKioskSettings({ kioskLayout: "grocery" });
assert.equal(groceryDefault.kioskLayout, "grocery");
assert.equal(groceryDefault.categoryNav, "bottom");

const groceryLeft = normalizeKioskSettings({ kioskLayout: "grocery", categoryNav: "left" });
assert.equal(groceryLeft.categoryNav, "left");

const groceryIgnoresTop = normalizeKioskSettings({ kioskLayout: "grocery", categoryNav: "top" });
assert.equal(groceryIgnoresTop.categoryNav, "bottom");

const restaurantIgnoresBottom = normalizeKioskSettings({
  kioskLayout: "restaurant",
  categoryNav: "bottom",
});
assert.equal(restaurantIgnoresBottom.categoryNav, "left");

console.log("kiosk-settings.test.ts: ok");
