"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chaslay_api_key_middleware_1 = require("@/middleware/chaslay-api-key.middleware");
const pos_sessions_service_1 = require("@/services/pos-sessions.service");
const router = (0, express_1.Router)();
router.use(chaslay_api_key_middleware_1.requireChaslayApiKey);
/** POST /v1/pos/sessions/register — Android main / waiter register */
router.post("/register", async (req, res) => {
    try {
        const merchantId = req.chaslayMerchantId;
        const body = req.body || {};
        const sessionKind = (body.sessionKind === "waiter" ? "waiter" : "main");
        const platform = "android";
        const result = await pos_sessions_service_1.PosSessionsService.registerSession(merchantId, {
            sessionKind,
            platform,
            deviceId: String(body.deviceId || ""),
            deviceLabel: body.deviceLabel ? String(body.deviceLabel) : null,
            staffId: body.staffId ? String(body.staffId) : null,
            staffName: body.staffName ? String(body.staffName) : null,
        });
        res.json({ ok: true, ...result });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to register POS session",
        });
    }
});
/** POST /v1/pos/sessions/heartbeat */
router.post("/heartbeat", async (req, res) => {
    try {
        const merchantId = req.chaslayMerchantId;
        const sessionId = String(req.body?.sessionId || "");
        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" });
        }
        const result = await pos_sessions_service_1.PosSessionsService.heartbeat(merchantId, sessionId);
        res.json({ ok: true, ...result });
    }
    catch (error) {
        res.status(410).json({
            error: error instanceof Error ? error.message : "Session expired",
            code: "POS_SESSION_EXPIRED",
        });
    }
});
/** POST /v1/pos/sessions/revoke — logout / app background */
router.post("/revoke", async (req, res) => {
    try {
        const merchantId = req.chaslayMerchantId;
        const sessionId = req.body?.sessionId ? String(req.body.sessionId) : "";
        if (sessionId) {
            await pos_sessions_service_1.PosSessionsService.revokeSession(merchantId, sessionId);
        }
        else if (req.body?.deviceId) {
            const kind = req.body?.sessionKind === "waiter" ? "waiter" : "main";
            await pos_sessions_service_1.PosSessionsService.revokeByDevice(merchantId, String(req.body.deviceId), kind);
        }
        else {
            return res.status(400).json({ error: "sessionId or deviceId required" });
        }
        res.json({ ok: true });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to revoke session",
        });
    }
});
exports.default = router;
//# sourceMappingURL=pos-sessions.routes.js.map