"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const edition_middleware_1 = require("@/middleware/edition.middleware");
const loyalty_service_1 = require("@/services/loyalty.service");
const shop_loyalty_service_1 = require("@/services/shop-loyalty.service");
const router = (0, express_1.Router)();
// Apply merchant middleware
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
router.use((0, edition_middleware_1.requireEditionFeature)("loyalty", "gift_cards"));
/**
 * GET /api/loyalty/program
 * Online shop fidelity program settings
 */
router.get("/program", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const program = await shop_loyalty_service_1.ShopLoyaltyService.getProgram(merchantId);
        res.json({
            success: true,
            program,
            formula: {
                earn: `floor(paidFoodSubtotal × ${program.earnPointsPerChf}) pts — tip/delivery excluded`,
                redeem: `${program.redeemPointsPerChf} pts = CHF 1.00 cash discount`,
                freeProduct: "product.loyaltyRewardPoints = N → unlock when balance ≥ N",
                expiry: `${program.expiryDays} days FIFO lots`,
            },
        });
    }
    catch (error) {
        console.error("Error getting loyalty program:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get program" });
    }
});
/**
 * PUT /api/loyalty/program
 * Update online shop fidelity program settings
 */
router.put("/program", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const { enabled, earnPointsPerChf, redeemPointsPerChf, expiryDays } = req.body || {};
        const program = await shop_loyalty_service_1.ShopLoyaltyService.updateProgram(merchantId, {
            enabled,
            earnPointsPerChf,
            redeemPointsPerChf,
            expiryDays,
        });
        res.json({
            success: true,
            message: "Fidelity program updated",
            program,
        });
    }
    catch (error) {
        console.error("Error updating loyalty program:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update program" });
    }
});
/**
 * POST /api/loyalty/cards
 * Create loyalty card
 */
router.post("/cards", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { cardType, customerId, initialBalance, cardNumber, rfidCode } = req.body;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        if (!cardType) {
            return res.status(400).json({ error: "Card type is required" });
        }
        const card = await loyalty_service_1.LoyaltyService.createLoyaltyCard(merchantId, cardType, customerId, initialBalance, cardNumber || rfidCode);
        res.status(201).json({
            success: true,
            message: "Loyalty card created successfully",
            card,
        });
    }
    catch (error) {
        console.error("Error creating loyalty card:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create card" });
    }
});
/**
 * GET /api/loyalty/cards
 * Get all loyalty cards
 */
router.get("/cards", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const cardType = req.query.cardType;
        const status = req.query.status;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const cards = await loyalty_service_1.LoyaltyService.getLoyaltyCards(merchantId, page, limit, cardType, status);
        res.json({
            success: true,
            cards,
            pagination: { page, limit },
        });
    }
    catch (error) {
        console.error("Error getting loyalty cards:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get cards" });
    }
});
/**
 * GET /api/loyalty/cards/rfid/:rfidCode
 * Get card by RFID code
 */
router.get("/cards/rfid/:rfidCode", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { rfidCode } = req.params;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const card = await loyalty_service_1.LoyaltyService.getCardByRFID(merchantId, rfidCode);
        res.json({
            success: true,
            card,
        });
    }
    catch (error) {
        console.error("Error getting card by RFID:", error);
        res.status(404).json({ error: error instanceof Error ? error.message : "Card not found" });
    }
});
/**
 * GET /api/loyalty/cards/number/:cardNumber
 * Get card by card number
 */
router.get("/cards/number/:cardNumber", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { cardNumber } = req.params;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const card = await loyalty_service_1.LoyaltyService.getCardByNumber(merchantId, cardNumber);
        res.json({
            success: true,
            card,
        });
    }
    catch (error) {
        console.error("Error getting card by number:", error);
        res.status(404).json({ error: error instanceof Error ? error.message : "Card not found" });
    }
});
/**
 * POST /api/loyalty/cards/:cardId/add-balance
 * Add balance to card
 */
router.post("/cards/:cardId/add-balance", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { cardId } = req.params;
        const { amount } = req.body;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: "Valid amount is required" });
        }
        const card = await loyalty_service_1.LoyaltyService.addBalance(merchantId, cardId, amount);
        res.json({
            success: true,
            message: `Added ${amount} to card balance`,
            card,
        });
    }
    catch (error) {
        console.error("Error adding balance:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to add balance" });
    }
});
/**
 * POST /api/loyalty/cards/:cardId/redeem
 * Redeem balance from card
 */
router.post("/cards/:cardId/redeem", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { cardId } = req.params;
        const { amount, orderId } = req.body;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        if (!amount || amount <= 0) {
            return res.status(400).json({ error: "Valid amount is required" });
        }
        const card = await loyalty_service_1.LoyaltyService.redeemBalance(merchantId, cardId, amount, orderId);
        res.json({
            success: true,
            message: `Redeemed ${amount} from card`,
            card,
        });
    }
    catch (error) {
        console.error("Error redeeming balance:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to redeem balance" });
    }
});
/**
 * POST /api/loyalty/cards/:cardId/add-points
 * Add loyalty points to card
 */
router.post("/cards/:cardId/add-points", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { cardId } = req.params;
        const { points } = req.body;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        if (!points || points <= 0) {
            return res.status(400).json({ error: "Valid points value is required" });
        }
        const card = await loyalty_service_1.LoyaltyService.addPoints(merchantId, cardId, points);
        res.json({
            success: true,
            message: `Added ${points} loyalty points`,
            card,
        });
    }
    catch (error) {
        console.error("Error adding points:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to add points" });
    }
});
/**
 * POST /api/loyalty/cards/:cardId/redeem-points
 * Redeem loyalty points from card
 */
router.post("/cards/:cardId/redeem-points", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { cardId } = req.params;
        const { points, orderId } = req.body;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        if (!points || points <= 0) {
            return res.status(400).json({ error: "Valid points value is required" });
        }
        const card = await loyalty_service_1.LoyaltyService.redeemPoints(merchantId, cardId, points, orderId);
        res.json({
            success: true,
            message: `Redeemed ${points} loyalty points`,
            card,
        });
    }
    catch (error) {
        console.error("Error redeeming points:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to redeem points" });
    }
});
/**
 * GET /api/loyalty/cards/:cardId/transactions
 * Get card transaction history
 */
router.get("/cards/:cardId/transactions", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { cardId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const transactions = await loyalty_service_1.LoyaltyService.getCardTransactions(merchantId, cardId, page, limit);
        res.json({
            success: true,
            transactions,
            pagination: { page, limit },
        });
    }
    catch (error) {
        console.error("Error getting transactions:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get transactions" });
    }
});
/**
 * POST /api/loyalty/cards/:cardId/suspend
 * Suspend loyalty card
 */
router.post("/cards/:cardId/suspend", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { cardId } = req.params;
        const { reason } = req.body;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const card = await loyalty_service_1.LoyaltyService.suspendCard(merchantId, cardId, reason);
        res.json({
            success: true,
            message: "Card suspended successfully",
            card,
        });
    }
    catch (error) {
        console.error("Error suspending card:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to suspend card" });
    }
});
/**
 * POST /api/loyalty/cards/:cardId/reactivate
 * Reactivate loyalty card
 */
router.post("/cards/:cardId/reactivate", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { cardId } = req.params;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const card = await loyalty_service_1.LoyaltyService.reactivateCard(merchantId, cardId);
        res.json({
            success: true,
            message: "Card reactivated successfully",
            card,
        });
    }
    catch (error) {
        console.error("Error reactivating card:", error);
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to reactivate card" });
    }
});
/**
 * GET /api/loyalty/statistics
 * Get loyalty program statistics
 */
router.get("/statistics", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const stats = await loyalty_service_1.LoyaltyService.getLoyaltyStatistics(merchantId);
        res.json({
            success: true,
            statistics: stats,
        });
    }
    catch (error) {
        console.error("Error getting statistics:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get statistics" });
    }
});
/**
 * GET /api/loyalty/expiring-gift-cards
 * Get expiring gift cards
 */
router.get("/expiring-gift-cards", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const daysThreshold = parseInt(req.query.days) || 30;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const cards = await loyalty_service_1.LoyaltyService.getExpiringGiftCards(merchantId, daysThreshold);
        res.json({
            success: true,
            cards,
            threshold: `${daysThreshold} days`,
        });
    }
    catch (error) {
        console.error("Error getting expiring gift cards:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get cards" });
    }
});
/**
 * GET /api/loyalty/analytics
 * Get loyalty program analytics
 */
router.get("/analytics", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
        if (!merchantId) {
            return res.status(400).json({ error: "Merchant ID is required" });
        }
        const analytics = await loyalty_service_1.LoyaltyService.getLoyaltyAnalytics(merchantId, startDate, endDate);
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
exports.default = router;
//# sourceMappingURL=loyalty.routes.js.map