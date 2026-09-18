"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * License activation error sanitizer + device-id matching.
 * Run: cd backend && npx tsx src/lib/license-activation-log.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const license_activation_log_1 = require("./license-activation-log");
const chaslay_compat_service_1 = require("../services/chaslay-compat.service");
strict_1.default.equal((0, license_activation_log_1.publicLicenseActivationError)(new Error("Failed query: select `licenses`.`id`, json_build_array(`licenses.merchant`.`webpos_errors_enabled`, `licenses.merchant`.`webpos_crash_enabled`)")), "Activation failed. Please try again or contact support.");
strict_1.default.equal((0, license_activation_log_1.publicLicenseActivationError)(new Error("License expired or inactive")), "License expired or inactive");
strict_1.default.equal((0, license_activation_log_1.publicLicenseActivationError)(new Error("column \"webpos_errors_enabled\" does not exist")), "Activation failed. Please try again or contact support.");
strict_1.default.equal((0, chaslay_compat_service_1.normalizeActivationCode)(" 1758-d6dd-ef5a "), "1758-D6DD-EF5A");
strict_1.default.equal((0, chaslay_compat_service_1.posDeviceIdsMatch)("8MK3-RPQ5", "8MK3-RPQ5"), true);
strict_1.default.equal((0, chaslay_compat_service_1.posDeviceIdsMatch)("8MK3RPQ5", "8MK3-RPQ5"), true);
strict_1.default.equal((0, chaslay_compat_service_1.posDeviceIdsMatch)("8MK3-RPQ5", "AAAA-BBBB"), false);
console.log("license-activation-log.test.ts: ok");
//# sourceMappingURL=license-activation-log.test.js.map