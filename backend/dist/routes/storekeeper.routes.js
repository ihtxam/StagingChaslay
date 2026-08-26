"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const inventory_service_1 = require("@/services/inventory.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
router.use((0, auth_middleware_1.requirePermission)("STOREKEEPER_INTAKE", "MANAGE_INVENTORY"));
function handleError(res, error, fallback) {
    if (error instanceof inventory_service_1.InventoryLicenseError) {
        return res.status(403).json({ error: error.message, code: "INVENTORY_ADDON_REQUIRED" });
    }
    const message = error instanceof Error ? error.message : fallback;
    const status = /not found/i.test(message) ? 404 : 400;
    return res.status(status).json({ error: message });
}
/** GET /api/merchant/storekeeper/bootstrap — categories, units, license. */
router.get("/bootstrap", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const data = await inventory_service_1.InventoryService.getStorekeeperBootstrap(merchantId);
        res.json({ success: true, ...data });
    }
    catch (error) {
        handleError(res, error, "Failed to load storekeeper data");
    }
});
/** GET /api/merchant/storekeeper/lookup/:barcode */
router.get("/lookup/:barcode", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const item = await inventory_service_1.InventoryService.getItemByBarcode(merchantId, req.params.barcode);
        res.json({ success: true, item });
    }
    catch (error) {
        handleError(res, error, "Barcode lookup failed");
    }
});
/** POST /api/merchant/storekeeper/intake — scan/create item and receive stock. */
router.post("/intake", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const result = await inventory_service_1.InventoryService.storekeeperIntake(merchantId, req.body || {});
        res.json({ success: true, ...result });
    }
    catch (error) {
        handleError(res, error, "Stock intake failed");
    }
});
exports.default = router;
//# sourceMappingURL=storekeeper.routes.js.map