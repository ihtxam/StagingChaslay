"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const inventory_service_1 = require("@/services/inventory.service");
const storekeeper_addon_1 = require("@/lib/storekeeper-addon");
const barcode_product_lookup_service_1 = require("@/services/barcode-product-lookup.service");
const product_service_1 = require("@/services/product.service");
const barcode_service_1 = require("@/services/barcode.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
router.use((0, auth_middleware_1.requirePermission)("STOREKEEPER_INTAKE", "MANAGE_INVENTORY"));
function handleError(res, error, fallback) {
    if (error instanceof inventory_service_1.InventoryLicenseError) {
        return res.status(403).json({ error: error.message, code: "INVENTORY_ADDON_REQUIRED" });
    }
    if (error instanceof storekeeper_addon_1.StorekeeperLicenseError) {
        return res.status(403).json({ error: error.message, code: "STOREKEEPER_ADDON_REQUIRED" });
    }
    const message = error instanceof Error ? error.message : fallback;
    const status = /not found/i.test(message) ? 404 : 400;
    return res.status(status).json({ error: message });
}
/** POST /api/merchant/storekeeper/barcode/generate — allocate internal barcode for new item. */
router.post("/barcode/generate", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        await inventory_service_1.InventoryService.getStorekeeperBootstrap(merchantId);
        const barcode = await barcode_service_1.BarcodeService.allocateForStorekeeper(merchantId);
        res.json({ success: true, barcode });
    }
    catch (error) {
        handleError(res, error, "Failed to generate barcode");
    }
});
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
/** GET /api/merchant/storekeeper/lookup/:barcode — local stock, then online product DB. */
router.get("/lookup/:barcode", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const barcode = String(req.params.barcode || "").trim();
        const [item, menuProduct] = await Promise.all([
            inventory_service_1.InventoryService.getItemByBarcode(merchantId, barcode, { storekeeper: true }),
            product_service_1.ProductService.getProductByBarcode(merchantId, barcode),
        ]);
        const menuProductSummary = menuProduct
            ? {
                id: menuProduct.id,
                name: menuProduct.name,
                price: Number(menuProduct.price) || 0,
                imageUrl: menuProduct.imageUrl || null,
                stock: Number(menuProduct.stock) || 0,
            }
            : null;
        if (item) {
            return res.json({
                success: true,
                item,
                menuProduct: menuProductSummary,
                suggestion: null,
                source: "local",
            });
        }
        const bootstrap = await inventory_service_1.InventoryService.getStorekeeperBootstrap(merchantId);
        const suggestion = await barcode_product_lookup_service_1.BarcodeProductLookupService.lookupExternal(barcode);
        if (!suggestion) {
            return res.json({
                success: true,
                item: null,
                menuProduct: menuProductSummary,
                suggestion: null,
                source: menuProductSummary ? "menu" : null,
            });
        }
        const categoryId = (0, barcode_product_lookup_service_1.matchInventoryCategoryId)(bootstrap.categories, suggestion.categoryHint);
        res.json({
            success: true,
            item: null,
            menuProduct: menuProductSummary,
            suggestion: { ...suggestion, categoryId },
            source: suggestion.source,
        });
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