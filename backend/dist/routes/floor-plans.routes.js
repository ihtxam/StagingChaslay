"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const edition_middleware_1 = require("@/middleware/edition.middleware");
const floor_plan_service_1 = require("@/services/floor-plan.service");
const table_qr_service_1 = require("@/services/table-qr.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
router.use((0, edition_middleware_1.requireEditionFeature)("pos_tables"));
router.get("/", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const plans = await floor_plan_service_1.FloorPlanService.list(merchantId);
        res.json({ success: true, plans });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list floor plans" });
    }
});
router.get("/covers", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const dateRaw = typeof req.query.date === "string" ? req.query.date : undefined;
        const date = dateRaw ? new Date(dateRaw) : new Date();
        const report = await floor_plan_service_1.FloorPlanService.coversReport(merchantId, date);
        res.json({ success: true, ...report });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load covers report" });
    }
});
router.get("/tables", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const tables = await floor_plan_service_1.FloorPlanService.listTablesForSync(merchantId);
        res.json({ success: true, tables });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list tables" });
    }
});
router.get("/qr-codes", async (req, res) => {
    try {
        const codes = await table_qr_service_1.TableQrService.listForMerchant(req.merchantId);
        res.json({ success: true, codes });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list QR codes" });
    }
});
router.delete("/qr-codes/:codeId", async (req, res) => {
    try {
        await table_qr_service_1.TableQrService.deleteCode(req.merchantId, req.params.codeId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete QR code" });
    }
});
router.get("/tables/:tableId/qr-codes", async (req, res) => {
    try {
        const codes = await table_qr_service_1.TableQrService.listForTable(req.merchantId, req.params.tableId);
        res.json({ success: true, codes });
    }
    catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : "Table not found" });
    }
});
router.post("/tables/:tableId/qr-codes", async (req, res) => {
    try {
        const body = zod_1.z
            .object({
            codeType: zod_1.z.enum(["static", "temporary"]),
            code: zod_1.z.string().min(1).max(512),
            expiresInHours: zod_1.z.number().int().min(1).max(168).optional(),
        })
            .parse(req.body || {});
        const code = body.codeType === "temporary"
            ? await table_qr_service_1.TableQrService.createTemporary(req.merchantId, req.params.tableId, body.code, body.expiresInHours)
            : await table_qr_service_1.TableQrService.upsertStatic(req.merchantId, req.params.tableId, body.code);
        res.status(201).json({ success: true, code });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to save QR code" });
    }
});
router.patch("/tables/:tableId", async (req, res) => {
    try {
        const body = zod_1.z
            .object({
            label: zod_1.z.string().min(1).max(50).optional(),
            capacity: zod_1.z.number().int().min(1).max(50).optional(),
            floorPlanId: zod_1.z.string().uuid().optional(),
            posX: zod_1.z.number().optional(),
            posY: zod_1.z.number().optional(),
        })
            .parse(req.body || {});
        const table = await floor_plan_service_1.FloorPlanService.patchTable(req.merchantId, req.params.tableId, body);
        res.json({ success: true, table });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update table" });
    }
});
router.delete("/tables/:tableId", async (req, res) => {
    try {
        await floor_plan_service_1.FloorPlanService.deleteTable(req.merchantId, req.params.tableId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete table" });
    }
});
router.patch("/tables/:tableId/status", async (req, res) => {
    try {
        const body = zod_1.z
            .object({
            status: zod_1.z.enum(["available", "occupied", "reserved", "dirty"]),
            currentOrderId: zod_1.z.string().uuid().nullable().optional(),
        })
            .parse(req.body || {});
        const table = await floor_plan_service_1.FloorPlanService.setTableStatus(req.merchantId, req.params.tableId, body.status, body.currentOrderId);
        res.json({ success: true, table });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update table status" });
    }
});
router.get("/:planId", async (req, res) => {
    try {
        const plan = await floor_plan_service_1.FloorPlanService.getPlan(req.merchantId, req.params.planId);
        res.json({ success: true, plan });
    }
    catch (error) {
        res.status(404).json({ error: error instanceof Error ? error.message : "Floor plan not found" });
    }
});
router.post("/", async (req, res) => {
    try {
        const body = zod_1.z.object({ name: zod_1.z.string().min(1).max(120).optional() }).parse(req.body || {});
        const plan = await floor_plan_service_1.FloorPlanService.createPlan(req.merchantId, body.name || "Main floor");
        res.status(201).json({ success: true, plan });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create floor plan" });
    }
});
router.patch("/:planId", async (req, res) => {
    try {
        const body = zod_1.z
            .object({
            name: zod_1.z.string().min(1).max(120).optional(),
            canvasWidth: zod_1.z.number().int().positive().optional(),
            canvasHeight: zod_1.z.number().int().positive().optional(),
            isActive: zod_1.z.boolean().optional(),
            sortOrder: zod_1.z.number().int().optional(),
        })
            .parse(req.body || {});
        const plan = await floor_plan_service_1.FloorPlanService.updatePlan(req.merchantId, req.params.planId, body);
        res.json({ success: true, plan });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update floor plan" });
    }
});
router.delete("/:planId", async (req, res) => {
    try {
        await floor_plan_service_1.FloorPlanService.deletePlan(req.merchantId, req.params.planId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete floor plan" });
    }
});
router.put("/:planId/tables", async (req, res) => {
    try {
        const body = zod_1.z
            .object({
            tables: zod_1.z.array(zod_1.z.object({
                id: zod_1.z.string().uuid().optional(),
                label: zod_1.z.string().min(1).max(50),
                capacity: zod_1.z.number().int().min(1).max(50).optional(),
                shape: zod_1.z.enum(["round", "rect"]).optional(),
                posX: zod_1.z.number().optional(),
                posY: zod_1.z.number().optional(),
                width: zod_1.z.number().positive().optional(),
                height: zod_1.z.number().positive().optional(),
                rotation: zod_1.z.number().optional(),
                status: zod_1.z.enum(["available", "occupied", "reserved", "dirty"]).optional(),
                sortOrder: zod_1.z.number().int().optional(),
            })),
            elements: zod_1.z
                .array(zod_1.z.object({
                id: zod_1.z.string().min(1).max(64),
                elementType: zod_1.z.enum(["WALL", "DOOR", "BAR", "OBSTACLE"]),
                posX: zod_1.z.number(),
                posY: zod_1.z.number(),
                width: zod_1.z.number().positive(),
                height: zod_1.z.number().positive(),
                rotation: zod_1.z.number().optional(),
            }))
                .optional(),
        })
            .parse(req.body || {});
        const plan = await floor_plan_service_1.FloorPlanService.saveTables(req.merchantId, req.params.planId, body.tables, body.elements || []);
        res.json({ success: true, plan });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to save tables" });
    }
});
router.post("/:planId/tables", async (req, res) => {
    try {
        const body = zod_1.z
            .object({
            label: zod_1.z.string().min(1).max(50),
            capacity: zod_1.z.number().int().min(1).max(50).optional(),
        })
            .parse(req.body || {});
        const plan = await floor_plan_service_1.FloorPlanService.addTable(req.merchantId, req.params.planId, body);
        res.status(201).json({ success: true, plan });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to add table" });
    }
});
router.post("/:planId/tables/batch", async (req, res) => {
    try {
        const body = zod_1.z
            .object({
            prefix: zod_1.z.string().max(20).optional(),
            startNumber: zod_1.z.number().int().min(0).optional(),
            count: zod_1.z.number().int().min(1).max(100).optional(),
            capacity: zod_1.z.number().int().min(1).max(50).optional(),
        })
            .parse(req.body || {});
        const plan = await floor_plan_service_1.FloorPlanService.batchAddTables(req.merchantId, req.params.planId, body);
        res.status(201).json({ success: true, plan });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to batch add tables" });
    }
});
exports.default = router;
//# sourceMappingURL=floor-plans.routes.js.map