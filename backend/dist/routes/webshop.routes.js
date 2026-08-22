"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webshop_service_1 = require("@/services/webshop.service");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public routes (no auth required)
/**
 * GET /api/webshop/:merchantId/info
 * Get merchant shop info
 */
router.get("/:merchantId/info", async (req, res) => {
    try {
        const { merchantId } = req.params;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const info = await webshop_service_1.WebShopService.getShopInfo(merchantId);
        res.json({
            success: true,
            info,
        });
    }
    catch (error) {
        console.error("Error getting shop info:", error);
        res.status(404).json({ error: error instanceof Error ? error.message : "Shop not found" });
    }
});
/**
 * GET /api/webshop/:merchantId/products
 * Get public products
 */
router.get("/:merchantId/products", async (req, res) => {
    try {
        const { merchantId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const categoryId = req.query.categoryId;
        const search = req.query.search;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const products = await webshop_service_1.WebShopService.getPublicProducts(merchantId, page, limit, categoryId, search);
        res.json({
            success: true,
            products,
            pagination: { page, limit },
        });
    }
    catch (error) {
        console.error("Error getting products:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get products" });
    }
});
/**
 * GET /api/webshop/:merchantId/categories
 * Get public categories
 */
router.get("/:merchantId/categories", async (req, res) => {
    try {
        const { merchantId } = req.params;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const categories = await webshop_service_1.WebShopService.getPublicCategories(merchantId);
        res.json({
            success: true,
            categories,
        });
    }
    catch (error) {
        console.error("Error getting categories:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get categories" });
    }
});
/**
 * POST /api/webshop/:merchantId/orders
 * Create web shop order
 */
router.post("/:merchantId/orders", async (req, res) => {
    try {
        const { merchantId } = req.params;
        const { items, customerEmail, customerPhone, customerName, shippingAddress, notes, } = req.body;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        if (!items || items.length === 0) {
            return res.status(400).json({ error: "Order items are required" });
        }
        if (!customerEmail) {
            return res.status(400).json({ error: "Customer email is required" });
        }
        const order = await webshop_service_1.WebShopService.createWebShopOrder(merchantId, items, customerEmail, customerPhone, customerName, shippingAddress, notes);
        res.status(201).json({
            success: true,
            message: "Order created successfully",
            order,
        });
    }
    catch (error) {
        console.error("Error creating order:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create order" });
    }
});
// Protected routes (auth required)
/**
 * GET /api/webshop/merchant/orders
 * Get web shop orders (merchant only)
 */
router.get("/merchant/orders", auth_middleware_1.verifyToken, auth_middleware_1.requireMerchant, auth_middleware_1.setMerchantContext, async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const orders = await webshop_service_1.WebShopService.getWebShopOrders(merchantId, page, limit, status);
        res.json({
            success: true,
            orders,
            pagination: { page, limit },
        });
    }
    catch (error) {
        console.error("Error getting web shop orders:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get orders" });
    }
});
/**
 * PUT /api/webshop/merchant/orders/:orderId/shipping
 * Update shipping status (merchant only)
 */
router.put("/merchant/orders/:orderId/shipping", auth_middleware_1.verifyToken, auth_middleware_1.requireMerchant, auth_middleware_1.setMerchantContext, async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { orderId } = req.params;
        const { shippingStatus } = req.body;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        if (!shippingStatus) {
            return res.status(400).json({ error: "Shipping status is required" });
        }
        const order = await webshop_service_1.WebShopService.updateShippingStatus(merchantId, orderId, shippingStatus);
        res.json({
            success: true,
            message: "Shipping status updated",
            order,
        });
    }
    catch (error) {
        console.error("Error updating shipping status:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update status" });
    }
});
/**
 * GET /api/webshop/merchant/analytics
 * Get web shop analytics (merchant only)
 */
router.get("/merchant/analytics", auth_middleware_1.verifyToken, auth_middleware_1.requireMerchant, auth_middleware_1.setMerchantContext, async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const analytics = await webshop_service_1.WebShopService.getWebShopAnalytics(merchantId, startDate, endDate);
        res.json({
            success: true,
            analytics,
        });
    }
    catch (error) {
        console.error("Error getting analytics:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get analytics" });
    }
});
/**
 * POST /api/webshop/merchant/orders/:orderId/sync
 * Sync order to POS (merchant only)
 */
router.post("/merchant/orders/:orderId/sync", auth_middleware_1.verifyToken, auth_middleware_1.requireMerchant, auth_middleware_1.setMerchantContext, async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { orderId } = req.params;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const order = await webshop_service_1.WebShopService.syncOrderToPOS(merchantId, orderId);
        res.json({
            success: true,
            message: "Order synced to POS",
            order,
        });
    }
    catch (error) {
        console.error("Error syncing order:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to sync order" });
    }
});
exports.default = router;
//# sourceMappingURL=webshop.routes.js.map