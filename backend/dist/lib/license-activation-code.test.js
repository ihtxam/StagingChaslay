"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * POS activation-code normalization — run: cd backend && npx tsx src/lib/license-activation-code.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const license_activation_code_1 = require("./license-activation-code");
strict_1.default.equal((0, license_activation_code_1.compactActivationCode)("1758-D6DD-EF5A"), "1758D6DDEF5A");
strict_1.default.equal((0, license_activation_code_1.compactActivationCode)("1758 d6dd ef5a"), "1758D6DDEF5A");
strict_1.default.equal((0, license_activation_code_1.compactActivationCode)("1758D6DDEF5A"), "1758D6DDEF5A");
strict_1.default.equal((0, license_activation_code_1.compactActivationCode)("  1758-d6dd-ef5a  "), "1758D6DDEF5A");
strict_1.default.equal((0, license_activation_code_1.formatShortActivationCode)("1758D6DDEF5A"), "1758-D6DD-EF5A");
strict_1.default.equal((0, license_activation_code_1.normalizeActivationCode)("1758D6DDEF5A"), "1758-D6DD-EF5A");
strict_1.default.equal((0, license_activation_code_1.normalizeActivationCode)("1758 d6dd ef5a"), "1758-D6DD-EF5A");
strict_1.default.equal((0, license_activation_code_1.normalizeActivationCode)("1758-D6DD-EF5A"), "1758-D6DD-EF5A");
const keys = (0, license_activation_code_1.activationCodeLookupKeys)("1758 d6dd ef5a");
strict_1.default.ok(keys.includes("1758-D6DD-EF5A"));
strict_1.default.ok(keys.includes("1758D6DDEF5A"));
strict_1.default.equal((0, license_activation_code_1.isPlaceholderDeviceId)("POS-899FF4-ABCD-1"), true);
strict_1.default.equal((0, license_activation_code_1.isPlaceholderDeviceId)("8MK3-RPQS"), false);
strict_1.default.equal((0, license_activation_code_1.isUnusedIssuedDevice)({ lastSync: null, appVersion: null }), true);
strict_1.default.equal((0, license_activation_code_1.isUnusedIssuedDevice)({ lastSync: null, appVersion: "" }), true);
strict_1.default.equal((0, license_activation_code_1.isUnusedIssuedDevice)({ lastSync: new Date(), appVersion: "1.0" }), false);
strict_1.default.equal((0, license_activation_code_1.canRebindLicenseDevice)({ deviceId: "8MK3-RPQS", lastSync: null, appVersion: null }, false), true, "unused pre-bound seat can be claimed by the first real tablet");
strict_1.default.equal((0, license_activation_code_1.canRebindLicenseDevice)({ deviceId: "8MK3-RPQS", lastSync: new Date(), appVersion: "2.1" }, false), false, "already-used device stays bound");
strict_1.default.equal((0, license_activation_code_1.canRebindLicenseDevice)({ deviceId: "POS-899FF4-ABCD-1", lastSync: null }, false), true);
strict_1.default.equal((0, license_activation_code_1.canRebindLicenseDevice)({ deviceId: "8MK3-RPQS" }, true), true);
console.log("license-activation-code tests passed");
//# sourceMappingURL=license-activation-code.test.js.map