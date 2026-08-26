"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const inventory_service_1 = require("@/services/inventory.service");
const demo_inventory_service_1 = require("@/services/demo-inventory.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
router.use((0, auth_middleware_1.requirePermission)("MANAGE_INVENTORY"));
function handleError(res, error, fallback) {
    if (error instanceof inventory_service_1.InventoryLicenseError) {
        return res.status(403).json({ error: error.message, code: "INVENTORY_ADDON_REQUIRED" });
    }
    const message = error instanceof Error ? error.message : fallback;
    const status = /not found/i.test(message) ? 404 : 400;
    return res.status(status).json({ error: message });
}
/** GET /api/merchant/inventory/status — works even when addon is locked (upsell). */
router.get("/status", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const license = await inventory_service_1.InventoryService.getLicense(merchantId);
        let hasDemoData = false;
        try {
            hasDemoData = await demo_inventory_service_1.DemoInventoryService.hasDemoData(merchantId);
        }
        catch {
            /* column may not exist yet on old DBs */
        }
        res.json({ success: true, ...license, hasDemoData });
    }
    catch (error) {
        handleError(res, error, "Failed to load inventory status");
    }
});
/**
 * POST /api/merchant/inventory/import-demo
 * Seed sample ingredients, units, recipes and stock movements (testing only).
 * Idempotent: re-import replaces demo rows only.
 */
router.post("/import-demo", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const result = await demo_inventory_service_1.DemoInventoryService.importDemo(merchantId);
        res.json(result);
    }
    catch (error) {
        console.error("Inventory demo import failed:", error);
        handleError(res, error, "Demo inventory import failed");
    }
});
/**
 * DELETE /api/merchant/inventory/demo-data
 * Remove all demo-flagged inventory rows for this merchant.
 */
router.delete("/demo-data", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const result = await demo_inventory_service_1.DemoInventoryService.deleteDemo(merchantId);
        res.json(result);
    }
    catch (error) {
        console.error("Inventory demo delete failed:", error);
        handleError(res, error, "Failed to delete demo inventory");
    }
});
/** GET /api/merchant/inventory/dashboard — KPIs, scenarios and charts for inventory home. */
router.get("/dashboard", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const dashboard = await demo_inventory_service_1.DemoInventoryService.getDashboard(merchantId);
        res.json({ success: true, dashboard });
    }
    catch (error) {
        handleError(res, error, "Failed to load inventory dashboard");
    }
});
router.put("/settings", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const license = await inventory_service_1.InventoryService.updateSettings(merchantId, {
            wasteFactor: req.body?.wasteFactor != null ? Number(req.body.wasteFactor) : undefined,
            autoReorderEmailEnabled: req.body?.autoReorderEmailEnabled != null ? !!req.body.autoReorderEmailEnabled : undefined,
            expiryAlertDays: req.body?.expiryAlertDays != null ? Number(req.body.expiryAlertDays) : undefined,
        });
        res.json({ success: true, ...license });
    }
    catch (error) {
        handleError(res, error, "Failed to save inventory settings");
    }
});
router.get("/items", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const items = await inventory_service_1.InventoryService.listItems(merchantId);
        res.json({ success: true, items });
    }
    catch (error) {
        handleError(res, error, "Failed to list items");
    }
});
router.post("/items", async (req, res) => {
    try {
        const item = await inventory_service_1.InventoryService.createItem(req.merchantId, req.body || {});
        res.status(201).json({ success: true, item });
    }
    catch (error) {
        handleError(res, error, "Failed to create item");
    }
});
router.put("/items/:itemId", async (req, res) => {
    try {
        const item = await inventory_service_1.InventoryService.updateItem(req.merchantId, req.params.itemId, req.body || {});
        res.json({ success: true, item });
    }
    catch (error) {
        handleError(res, error, "Failed to update item");
    }
});
router.delete("/items/:itemId", async (req, res) => {
    try {
        await inventory_service_1.InventoryService.deleteItem(req.merchantId, req.params.itemId);
        res.json({ success: true });
    }
    catch (error) {
        handleError(res, error, "Failed to delete item");
    }
});
router.post("/items/:itemId/stock-in", async (req, res) => {
    try {
        const item = await inventory_service_1.InventoryService.stockIn(req.merchantId, req.params.itemId, req.body || {});
        res.json({ success: true, item });
    }
    catch (error) {
        handleError(res, error, "Failed to record stock in");
    }
});
router.post("/items/:itemId/waste", async (req, res) => {
    try {
        const item = await inventory_service_1.InventoryService.waste(req.merchantId, req.params.itemId, req.body || {});
        res.json({ success: true, item });
    }
    catch (error) {
        handleError(res, error, "Failed to record waste");
    }
});
router.get("/items/:itemId/movements", async (req, res) => {
    try {
        const movements = await inventory_service_1.InventoryService.listMovements(req.merchantId, req.params.itemId);
        res.json({ success: true, movements });
    }
    catch (error) {
        handleError(res, error, "Failed to list movements");
    }
});
router.post("/items/:itemId/reorder-email", async (req, res) => {
    try {
        const result = await inventory_service_1.InventoryService.sendReorderEmail(req.merchantId, {
            itemIds: [req.params.itemId],
            force: true,
        });
        res.json({ success: true, ...result });
    }
    catch (error) {
        handleError(res, error, "Failed to email supplier");
    }
});
router.get("/low-stock", async (req, res) => {
    try {
        const items = await inventory_service_1.InventoryService.lowStock(req.merchantId);
        res.json({ success: true, items });
    }
    catch (error) {
        handleError(res, error, "Failed to load low stock");
    }
});
router.get("/expiring-soon", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const data = await inventory_service_1.InventoryService.listExpiringSoon(merchantId);
        res.json({ success: true, ...data });
    }
    catch (error) {
        handleError(res, error, "Failed to load expiring stock");
    }
});
router.get("/usage", async (req, res) => {
    try {
        const days = Number(req.query.days) || 30;
        const rows = await inventory_service_1.InventoryService.usageReport(req.merchantId, days);
        res.json({ success: true, rows });
    }
    catch (error) {
        handleError(res, error, "Failed to load usage");
    }
});
router.get("/suppliers", async (req, res) => {
    try {
        const suppliers = await inventory_service_1.InventoryService.listSuppliers(req.merchantId, {
            includeArchived: req.query.archived === "1",
        });
        res.json({ success: true, suppliers });
    }
    catch (error) {
        handleError(res, error, "Failed to list suppliers");
    }
});
router.post("/suppliers", async (req, res) => {
    try {
        const supplier = await inventory_service_1.InventoryService.createSupplier(req.merchantId, req.body || {});
        res.status(201).json({ success: true, supplier });
    }
    catch (error) {
        handleError(res, error, "Failed to create supplier");
    }
});
router.get("/suppliers/:supplierId", async (req, res) => {
    try {
        const data = await inventory_service_1.InventoryService.getSupplier(req.merchantId, req.params.supplierId);
        res.json({ success: true, ...data });
    }
    catch (error) {
        handleError(res, error, "Failed to load supplier");
    }
});
router.put("/suppliers/:supplierId", async (req, res) => {
    try {
        const supplier = await inventory_service_1.InventoryService.updateSupplier(req.merchantId, req.params.supplierId, req.body || {});
        res.json({ success: true, supplier });
    }
    catch (error) {
        handleError(res, error, "Failed to update supplier");
    }
});
router.delete("/suppliers/:supplierId", async (req, res) => {
    try {
        const result = await inventory_service_1.InventoryService.deleteSupplier(req.merchantId, req.params.supplierId);
        res.json({ success: true, ...result });
    }
    catch (error) {
        handleError(res, error, "Failed to delete supplier");
    }
});
router.post("/suppliers/:supplierId/reorder-email", async (req, res) => {
    try {
        const result = await inventory_service_1.InventoryService.sendReorderEmail(req.merchantId, {
            supplierId: req.params.supplierId,
            itemIds: Array.isArray(req.body?.itemIds) ? req.body.itemIds : undefined,
            force: true,
        });
        res.json({ success: true, ...result });
    }
    catch (error) {
        handleError(res, error, "Failed to email supplier");
    }
});
router.get("/movements", async (req, res) => {
    try {
        const movements = await inventory_service_1.InventoryService.listMovements(req.merchantId, typeof req.query.itemId === "string" ? req.query.itemId : undefined, Number(req.query.limit) || 200);
        res.json({ success: true, movements });
    }
    catch (error) {
        handleError(res, error, "Failed to list movements");
    }
});
router.post("/items/:itemId/stock-out", async (req, res) => {
    try {
        const item = await inventory_service_1.InventoryService.stockOut(req.merchantId, req.params.itemId, {
            qty: Number(req.body?.qty),
            note: req.body?.note,
            reason: req.body?.reason === "out" ? "out" : "waste",
        });
        res.json({ success: true, item });
    }
    catch (error) {
        handleError(res, error, "Failed to record outbound");
    }
});
router.post("/items/:itemId/count", async (req, res) => {
    try {
        const item = await inventory_service_1.InventoryService.countStock(req.merchantId, req.params.itemId, {
            realQty: Number(req.body?.realQty),
            note: req.body?.note,
        });
        res.json({ success: true, item });
    }
    catch (error) {
        handleError(res, error, "Failed to count stock");
    }
});
router.get("/categories", async (req, res) => {
    try {
        const categories = await inventory_service_1.InventoryService.listCategories(req.merchantId);
        res.json({ success: true, categories });
    }
    catch (error) {
        handleError(res, error, "Failed to list categories");
    }
});
router.post("/categories", async (req, res) => {
    try {
        const category = await inventory_service_1.InventoryService.createCategory(req.merchantId, req.body?.name);
        res.status(201).json({ success: true, category });
    }
    catch (error) {
        handleError(res, error, "Failed to create category");
    }
});
router.delete("/categories/:categoryId", async (req, res) => {
    try {
        await inventory_service_1.InventoryService.deleteCategory(req.merchantId, req.params.categoryId);
        res.json({ success: true });
    }
    catch (error) {
        handleError(res, error, "Failed to delete category");
    }
});
router.get("/units", async (req, res) => {
    try {
        const data = await inventory_service_1.InventoryService.listUnits(req.merchantId);
        res.json({ success: true, ...data });
    }
    catch (error) {
        handleError(res, error, "Failed to list units");
    }
});
router.post("/units", async (req, res) => {
    try {
        const unit = await inventory_service_1.InventoryService.createUnit(req.merchantId, req.body || {});
        res.status(201).json({ success: true, unit });
    }
    catch (error) {
        handleError(res, error, "Failed to create unit");
    }
});
router.delete("/units/:unitId", async (req, res) => {
    try {
        await inventory_service_1.InventoryService.deleteUnit(req.merchantId, req.params.unitId);
        res.json({ success: true });
    }
    catch (error) {
        handleError(res, error, "Failed to delete unit");
    }
});
router.post("/unit-ratios", async (req, res) => {
    try {
        const ratio = await inventory_service_1.InventoryService.createRatio(req.merchantId, req.body || {});
        res.status(201).json({ success: true, ratio });
    }
    catch (error) {
        handleError(res, error, "Failed to create unit ratio");
    }
});
router.delete("/unit-ratios/:ratioId", async (req, res) => {
    try {
        await inventory_service_1.InventoryService.deleteRatio(req.merchantId, req.params.ratioId);
        res.json({ success: true });
    }
    catch (error) {
        handleError(res, error, "Failed to delete unit ratio");
    }
});
router.get("/purchase-report", async (req, res) => {
    try {
        const report = await inventory_service_1.InventoryService.purchaseReport(req.merchantId, Number(req.query.days) || 30);
        res.json({ success: true, report });
    }
    catch (error) {
        handleError(res, error, "Failed to load purchase report");
    }
});
router.get("/cookbook", async (req, res) => {
    try {
        const entries = await inventory_service_1.InventoryService.listCookbook(req.merchantId);
        res.json({ success: true, entries });
    }
    catch (error) {
        handleError(res, error, "Failed to load cookbook");
    }
});
router.get("/products/:productId/recipe", async (req, res) => {
    try {
        const recipe = await inventory_service_1.InventoryService.getRecipe(req.merchantId, req.params.productId);
        res.json({ success: true, recipe });
    }
    catch (error) {
        handleError(res, error, "Failed to load recipe");
    }
});
router.put("/products/:productId/recipe", async (req, res) => {
    try {
        const recipe = await inventory_service_1.InventoryService.setRecipe(req.merchantId, req.params.productId, req.body?.lines || [], req.body?.recipeYield != null ? Number(req.body.recipeYield) : undefined);
        res.json({ success: true, recipe });
    }
    catch (error) {
        handleError(res, error, "Failed to save recipe");
    }
});
exports.default = router;
//# sourceMappingURL=inventory.routes.js.map