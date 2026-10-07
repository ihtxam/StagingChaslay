"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const offers_service_1 = require("@/services/offers.service");
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const report_sales_scope_1 = require("@/lib/report-sales-scope");
const money_1 = require("@/lib/money");
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
/** POS top-bar: waiters / delivery / POS users — no MANAGE_OFFERS required. */
router.get("/pos", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const actor = (0, report_sales_scope_1.resolveReportActor)(req);
        const offers = await offers_service_1.OffersService.listForPos(merchantId, actor.staffId, new Date(), actor.kind === "owner");
        res.json({ success: true, offers });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list POS offers" });
    }
});
/** POS checkout: estimate promotional discount for the current cart. */
router.post("/preview", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const channel = String(req.body?.channel || "dine_in");
        const at = req.body?.scheduledFor ? new Date(req.body.scheduledFor) : new Date();
        const lines = Array.isArray(req.body?.items) ? req.body.items : [];
        const offers = await offers_service_1.OffersService.list(merchantId);
        const productIds = [
            ...new Set(lines
                .map((l) => String(l.productId || ""))
                .filter((id) => !!id)),
        ];
        const categoryByProduct = new Map();
        if (productIds.length) {
            const db = (0, db_1.getDb)();
            const products = await db.query.products.findMany({
                where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.products.merchantId, merchantId), (0, drizzle_orm_1.inArray)(db_1.schema.products.id, productIds)),
                columns: { id: true, categoryId: true },
            });
            for (const p of products)
                categoryByProduct.set(p.id, p.categoryId || null);
        }
        const result = offers_service_1.OffersService.evaluateCart(offers, lines.map((l) => {
            const productId = String(l.productId || "");
            return {
                productId,
                categoryId: l.categoryId || categoryByProduct.get(productId) || null,
                name: String(l.name || ""),
                unitPrice: Number(l.unitPrice ?? l.price ?? 0),
                quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
                loyaltyReward: !!l.loyaltyReward,
                offerId: l.offerId ? String(l.offerId) : null,
            };
        }), Number.isNaN(at.getTime()) ? new Date() : at, channel);
        res.json({
            success: true,
            discount: (0, money_1.roundMoney2)(result.discount),
            applied: result.applied,
        });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to preview offers",
        });
    }
});
router.post("/", (0, auth_middleware_1.requirePermission)("MANAGE_OFFERS"), async (req, res) => {
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
router.post("/ensure-category", (0, auth_middleware_1.requirePermission)("MANAGE_OFFERS"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const category = await offers_service_1.OffersService.ensureOffersCategory(merchantId);
        res.json({ success: true, category });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
router.post("/seed-demos", (0, auth_middleware_1.requirePermission)("MANAGE_OFFERS"), async (req, res) => {
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
router.post("/seed-restaurant-templates", (0, auth_middleware_1.requirePermission)("MANAGE_OFFERS"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const db = (0, db_1.getDb)();
        const cats = await db.query.categories.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.categories.merchantId, merchantId),
        });
        const foodish = cats.filter((c) => !c.isOffersCategory).map((c) => c.id);
        const offers = await offers_service_1.OffersService.seedRestaurantTemplates(merchantId, foodish);
        res.json({ success: true, offers });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to seed" });
    }
});
router.put("/:offerId", (0, auth_middleware_1.requirePermission)("MANAGE_OFFERS"), async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const offer = await offers_service_1.OffersService.update(merchantId, req.params.offerId, req.body || {});
        res.json({ success: true, offer });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update" });
    }
});
router.delete("/:offerId", (0, auth_middleware_1.requirePermission)("MANAGE_OFFERS"), async (req, res) => {
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