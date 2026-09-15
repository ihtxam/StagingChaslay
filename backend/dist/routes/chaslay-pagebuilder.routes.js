"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const chaslay_pagebuilder_service_1 = require("@/services/chaslay-pagebuilder.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
router.use((0, auth_middleware_1.requirePermission)("MANAGE_ONLINE_SHOP"));
router.get("/", async (req, res) => {
    try {
        const data = await chaslay_pagebuilder_service_1.ChaslayPagebuilderService.list(req.merchantId);
        res.json({ success: true, data });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to list" });
    }
});
router.get("/active", async (req, res) => {
    try {
        const data = await chaslay_pagebuilder_service_1.ChaslayPagebuilderService.getActive(req.merchantId);
        res.json({ success: true, data });
    }
    catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Failed to load active" });
    }
});
router.get("/:id", async (req, res) => {
    try {
        const data = await chaslay_pagebuilder_service_1.ChaslayPagebuilderService.get(req.merchantId, Number(req.params.id));
        res.json({ success: true, data });
    }
    catch (error) {
        res.status(404).json({ success: false, error: error instanceof Error ? error.message : "Not found" });
    }
});
router.post("/", async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        if (!name)
            return res.status(400).json({ success: false, error: "Name is required" });
        const data = await chaslay_pagebuilder_service_1.ChaslayPagebuilderService.create(req.merchantId, {
            name,
            editor_state: req.body.editor_state ?? null,
        });
        res.status(201).json({ success: true, data });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to create" });
    }
});
router.put("/:id", async (req, res) => {
    try {
        const data = await chaslay_pagebuilder_service_1.ChaslayPagebuilderService.update(req.merchantId, Number(req.params.id), {
            name: req.body.name,
            editor_state: req.body.editor_state,
        });
        res.json({ success: true, data });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to update" });
    }
});
router.delete("/:id", async (req, res) => {
    try {
        await chaslay_pagebuilder_service_1.ChaslayPagebuilderService.remove(req.merchantId, Number(req.params.id));
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to delete" });
    }
});
router.post("/:id/activate", async (req, res) => {
    try {
        const data = await chaslay_pagebuilder_service_1.ChaslayPagebuilderService.activate(req.merchantId, Number(req.params.id));
        res.json({ success: true, data });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to activate" });
    }
});
router.post("/:id/deactivate", async (req, res) => {
    try {
        const data = await chaslay_pagebuilder_service_1.ChaslayPagebuilderService.deactivate(req.merchantId, Number(req.params.id));
        res.json({ success: true, data });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to deactivate" });
    }
});
router.get("/:builderId/pages", async (req, res) => {
    try {
        const data = await chaslay_pagebuilder_service_1.ChaslayPagebuilderService.listPages(req.merchantId, Number(req.params.builderId));
        res.json({ success: true, data });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to list pages" });
    }
});
router.post("/:builderId/pages", async (req, res) => {
    try {
        const data = await chaslay_pagebuilder_service_1.ChaslayPagebuilderService.createPage(req.merchantId, Number(req.params.builderId), {
            title: req.body.title,
            slug: req.body.slug,
            editor_state: req.body.editor_state ?? null,
            is_homepage: req.body.is_homepage,
            sort_order: req.body.sort_order,
        });
        res.status(201).json({ success: true, data });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to create page" });
    }
});
router.put("/:builderId/pages/:pageId", async (req, res) => {
    try {
        const data = await chaslay_pagebuilder_service_1.ChaslayPagebuilderService.updatePage(req.merchantId, Number(req.params.builderId), Number(req.params.pageId), {
            title: req.body.title,
            slug: req.body.slug,
            editor_state: req.body.editor_state,
            is_homepage: req.body.is_homepage,
            sort_order: req.body.sort_order,
        });
        res.json({ success: true, data });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to update page" });
    }
});
router.delete("/:builderId/pages/:pageId", async (req, res) => {
    try {
        await chaslay_pagebuilder_service_1.ChaslayPagebuilderService.removePage(req.merchantId, Number(req.params.builderId), Number(req.params.pageId));
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Failed to delete page" });
    }
});
exports.default = router;
//# sourceMappingURL=chaslay-pagebuilder.routes.js.map