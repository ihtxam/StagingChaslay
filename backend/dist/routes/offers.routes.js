"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const offers_service_1 = require("@/services/offers.service");
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken, auth_middleware_1.requireMerchant, auth_middleware_1.setMerchantContext);
router.get("/", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const offers = await offers_service_1.OffersService.list(merchantId);
        res.json({ success: true, offers });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list offers" });
    }
});
router.post("/", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!req.body?.name)
            return res.status(400).json({ error: "Name is required" });
        const offer = await offers_service_1.OffersService.create(merchantId, req.body);
        res.status(201).json({ success: true, offer });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create offer" });
    }
});
router.post("/ensure-category", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const category = await offers_service_1.OffersService.ensureOffersCategory(merchantId);
        res.json({ success: true, category });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
router.post("/seed-demos", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const db = (0, db_1.getDb)();
        const cats = await db.query.categories.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId),
        });
        const foodish = cats.filter((c) => !c.isOffersCategory).map((c) => c.id);
        const offers = await offers_service_1.OffersService.seedDemoOffers(merchantId, foodish);
        res.json({ success: true, offers });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to seed" });
    }
});
router.put("/:offerId", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const offer = await offers_service_1.OffersService.update(merchantId, req.params.offerId, req.body || {});
        res.json({ success: true, offer });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update" });
    }
});
router.delete("/:offerId", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        await offers_service_1.OffersService.remove(merchantId, req.params.offerId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete" });
    }
});
exports.default = router;
//# sourceMappingURL=offers.routes.js.map