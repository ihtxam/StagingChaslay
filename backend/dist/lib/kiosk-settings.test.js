"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Kiosk settings defaults — run: npx tsx backend/src/lib/kiosk-settings.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const kiosk_settings_1 = require("./kiosk-settings");
strict_1.default.equal(kiosk_settings_1.DEFAULT_KIOSK_SETTINGS.kioskLayout, "restaurant");
strict_1.default.equal(kiosk_settings_1.DEFAULT_KIOSK_SETTINGS.categoryNav, "left");
const empty = (0, kiosk_settings_1.normalizeKioskSettings)({});
strict_1.default.equal(empty.kioskLayout, "restaurant");
strict_1.default.equal(empty.categoryNav, "left");
const top = (0, kiosk_settings_1.normalizeKioskSettings)({ categoryNav: "top" });
strict_1.default.equal(top.categoryNav, "top");
strict_1.default.equal(top.kioskLayout, "restaurant");
const junk = (0, kiosk_settings_1.normalizeKioskSettings)({ categoryNav: "sideways" });
strict_1.default.equal(junk.categoryNav, "left");
const groceryDefault = (0, kiosk_settings_1.normalizeKioskSettings)({ kioskLayout: "grocery" });
strict_1.default.equal(groceryDefault.kioskLayout, "grocery");
strict_1.default.equal(groceryDefault.categoryNav, "bottom");
const groceryLeft = (0, kiosk_settings_1.normalizeKioskSettings)({ kioskLayout: "grocery", categoryNav: "left" });
strict_1.default.equal(groceryLeft.categoryNav, "left");
const groceryIgnoresTop = (0, kiosk_settings_1.normalizeKioskSettings)({ kioskLayout: "grocery", categoryNav: "top" });
strict_1.default.equal(groceryIgnoresTop.categoryNav, "bottom");
const restaurantIgnoresBottom = (0, kiosk_settings_1.normalizeKioskSettings)({
    kioskLayout: "restaurant",
    categoryNav: "bottom",
});
strict_1.default.equal(restaurantIgnoresBottom.categoryNav, "left");
console.log("kiosk-settings.test.ts: ok");
//# sourceMappingURL=kiosk-settings.test.js.map