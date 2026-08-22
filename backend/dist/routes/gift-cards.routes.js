"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const edition_middleware_1 = require("@/middleware/edition.middleware");
const gift_card_service_1 = require("@/services/gift-card.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
router.use((0, edition_middleware_1.requireEditionFeature)("gift_cards", "pos_gift_cards"));
/**
 * GET /api/gift-cards/settings
 */
router.get("/settings", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const settings = await gift_card_service_1.GiftCardService.getSettings(merchantId);
        res.json({ success: true, settings });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to get settings",
        });
    }
});
/**
 * PUT /api/gift-cards/settings
 */
router.put("/settings", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const body = req.body || {};
        const settings = await gift_card_service_1.GiftCardService.updateSettings(merchantId, {
            enabled: body.enabled,
            presetDenominations: body.presetDenominations,
            minAmount: body.minAmount,
            maxAmount: body.maxAmount,
            reloadEnabled: body.reloadEnabled,
            customAmountEnabled: body.customAmountEnabled,
            onlinePurchaseEnabled: body.onlinePurchaseEnabled,
            membershipEnabled: body.membershipEnabled,
            membershipPlans: body.membershipPlans,
        });
        res.json({ success: true, message: "Gift card settings saved", settings });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to save settings",
        });
    }
});
/**
 * GET /api/gift-cards
 */
router.get("/", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const result = await gift_card_service_1.GiftCardService.listCards(merchantId, {
            page: parseInt(String(req.query.page || "1"), 10) || 1,
            limit: parseInt(String(req.query.limit || "50"), 10) || 50,
            status: req.query.status,
            q: req.query.q,
        });
        res.json({ success: true, ...result });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to list cards",
        });
    }
});
/**
 * POST /api/gift-cards
 * Create / issue a physical or e-card (e-card stub)
 */
router.post("/", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const card = await gift_card_service_1.GiftCardService.createCard(merchantId, {
            cardNumber: req.body.cardNumber || req.body.rfidCode,
            cardMediaType: req.body.cardMediaType,
            initialBalance: req.body.initialBalance,
            membershipEnabled: req.body.membershipEnabled,
            holderName: req.body.holderName || req.body.name,
            holderEmail: req.body.holderEmail || req.body.email,
            holderPhone: req.body.holderPhone || req.body.phone,
            ecardEmail: req.body.ecardEmail,
            customerId: req.body.customerId,
        });
        res.status(201).json({ success: true, card });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to create card",
        });
    }
});
/**
 * GET /api/gift-cards/lookup/:code
 */
router.get("/lookup/:code", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const mediaTypeRaw = req.query.mediaType;
        const mediaType = mediaTypeRaw === "e_card"
            ? "e_card"
            : mediaTypeRaw === "physical"
                ? "physical"
                : undefined;
        const card = await gift_card_service_1.GiftCardService.lookup(merchantId, req.params.code, mediaType);
        res.json({ success: true, card });
    }
    catch (error) {
        res.status(404).json({
            error: error instanceof Error ? error.message : "Card not found",
        });
    }
});
/**
 * POST /api/gift-cards/sell-membership
 * Register RFID membership card with customer + tier plan.
 */
router.post("/sell-membership", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const card = await gift_card_service_1.GiftCardService.sellMembership(merchantId, {
            cardNumber: req.body.cardNumber || req.body.rfidCode,
            planId: req.body.planId,
            name: req.body.name || req.body.holderName,
            email: req.body.email || req.body.holderEmail,
            phone: req.body.phone || req.body.holderPhone,
            orderId: req.body.orderId,
        });
        res.status(201).json({ success: true, card });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to sell membership",
        });
    }
});
/**
 * POST /api/gift-cards/:cardId/stamps/increment
 */
router.post("/:cardId/stamps/increment", async (req, res) => {
    try {
        const result = await gift_card_service_1.GiftCardService.incrementStamp(req.merchantId, req.params.cardId, req.body?.orderId, Math.max(1, Math.floor(Number(req.body?.increment) || 1)));
        res.json({ success: true, ...result });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to increment stamp",
        });
    }
});
/**
 * POST /api/gift-cards/credit
 * Sell or reload after POS payment success
 */
router.post("/credit", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const type = req.body.type === "reload" ? "reload" : "sell";
        const card = await gift_card_service_1.GiftCardService.credit(merchantId, {
            cardId: req.body.cardId,
            cardNumber: req.body.cardNumber || req.body.rfidCode,
            cardMediaType: req.body.cardMediaType,
            ecardEmail: req.body.ecardEmail || req.body.recipientEmail,
            holderName: req.body.holderName || req.body.name,
            amount: Number(req.body.amount),
            type,
            orderId: req.body.orderId,
            createIfMissing: req.body.createIfMissing !== false,
        });
        res.json({ success: true, card });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to credit card",
        });
    }
});
/**
 * POST /api/gift-cards/redeem
 * Pay with gift card (partial allowed by default for POS)
 */
router.post("/redeem", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const result = await gift_card_service_1.GiftCardService.redeem(merchantId, {
            cardId: req.body.cardId,
            cardNumber: req.body.cardNumber || req.body.rfidCode,
            ecardCode: req.body.ecardCode,
            amount: Number(req.body.amount),
            orderId: req.body.orderId,
            allowPartial: req.body.allowPartial !== false,
        });
        res.json({ success: true, ...result });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to redeem",
        });
    }
});
/**
 * POST /api/gift-cards/send-ecard-email
 * Email e-gift card receipt (code + balance) to recipient after sale.
 */
router.post("/send-ecard-email", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const result = await gift_card_service_1.GiftCardService.sendEcardReceiptEmail(merchantId, {
            to: req.body.to || req.body.email || req.body.ecardEmail,
            code: req.body.code || req.body.ecardCode || req.body.cardNumber,
            balance: Number(req.body.balance),
            holderName: req.body.holderName || req.body.name,
            orderId: req.body.orderId,
        });
        res.json({ success: true, ...result, message: "Gift card email sent" });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to send gift card email",
        });
    }
});
/**
 * GET /api/gift-cards/:cardId/spending
 * Purchase history linked to customer or gift card.
 */
router.get("/:cardId/spending", async (req, res) => {
    try {
        const result = await gift_card_service_1.GiftCardService.getMemberSpending(req.merchantId, req.params.cardId, {
            page: parseInt(String(req.query.page || "1"), 10) || 1,
            limit: parseInt(String(req.query.limit || "20"), 10) || 20,
        });
        res.json({ success: true, ...result });
    }
    catch (error) {
        res.status(404).json({
            error: error instanceof Error ? error.message : "Failed to get spending",
        });
    }
});
/**
 * PATCH /api/gift-cards/:cardId
 * Update holder / linked customer contact fields.
 */
router.patch("/:cardId", async (req, res) => {
    try {
        const card = await gift_card_service_1.GiftCardService.updateCard(req.merchantId, req.params.cardId, {
            holderName: req.body.holderName ?? req.body.name,
            holderEmail: req.body.holderEmail ?? req.body.email,
            holderPhone: req.body.holderPhone ?? req.body.phone,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            email: req.body.email,
            phone: req.body.phone,
        });
        res.json({ success: true, card, message: "Card updated" });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to update card",
        });
    }
});
/**
 * POST /api/gift-cards/:cardId/top-up
 * Manual admin top-up (balance or stamps) with audit log.
 */
router.post("/:cardId/top-up", async (req, res) => {
    try {
        const type = req.body.type === "stamps" ? "stamps" : "balance";
        const result = await gift_card_service_1.GiftCardService.adminTopUp(req.merchantId, req.params.cardId, {
            type,
            amount: req.body.amount != null ? Number(req.body.amount) : undefined,
            stamps: req.body.stamps != null ? Number(req.body.stamps) : undefined,
            note: req.body.note || req.body.reason,
        });
        res.json({ success: true, ...result, message: "Top-up applied" });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to top up",
        });
    }
});
/**
 * GET /api/gift-cards/:cardId
 */
router.get("/:cardId", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const card = await gift_card_service_1.GiftCardService.getById(merchantId, req.params.cardId);
        const settings = await gift_card_service_1.GiftCardService.getSettings(merchantId);
        const enriched = gift_card_service_1.GiftCardService.enrichCard(card, settings);
        res.json({ success: true, card: enriched });
    }
    catch (error) {
        res.status(404).json({
            error: error instanceof Error ? error.message : "Card not found",
        });
    }
});
/**
 * GET /api/gift-cards/:cardId/transactions
 */
router.get("/:cardId/transactions", async (req, res) => {
    try {
        const transactions = await gift_card_service_1.GiftCardService.getTransactions(req.merchantId, req.params.cardId, parseInt(String(req.query.page || "1"), 10) || 1, parseInt(String(req.query.limit || "30"), 10) || 30);
        res.json({ success: true, transactions });
    }
    catch (error) {
        res.status(404).json({
            error: error instanceof Error ? error.message : "Failed to get transactions",
        });
    }
});
/**
 * POST /api/gift-cards/:cardId/membership
 */
router.post("/:cardId/membership", async (req, res) => {
    try {
        const card = await gift_card_service_1.GiftCardService.attachMembership(req.merchantId, req.params.cardId, {
            name: req.body.name || req.body.holderName,
            email: req.body.email || req.body.holderEmail,
            phone: req.body.phone || req.body.holderPhone,
            customerId: req.body.customerId,
        });
        res.json({ success: true, card });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to attach membership",
        });
    }
});
/**
 * POST /api/gift-cards/:cardId/suspend
 */
router.post("/:cardId/suspend", async (req, res) => {
    try {
        const card = await gift_card_service_1.GiftCardService.suspend(req.merchantId, req.params.cardId, req.body.reason);
        res.json({ success: true, card });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to suspend card",
        });
    }
});
/**
 * POST /api/gift-cards/:cardId/reactivate
 */
router.post("/:cardId/reactivate", async (req, res) => {
    try {
        const card = await gift_card_service_1.GiftCardService.reactivate(req.merchantId, req.params.cardId);
        res.json({ success: true, card });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to reactivate card",
        });
    }
});
/**
 * POST /api/gift-cards/:cardId/points/earn
 */
router.post("/:cardId/points/earn", async (req, res) => {
    try {
        const points = Math.floor(Number(req.body?.points));
        const card = await gift_card_service_1.GiftCardService.addPoints(req.merchantId, req.params.cardId, points, req.body?.orderId);
        res.json({ success: true, card, message: `Added ${points} points` });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to earn points",
        });
    }
});
/**
 * POST /api/gift-cards/:cardId/points/redeem
 */
router.post("/:cardId/points/redeem", async (req, res) => {
    try {
        const points = Math.floor(Number(req.body?.points));
        const card = await gift_card_service_1.GiftCardService.redeemPoints(req.merchantId, req.params.cardId, points, req.body?.orderId);
        res.json({ success: true, card, message: `Redeemed ${points} points` });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to redeem points",
        });
    }
});
exports.default = router;
//# sourceMappingURL=gift-cards.routes.js.map