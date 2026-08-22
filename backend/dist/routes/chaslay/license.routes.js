"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chaslay_compat_service_1 = require("@/services/chaslay-compat.service");
const router = (0, express_1.Router)();
router.post("/activate", async (req, res) => {
    try {
        const { deviceId, activationCode, appVersion, deviceModel, tenantSlug } = req.body ?? {};
        if (!deviceId || !activationCode) {
            return res.status(400).json({ error: "deviceId and activationCode are required" });
        }
        const result = await chaslay_compat_service_1.ChaslayCompatService.activateLicense({
            deviceId,
            activationCode,
            appVersion,
            deviceModel,
            tenantSlug: tenantSlug ?? req.header("X-Tenant-Slug"),
        });
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Activation failed" });
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