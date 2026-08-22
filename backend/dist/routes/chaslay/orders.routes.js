"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chaslay_api_key_middleware_1 = require("@/middleware/chaslay-api-key.middleware");
const chaslay_compat_service_1 = require("@/services/chaslay-compat.service");
const router = (0, express_1.Router)();
router.get("/incoming", chaslay_api_key_middleware_1.requireChaslayApiKey, async (req, res) => {
    try {
        const since = Number(req.query.since || 0);
        const data = await chaslay_compat_service_1.ChaslayCompatService.incomingOrders(req.chaslayMerchantId, since);
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Incoming orders failed" });
    }
});
router.post("/:id/ack", chaslay_api_key_middleware_1.requireChaslayApiKey, async (req, res) => {
    try {
        const data = await chaslay_compat_service_1.ChaslayCompatService.ackOrder(req.chaslayMerchantId, req.params.id);
        res.json(data);
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Ack failed" });
    }
});
exports.default = router;
//# sourceMappingURL=orders.routes.js.map