"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const db_1 = require("@/db");
const geo_1 = require("@/lib/geo");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
/**
 * GET /api/delivery-zones
 */
router.get("/", async (req, res) => {
    try {
        const db = (0, db_1.getDb)();
        const zones = await db.query.deliveryZones.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.deliveryZones.merchantId, req.merchantId),
            orderBy: [(0, drizzle_orm_1.asc)(db_1.schema.deliveryZones.sortOrder)],
        });
        res.json({ success: true, zones });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list zones" });
    }
});
/**
 * POST /api/delivery-zones
 */
router.post("/", async (req, res) => {
    try {
        const { name, polygon, zipCodes, minOrderAmount, deliveryFee, estimatedMinutes, color, isActive, sortOrder, } = req.body;
        if (!name)
            return res.status(400).json({ error: "name is required" });
        const ring = (0, geo_1.normalizeRing)(polygon || []);
        if (ring.length < 4) {
            return res.status(400).json({ error: "Draw a delivery zone polygon with at least 3 points" });
        }
        const db = (0, db_1.getDb)();
        const [zone] = await db
            .insert(db_1.schema.deliveryZones)
            .values({
            merchantId: req.merchantId,
            name,
            polygon: ring,
            zipCodes: Array.isArray(zipCodes) ? zipCodes.map(String) : [],
            minOrderAmount: String(minOrderAmount ?? 0),
            deliveryFee: String(deliveryFee ?? 0),
            estimatedMinutes: estimatedMinutes ?? 45,
            color: color || "#0d9488",
            isActive: isActive !== false,
            sortOrder: sortOrder ?? 0,
        })
            .returning();
        res.status(201).json({ success: true, zone });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create zone" });
    }
});
/**
 * PUT /api/delivery-zones/:id
 */
router.put("/:id", async (req, res) => {
    try {
        const patch = { updatedAt: new Date() };
        if (req.body.name !== undefined)
            patch.name = req.body.name;
        if (req.body.polygon !== undefined) {
            const ring = (0, geo_1.normalizeRing)(req.body.polygon);
            if (ring.length < 4) {
                return res.status(400).json({ error: "Polygon needs at least 3 points" });
            }
            patch.polygon = ring;
        }
        if (req.body.zipCodes !== undefined) {
            patch.zipCodes = Array.isArray(req.body.zipCodes) ? req.body.zipCodes.map(String) : [];
        }
        if (req.body.minOrderAmount !== undefined)
            patch.minOrderAmount = String(req.body.minOrderAmount);
        if (req.body.deliveryFee !== undefined)
            patch.deliveryFee = String(req.body.deliveryFee);
        if (req.body.estimatedMinutes !== undefined)
            patch.estimatedMinutes = req.body.estimatedMinutes;
        if (req.body.color !== undefined)
            patch.color = req.body.color;
        if (req.body.isActive !== undefined)
            patch.isActive = !!req.body.isActive;
        if (req.body.sortOrder !== undefined)
            patch.sortOrder = req.body.sortOrder;
        const db = (0, db_1.getDb)();
        const [zone] = await db
            .update(db_1.schema.deliveryZones)
            .set(patch)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.deliveryZones.id, req.params.id), (0, drizzle_orm_1.eq)(db_1.schema.deliveryZones.merchantId, req.merchantId)))
            .returning();
        if (!zone)
            return res.status(404).json({ error: "Zone not found" });
        res.json({ success: true, zone });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update zone" });
    }
});
/**
 * DELETE /api/delivery-zones/:id
 */
router.delete("/:id", async (req, res) => {
    try {
        const db = (0, db_1.getDb)();
        await db
            .delete(db_1.schema.deliveryZones)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.deliveryZones.id, req.params.id), (0, drizzle_orm_1.eq)(db_1.schema.deliveryZones.merchantId, req.merchantId)));
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete zone" });
    }
});
exports.default = router;
//# sourceMappingURL=delivery-zones.routes.js.map