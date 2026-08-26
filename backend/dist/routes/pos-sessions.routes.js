"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const pos_sessions_service_1 = require("@/services/pos-sessions.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchantAccess);
router.use(auth_middleware_1.setMerchantContext);
/** GET /api/merchant/pos/sessions — active main + waiter stations */
router.get("/pos/sessions", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const [main, waiter, limits] = await Promise.all([
            pos_sessions_service_1.PosSessionsService.listActive(merchantId, "main"),
            pos_sessions_service_1.PosSessionsService.listActive(merchantId, "waiter"),
            pos_sessions_service_1.PosSessionsService.getLimits(merchantId),
        ]);
        res.json({
            success: true,
            limits,
            sessions: { main, waiter },
        });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to list POS sessions",
        });
    }
});
/** POST /api/merchant/pos/sessions/register */
router.post("/pos/sessions/register", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const body = req.body || {};
        const sessionKind = (body.sessionKind === "waiter" ? "waiter" : "main");
        const platform = String(body.platform || "webpos").slice(0, 30);
        const result = await pos_sessions_service_1.PosSessionsService.registerSession(merchantId, {
            sessionKind,
            platform,
            deviceId: String(body.deviceId || ""),
            deviceLabel: body.deviceLabel ? String(body.deviceLabel) : null,
            staffId: body.staffId ? String(body.staffId) : null,
            staffName: body.staffName ? String(body.staffName) : null,
        });
        res.json({ success: true, ...result });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to register POS session",
        });
    }
});
/** POST /api/merchant/pos/sessions/heartbeat */
router.post("/pos/sessions/heartbeat", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const sessionId = String(req.body?.sessionId || "");
        if (!sessionId) {
            return res.status(400).json({ error: "sessionId is required" });
        }
        const result = await pos_sessions_service_1.PosSessionsService.heartbeat(merchantId, sessionId, {
            printAgentOnline: typeof req.body?.printAgentOnline === "boolean"
                ? req.body.printAgentOnline
                : undefined,
        });
        res.json({ success: true, ...result });
    }
    catch (error) {
        res.status(410).json({
            error: error instanceof Error ? error.message : "Session expired",
            code: "POS_SESSION_EXPIRED",
        });
    }
});
/** DELETE /api/merchant/pos/sessions/:id — kick a station */
router.delete("/pos/sessions/:id", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (req.user?.role === "staff") {
            const perms = req.user.permissions || [];
            if (!perms.includes("MANAGE_SETTINGS")) {
                return res.status(403).json({ error: "Permission denied" });
            }
        }
        await pos_sessions_service_1.PosSessionsService.revokeSession(merchantId, req.params.id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to revoke session",
        });
    }
});
exports.default = router;
//# sourceMappingURL=pos-sessions.routes.js.map