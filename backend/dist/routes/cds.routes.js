"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cdsMerchantRouter = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const cds_service_1 = require("@/services/cds.service");
const router = (0, express_1.Router)();
function handleError(res, error, fallback, status = 400) {
    const message = error instanceof Error ? error.message : fallback;
    if (message.toLowerCase().includes("not found") || message.toLowerCase().includes("disabled")) {
        return res.status(404).json({ error: message });
    }
    return res.status(status).json({ error: message });
}
/** Public CDS config — token in URL, no JWT */
router.get("/:token/config", async (req, res) => {
    try {
        const data = await cds_service_1.CdsService.configForToken(req.params.token);
        res.json({ success: true, ...data });
    }
    catch (error) {
        handleError(res, error, "Failed to load customer display config", 500);
    }
});
router.get("/:token/state", async (req, res) => {
    try {
        const state = await cds_service_1.CdsService.liveStateForToken(req.params.token);
        res.json({ success: true, state });
    }
    catch (error) {
        handleError(res, error, "Failed to load customer display state", 500);
    }
});
exports.default = router;
/** Merchant-authenticated CDS settings */
exports.cdsMerchantRouter = (0, express_1.Router)();
exports.cdsMerchantRouter.use(auth_middleware_1.verifyToken);
exports.cdsMerchantRouter.use(auth_middleware_1.requireMerchantAccess);
exports.cdsMerchantRouter.use(auth_middleware_1.setMerchantContext);
exports.cdsMerchantRouter.get("/settings", async (req, res) => {
    try {
        const settings = await cds_service_1.CdsService.getSettings(req.merchantId);
        res.json({ success: true, settings });
    }
    catch (error) {
        handleError(res, error, "Failed to load customer display settings", 500);
    }
});
exports.cdsMerchantRouter.put("/settings", async (req, res) => {
    try {
        const settings = await cds_service_1.CdsService.updateSettings(req.merchantId, req.body?.settings);
        res.json({ success: true, settings });
    }
    catch (error) {
        handleError(res, error, "Failed to save customer display settings");
    }
});
exports.cdsMerchantRouter.post("/settings/rotate-token", async (req, res) => {
    try {
        const settings = await cds_service_1.CdsService.rotateToken(req.merchantId);
        res.json({ success: true, settings });
    }
    catch (error) {
        handleError(res, error, "Failed to rotate token");
    }
});
exports.cdsMerchantRouter.post("/push", async (req, res) => {
    try {
        const state = await cds_service_1.CdsService.pushLiveState(req.merchantId, req.body?.state);
        res.json({ success: true, state });
    }
    catch (error) {
        handleError(res, error, "Failed to push customer display state");
    }
});
//# sourceMappingURL=cds.routes.js.map