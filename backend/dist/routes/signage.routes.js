"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signageMerchantRoutes = void 0;
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const business_module_middleware_1 = require("@/middleware/business-module.middleware");
const signage_service_1 = require("@/services/signage.service");
const router = (0, express_1.Router)();
function sendError(res, error, fallback) {
    if (error instanceof signage_service_1.SignageLicenseError) {
        return res.status(403).json({ error: error.message, code: "SIGNAGE_ADDON_REQUIRED" });
    }
    const message = error instanceof Error ? error.message : fallback;
    const status = /not found|invalid screen/i.test(message) ? 404 : 400;
    return res.status(status).json({ error: message });
}
/** Public TV player — token in URL, no JWT */
router.get("/:token", async (req, res) => {
    try {
        const data = await signage_service_1.SignageService.playerForToken(req.params.token);
        res.json({ success: true, ...data });
    }
    catch (error) {
        sendError(res, error, "Screen not found");
    }
});
const merchantRouter = (0, express_1.Router)();
exports.signageMerchantRoutes = merchantRouter;
merchantRouter.use(auth_middleware_1.verifyToken);
merchantRouter.use(auth_middleware_1.requireMerchantAccess);
merchantRouter.use(auth_middleware_1.setMerchantContext);
merchantRouter.use(business_module_middleware_1.requireRestaurantModule);
merchantRouter.get("/overview", async (req, res) => {
    try {
        const overview = await signage_service_1.SignageService.overview(req.merchantId);
        res.json({ success: true, ...overview });
    }
    catch (error) {
        sendError(res, error, "Failed");
    }
});
merchantRouter.get("/screens", async (req, res) => {
    try {
        const overview = await signage_service_1.SignageService.overview(req.merchantId);
        const screens = overview.enabled ? await signage_service_1.SignageService.listScreens(req.merchantId) : [];
        res.json({ success: true, screens, ...overview });
    }
    catch (error) {
        sendError(res, error, "Failed");
    }
});
merchantRouter.post("/screens", async (req, res) => {
    try {
        const screen = await signage_service_1.SignageService.createScreen(req.merchantId, req.body || {});
        res.status(201).json({ success: true, screen });
    }
    catch (error) {
        sendError(res, error, "Failed");
    }
});
merchantRouter.put("/screens/:id", async (req, res) => {
    try {
        const screen = await signage_service_1.SignageService.updateScreen(req.merchantId, req.params.id, req.body || {});
        res.json({ success: true, screen });
    }
    catch (error) {
        sendError(res, error, "Failed");
    }
});
merchantRouter.delete("/screens/:id", async (req, res) => {
    try {
        await signage_service_1.SignageService.deleteScreen(req.merchantId, req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        sendError(res, error, "Failed");
    }
});
merchantRouter.post("/screens/:id/rotate-token", async (req, res) => {
    try {
        const screen = await signage_service_1.SignageService.rotateToken(req.merchantId, req.params.id);
        res.json({ success: true, screen });
    }
    catch (error) {
        sendError(res, error, "Failed");
    }
});
merchantRouter.get("/playlists", async (req, res) => {
    try {
        const playlists = await signage_service_1.SignageService.listPlaylists(req.merchantId);
        res.json({ success: true, playlists });
    }
    catch (error) {
        sendError(res, error, "Failed");
    }
});
merchantRouter.post("/playlists", async (req, res) => {
    try {
        const playlist = await signage_service_1.SignageService.createPlaylist(req.merchantId, req.body || {});
        res.status(201).json({ success: true, playlist });
    }
    catch (error) {
        sendError(res, error, "Failed");
    }
});
merchantRouter.put("/playlists/:id", async (req, res) => {
    try {
        const playlist = await signage_service_1.SignageService.updatePlaylist(req.merchantId, req.params.id, req.body || {});
        res.json({ success: true, playlist });
    }
    catch (error) {
        sendError(res, error, "Failed");
    }
});
merchantRouter.delete("/playlists/:id", async (req, res) => {
    try {
        await signage_service_1.SignageService.deletePlaylist(req.merchantId, req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        sendError(res, error, "Failed");
    }
});
merchantRouter.post("/playlists/:id/slides", async (req, res) => {
    try {
        const slide = await signage_service_1.SignageService.createSlide(req.merchantId, req.params.id, req.body || {});
        res.status(201).json({ success: true, slide });
    }
    catch (error) {
        sendError(res, error, "Failed");
    }
});
merchantRouter.put("/slides/:id", async (req, res) => {
    try {
        const slide = await signage_service_1.SignageService.updateSlide(req.merchantId, req.params.id, req.body || {});
        res.json({ success: true, slide });
    }
    catch (error) {
        sendError(res, error, "Failed");
    }
});
merchantRouter.delete("/slides/:id", async (req, res) => {
    try {
        await signage_service_1.SignageService.deleteSlide(req.merchantId, req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        sendError(res, error, "Failed");
    }
});
merchantRouter.get("/catalog", async (req, res) => {
    try {
        const data = await signage_service_1.SignageService.listCatalog(req.merchantId);
        res.json({ success: true, ...data });
    }
    catch (error) {
        sendError(res, error, "Failed");
    }
});
exports.default = router;
//# sourceMappingURL=signage.routes.js.map