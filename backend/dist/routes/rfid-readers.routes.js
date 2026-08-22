"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const drizzle_orm_1 = require("drizzle-orm");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const db_1 = require("@/db");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
/**
 * GET /api/rfid-readers
 */
router.get("/", async (req, res) => {
    try {
        const db = (0, db_1.getDb)();
        const readers = await db.query.rfidReaders.findMany({
            where: (0, drizzle_orm_1.eq)(db_1.schema.rfidReaders.merchantId, req.merchantId),
        });
        res.json({ success: true, readers });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list readers" });
    }
});
/**
 * POST /api/rfid-readers
 * Register an RFID card reader for gift/loyalty cards.
 */
router.post("/", async (req, res) => {
    try {
        const { name, readerUid, connectionType } = req.body;
        if (!name || !readerUid) {
            return res.status(400).json({ error: "name and readerUid are required" });
        }
        const db = (0, db_1.getDb)();
        const [reader] = await db
            .insert(db_1.schema.rfidReaders)
            .values({
            merchantId: req.merchantId,
            name,
            readerUid: String(readerUid).trim(),
            connectionType: connectionType || "hid",
            status: "active",
            lastSeenAt: new Date(),
        })
            .returning();
        res.status(201).json({ success: true, reader });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to register reader" });
    }
});
/**
 * PUT /api/rfid-readers/:id
 */
router.put("/:id", async (req, res) => {
    try {
        const db = (0, db_1.getDb)();
        const [reader] = await db
            .update(db_1.schema.rfidReaders)
            .set({
            name: req.body.name,
            connectionType: req.body.connectionType,
            status: req.body.status,
            lastSeenAt: req.body.ping ? new Date() : undefined,
        })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.rfidReaders.id, req.params.id), (0, drizzle_orm_1.eq)(db_1.schema.rfidReaders.merchantId, req.merchantId)))
            .returning();
        if (!reader)
            return res.status(404).json({ error: "Reader not found" });
        res.json({ success: true, reader });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update reader" });
    }
});
/**
 * DELETE /api/rfid-readers/:id
 */
router.delete("/:id", async (req, res) => {
    try {
        const db = (0, db_1.getDb)();
        await db
            .delete(db_1.schema.rfidReaders)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.rfidReaders.id, req.params.id), (0, drizzle_orm_1.eq)(db_1.schema.rfidReaders.merchantId, req.merchantId)));
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete reader" });
    }
});
/**
 * POST /api/rfid-readers/:id/ping
 * Mark reader as seen (heartbeat from POS/dashboard).
 */
router.post("/:id/ping", async (req, res) => {
    try {
        const db = (0, db_1.getDb)();
        const [reader] = await db
            .update(db_1.schema.rfidReaders)
            .set({ lastSeenAt: new Date(), status: "active" })
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.rfidReaders.id, req.params.id), (0, drizzle_orm_1.eq)(db_1.schema.rfidReaders.merchantId, req.merchantId)))
            .returning();
        if (!reader)
            return res.status(404).json({ error: "Reader not found" });
        res.json({ success: true, reader });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Ping failed" });
    }
});
exports.default = router;
//# sourceMappingURL=rfid-readers.routes.js.map