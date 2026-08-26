"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chaslay_compat_service_1 = require("@/services/chaslay-compat.service");
const license_activation_log_1 = require("@/lib/license-activation-log");
const router = (0, express_1.Router)();
router.post("/activate", async (req, res) => {
    const { deviceId, activationCode, appVersion, deviceModel, tenantSlug } = req.body ?? {};
    const resolvedTenantSlug = tenantSlug ?? req.header("X-Tenant-Slug");
    try {
        if (!deviceId || !activationCode) {
            const referenceId = await (0, license_activation_log_1.logPosLicenseActivation)({
                outcome: "failure",
                deviceId: String(deviceId || ""),
                activationCode: String(activationCode || ""),
                errorMessage: "deviceId and activationCode are required",
                tenantSlug: resolvedTenantSlug,
                appVersion,
                deviceModel,
            });
            return res.status(400).json({
                error: "deviceId and activationCode are required",
                referenceId,
            });
        }
        const result = await chaslay_compat_service_1.ChaslayCompatService.activateLicense({
            deviceId,
            activationCode,
            appVersion,
            deviceModel,
            tenantSlug: resolvedTenantSlug,
        });
        await (0, license_activation_log_1.logPosLicenseActivation)({
            outcome: "success",
            deviceId: String(deviceId),
            activationCode: String(activationCode),
            tenantSlug: result.tenantSlug,
            appVersion,
            deviceModel,
        });
        res.json(result);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Activation failed";
        const referenceId = await (0, license_activation_log_1.logPosLicenseActivation)({
            outcome: "failure",
            deviceId: String(deviceId || ""),
            activationCode: String(activationCode || ""),
            errorMessage: message,
            tenantSlug: resolvedTenantSlug,
            appVersion,
            deviceModel,
        });
        res.status(400).json({ error: message, referenceId });
    }
});
/** Client-side activation failures (network, parse) before/during activate — no auth required. */
router.post("/report-error", async (req, res) => {
    try {
        const { deviceId, activationCode, errorMessage, appVersion, deviceModel, tenantSlug } = req.body ?? {};
        if (!deviceId || !errorMessage) {
            return res.status(400).json({ error: "deviceId and errorMessage are required" });
        }
        const referenceId = await (0, license_activation_log_1.logPosLicenseActivation)({
            outcome: "failure",
            deviceId: String(deviceId),
            activationCode: String(activationCode || ""),
            errorMessage: String(errorMessage),
            tenantSlug: tenantSlug ?? req.header("X-Tenant-Slug"),
            appVersion,
            deviceModel,
            source: "android_client",
        });
        res.json({ ok: true, referenceId });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to record error" });
    }
});
router.post("/validate", async (req, res) => {
    try {
        const { deviceId, appVersion, tenantSlug } = req.body ?? {};
        if (!deviceId) {
            return res.status(400).json({ error: "deviceId is required" });
        }
        const result = await chaslay_compat_service_1.ChaslayCompatService.validateLicense({
            deviceId,
            appVersion,
            tenantSlug: tenantSlug ?? req.header("X-Tenant-Slug"),
        });
        res.json(result);
    }
    catch (error) {
        res.status(403).json({ error: error instanceof Error ? error.message : "Validation failed" });
    }
});
exports.default = router;
//# sourceMappingURL=license.routes.js.map