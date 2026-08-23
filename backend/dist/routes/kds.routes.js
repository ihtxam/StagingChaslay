"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kdsMerchantRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const kds_service_1 = require("@/services/kds.service");
const router = (0, express_1.Router)();
function handleError(res, error, fallback, status = 400) {
    if (error instanceof kds_service_1.KdsLicenseError) {
        return res.status(403).json({ error: error.message, code: error.code });
    }
    return res.status(status).json({ error: error instanceof Error ? error.message : fallback });
}
/** Public KDS display — token in URL, no JWT */
router.get("/:token/orders", async (req, res) => {
    try {
        const since = req.query.since ? String(req.query.since) : undefined;
        const data = await kds_service_1.KdsService.listForToken(req.params.token, since);
        res.json({ success: true, ...data });
    }
    catch (error) {
        if (error instanceof kds_service_1.KdsLicenseError) {
            return res.status(403).json({ error: error.message, code: error.code });
        }
        res.status(404).json({ error: error instanceof Error ? error.message : "KDS not found" });
    }
});
router.patch("/:token/items/:itemId/ready", async (req, res) => {
    try {
        const data = await kds_service_1.KdsService.markItemReady(req.params.token, req.params.itemId);
        res.json({ success: true, ...data });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
router.patch("/:token/tickets/:ticketId/complete", async (req, res) => {
    try {
        const data = await kds_service_1.KdsService.completeTicket(req.params.token, req.params.ticketId);
        res.json({ success: true, ...data });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
router.patch("/:token/items/:itemId/recall", async (req, res) => {
    try {
        const data = await kds_service_1.KdsService.recallItem(req.params.token, req.params.itemId);
        res.json({ success: true, ...data });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
router.patch("/:token/tickets/:ticketId/recall", async (req, res) => {
    try {
        const data = await kds_service_1.KdsService.recallTicket(req.params.token, req.params.ticketId);
        res.json({ success: true, ...data });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/** Merchant-authenticated KDS station management */
const merchantRouter = (0, express_1.Router)();
exports.kdsMerchantRoutes = merchantRouter;
merchantRouter.use(auth_middleware_1.verifyToken);
merchantRouter.use(auth_middleware_1.requireMerchantAccess);
merchantRouter.use(auth_middleware_1.setMerchantContext);
merchantRouter.get("/stations", async (req, res) => {
    try {
        const stations = await kds_service_1.KdsService.listStations(req.merchantId);
        res.json({ success: true, stations });
    }
    catch (error) {
        handleError(res, error, "Failed", 500);
    }
});
merchantRouter.post("/stations", async (req, res) => {
    try {
        const station = await kds_service_1.KdsService.createStation(req.merchantId, req.body || {});
        res.status(201).json({ success: true, station });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
merchantRouter.put("/stations/:id", async (req, res) => {
    try {
        const station = await kds_service_1.KdsService.updateStation(req.merchantId, req.params.id, req.body || {});
        res.json({ success: true, station });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
merchantRouter.delete("/stations/:id", async (req, res) => {
    try {
        await kds_service_1.KdsService.deleteStation(req.merchantId, req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
merchantRouter.post("/stations/:id/rotate-token", async (req, res) => {
    try {
        const station = await kds_service_1.KdsService.rotateToken(req.merchantId, req.params.id);
        res.json({ success: true, station });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
merchantRouter.post("/push", async (req, res) => {
    try {
        const result = await kds_service_1.KdsService.pushKitchen(req.merchantId, req.body || {});
        res.json({ success: true, ...result });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
merchantRouter.get("/ticket-status", async (req, res) => {
    try {
        const ticketKey = String(req.query.ticketKey || "").trim();
        if (!ticketKey)
            return res.status(400).json({ error: "ticketKey required" });
        const status = await kds_service_1.KdsService.ticketStatusForPos(req.merchantId, ticketKey);
        res.json({ success: true, ...status });
    }
    catch (error) {
        handleError(res, error, "Failed");
    }
});
exports.default = router;
//# sourceMappingURL=kds.routes.js.map