"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const reservation_service_1 = require("@/services/reservation.service");
const floor_plan_service_1 = require("@/services/floor-plan.service");
const reservation_service_2 = require("@/services/reservation.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
/**
 * GET /api/merchant/reservations/config
 */
router.get("/config", async (req, res) => {
    try {
        const config = await reservation_service_1.ReservationService.getConfig(req.merchantId);
        const tables = await floor_plan_service_1.FloorPlanService.listTablesForSync(req.merchantId);
        res.json({ success: true, config, tables });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load config" });
    }
});
/**
 * PUT /api/merchant/reservations/config
 */
router.put("/config", async (req, res) => {
    try {
        const config = await reservation_service_1.ReservationService.updateSettings(req.merchantId, {
            enabled: req.body.enabled,
            settings: req.body.settings,
            dineInHours: req.body.dineInHours,
        });
        res.json({ success: true, config });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to save settings" });
    }
});
/**
 * GET /api/merchant/reservations
 */
router.get("/", async (req, res) => {
    try {
        const from = req.query.from ? new Date(String(req.query.from)) : undefined;
        const to = req.query.to ? new Date(String(req.query.to)) : undefined;
        const status = req.query.status ? String(req.query.status) : undefined;
        const reservations = await reservation_service_1.ReservationService.list(req.merchantId, { from, to, status });
        res.json({ success: true, reservations });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list" });
    }
});
/**
 * GET /api/merchant/reservations/slots
 */
router.get("/slots", async (req, res) => {
    try {
        const date = String(req.query.date || "");
        const partySize = Number(req.query.partySize) || 2;
        const result = await reservation_service_1.ReservationService.getSlots(req.merchantId, date, partySize);
        res.json({ success: true, ...result });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to load slots" });
    }
});
/**
 * POST /api/merchant/reservations
 */
router.post("/", async (req, res) => {
    try {
        let reservedAt = req.body.reservedAt;
        if (req.body.date && req.body.time) {
            reservedAt = (0, reservation_service_2.zurichLocalToDate)(String(req.body.date), String(req.body.time));
        }
        const reservation = await reservation_service_1.ReservationService.create(req.merchantId, {
            guestName: req.body.guestName,
            guestEmail: req.body.guestEmail,
            guestPhone: req.body.guestPhone,
            partySize: req.body.partySize,
            reservedAt,
            notes: req.body.notes,
            source: req.body.source || "dashboard",
            tableId: req.body.tableId,
            status: req.body.status,
            skipSlotCheck: !!req.body.skipSlotCheck,
        });
        res.status(201).json({ success: true, reservation });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create" });
    }
});
/**
 * GET /api/merchant/reservations/:id
 */
router.get("/:id", async (req, res) => {
    try {
        const reservation = await reservation_service_1.ReservationService.get(req.merchantId, req.params.id);
        res.json({ success: true, reservation });
    }
    catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : "Not found" });
    }
});
/**
 * PUT /api/merchant/reservations/:id
 */
router.put("/:id", async (req, res) => {
    try {
        const reservation = await reservation_service_1.ReservationService.update(req.merchantId, req.params.id, {
            guestName: req.body.guestName,
            guestEmail: req.body.guestEmail,
            guestPhone: req.body.guestPhone,
            partySize: req.body.partySize,
            reservedAt: req.body.reservedAt,
            date: req.body.date,
            time: req.body.time,
            notes: req.body.notes,
            internalNotes: req.body.internalNotes,
            tableId: req.body.tableId,
        });
        res.json({ success: true, reservation });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Update failed" });
    }
});
/**
 * POST /api/merchant/reservations/:id/action
 */
router.post("/:id/action", async (req, res) => {
    try {
        const reservation = await reservation_service_1.ReservationService.action(req.merchantId, req.params.id, req.body.action, {
            tableId: req.body.tableId,
            internalNotes: req.body.internalNotes,
            cancelReason: req.body.cancelReason,
            sendRejectionEmail: req.body.sendRejectionEmail,
        });
        res.json({ success: true, reservation });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Action failed" });
    }
});
exports.default = router;
//# sourceMappingURL=reservations.routes.js.map