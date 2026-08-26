"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.odsMerchantRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const ods_service_1 = require("@/services/ods.service");
const router = (0, express_1.Router)();
function handleError(res, error, fallback) {
    if (error instanceof ods_service_1.OdsLicenseError) {
        return res.status(403).json({ error: error.message, code: error.code });
    }
    const msg = error instanceof Error ? error.message : fallback;
    return res.status(400).json({ error: msg });
}
/** Public ODS customer display — token in URL, no JWT */
router.get("/:token/board", async (req, res) => {
    try {
        const data = await ods_service_1.OdsService.boardForToken(req.params.token);
        res.json({ success: true, ...data });
    }
    catch (error) {
        if (error instanceof ods_service_1.OdsLicenseError) {
            return res.status(403).json({ error: error.message, code: error.code });
        }
        res.status(404).json({ error: error instanceof Error ? error.message : "ODS not found" });
    }
});
/** Merchant-authenticated ODS management */
const merchantRouter = (0, express_1.Router)();
exports.odsMerchantRoutes = merchantRouter;
merchantRouter.use(auth_middleware_1.verifyToken);
merchantRouter.use(auth_middleware_1.requireMerchantAccess);
merchantRouter.use(auth_middleware_1.setMerchantContext);
merchantRouter.get("/displays", async (req, res) => {
    try {
        const displays = await ods_service_1.OdsService.listDisplays(req.merchantId);
        res.json({ success: true, displays });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
merchantRouter.post("/displays", async (req, res) => {
    try {
        const display = await ods_service_1.OdsService.createDisplay(req.merchantId, req.body || {});
        res.status(201).json({ success: true, display });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
merchantRouter.put("/displays/:id", async (req, res) => {
    try {
        const display = await ods_service_1.OdsService.updateDisplay(req.merchantId, req.params.id, req.body || {});
        res.json({ success: true, display });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
merchantRouter.delete("/displays/:id", async (req, res) => {
    try {
        await ods_service_1.OdsService.deleteDisplay(req.merchantId, req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
merchantRouter.post("/displays/:id/rotate-token", async (req, res) => {
    try {
        const display = await ods_service_1.OdsService.rotateToken(req.merchantId, req.params.id);
        res.json({ success: true, display });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
merchantRouter.post("/push", async (req, res) => {
    try {
        const result = await ods_service_1.OdsService.pushOrder(req.merchantId, req.body || {});
        res.json({ success: true, ...result });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
merchantRouter.post("/dismiss", async (req, res) => {
    try {
        const orderNumber = String(req.body?.orderNumber || "").trim();
        const result = await ods_service_1.OdsService.dismissOrder(req.merchantId, orderNumber);
        res.json({ success: true, ...result });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
merchantRouter.post("/clear-all", async (req, res) => {
    try {
        const result = await ods_service_1.OdsService.clearAllOrders(req.merchantId);
        res.json({ success: true, ...result });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
exports.default = router;
//# sourceMappingURL=ods.routes.js.map