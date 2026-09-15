"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Kiosk addon flag helpers — run: npx tsx backend/src/lib/kiosk-addon.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const kiosk_addon_1 = require("./kiosk-addon");
strict_1.default.equal((0, kiosk_addon_1.isKioskAddonEnabled)(true), true);
strict_1.default.equal((0, kiosk_addon_1.isKioskAddonEnabled)(false), false);
strict_1.default.equal((0, kiosk_addon_1.isKioskAddonEnabled)(1), true);
strict_1.default.equal((0, kiosk_addon_1.isKioskAddonEnabled)(0), false);
strict_1.default.equal((0, kiosk_addon_1.isKioskAddonEnabled)("1"), true);
strict_1.default.equal((0, kiosk_addon_1.isKioskAddonEnabled)("true"), true);
strict_1.default.equal((0, kiosk_addon_1.isKioskAddonEnabled)("t"), true);
strict_1.default.equal((0, kiosk_addon_1.isKioskAddonEnabled)(undefined), false);
strict_1.default.equal((0, kiosk_addon_1.isKioskAddonEnabled)(null), false);
console.log("kiosk-addon.test.ts: ok");
//# sourceMappingURL=kiosk-addon.test.js.map