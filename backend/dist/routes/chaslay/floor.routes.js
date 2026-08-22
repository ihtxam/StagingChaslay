"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chaslay_api_key_middleware_1 = require("@/middleware/chaslay-api-key.middleware");
const chaslay_floor_service_1 = require("@/services/chaslay-floor.service");
const router = (0, express_1.Router)();
router.use(chaslay_api_key_middleware_1.requireChaslayApiKey);
router.post("/register", async (req, res) => {
    try {
        const { deviceId, deviceName, role, lanHost, appVersion } = req.body ?? {};
        if (!deviceId) {
            return res.status(400).json({ error: "deviceId required" });
        }
        const data = await chaslay_floor_service_1.ChaslayFloorService.registerDevice(req.chaslayMerchantId, {
            deviceId,
            deviceName,
            role,
            lanHost,
            appVersion,
        });
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Register failed" });
    }
});
router.get("/main-pos", async (req, res) => {
    try {
        const data = await chaslay_floor_service_1.ChaslayFloorService.getMainPos(req.chaslayMerchantId);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Main POS lookup failed" });
    }
});
router.get("/orders", async (req, res) => {
    try {
        const since = Number(req.query.since || 0);
        const data = await chaslay_floor_service_1.ChaslayFloorService.listOrders(req.chaslayMerchantId, since);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Orders fetch failed" });
    }
});
router.put("/orders/:localOrderId", async (req, res) => {
    try {
        const localOrderId = req.params.localOrderId;
        if (!localOrderId) {
            return res.status(400).json({ error: "localOrderId required" });
        }
        const data = await chaslay_floor_service_1.ChaslayFloorService.upsertOrder(req.chaslayMerchantId, localOrderId, req.body ?? {});
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Order upsert failed" });
    }
});
router.post("/print-jobs", async (req, res) => {
    try {
        const { jobType, payload, sourceDeviceId, orderId } = req.body ?? {};
        if (!jobType || !payload) {
            return res.status(400).json({ error: "jobType and payload required" });
        }
        const data = await chaslay_floor_service_1.ChaslayFloorService.createPrintJob(req.chaslayMerchantId, {
            jobType,
            payload,
            sourceDeviceId,
            orderId,
        });
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Print job create failed" });
    }
});
router.get("/print-jobs/pending", async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit || 20), 50);
        // Android MAIN_POS handles KITCHEN/RECEIPT; WebPOS hubs consume ESCPOS separately.
        const data = await chaslay_floor_service_1.ChaslayFloorService.listPendingPrintJobs(req.chaslayMerchantId, limit, {
            excludeJobTypes: ["ESCPOS"],
        });
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Print jobs fetch failed" });
    }
});
router.post("/print-jobs/:id/ack", async (req, res) => {
    try {
        const status = req.body?.status === "FAILED" ? "FAILED" : "DONE";
        const data = await chaslay_floor_service_1.ChaslayFloorService.ackPrintJob(req.chaslayMerchantId, req.params.id, status);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Ack failed" });
    }
});
exports.default = router;
//# sourceMappingURL=floor.routes.js.map