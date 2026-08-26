"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPosLicenseActivation = logPosLicenseActivation;
const platform_log_service_1 = require("@/services/platform-log.service");
const chaslay_compat_service_1 = require("@/services/chaslay-compat.service");
function activationCodeHint(code) {
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
    if (!clean)
        return "(empty)";
    if (clean.length <= 4)
        return `${clean}***`;
    return `${clean.slice(0, 4)}***`;
}
/** Write a platform event log entry for superadmin System Logs. Returns log id as reference. */
async function logPosLicenseActivation(input) {
    const deviceId = (0, chaslay_compat_service_1.normalizeChaslayDeviceId)(input.deviceId) || input.deviceId.trim();
    const codeHint = activationCodeHint(input.activationCode);
    const source = input.source || "android_pos";
    const message = input.outcome === "success"
        ? `POS license activated (device ${deviceId || "unknown"})`
        : `POS license activation failed: ${input.errorMessage || "unknown error"}`;
    const row = await platform_log_service_1.PlatformLogService.write({
        level: input.outcome === "success" ? "info" : "error",
        category: "license_activation",
        message,
        merchantId: input.merchantId || null,
        metadata: {
            outcome: input.outcome,
            source,
            deviceId: deviceId || null,
            activationCodeHint: codeHint,
            errorMessage: input.errorMessage || null,
            tenantSlug: input.tenantSlug || null,
            appVersion: input.appVersion || null,
            deviceModel: input.deviceModel || null,
        },
    });
    return row.id;
}
//# sourceMappingURL=license-activation-log.js.map