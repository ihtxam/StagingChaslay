"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const platform_log_service_1 = require("@/services/platform-log.service");
const router = (0, express_1.Router)();
/** Merchant / waiter / WebPOS client errors — visible in superadmin System Logs. */
router.post("/", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const errors = Array.isArray(req.body?.errors) ? req.body.errors : [];
        if (!errors.length)
            return res.json({ success: true, written: 0 });
        let written = 0;
        for (const raw of errors.slice(0, 30)) {
            const message = String(raw?.message || "").trim().slice(0, 2000);
            if (!message)
                continue;
            const level = String(raw?.level || "error").toLowerCase() === "warn" ? "warn" : "error";
            await platform_log_service_1.PlatformLogService.write({
                level,
                category: "client_error",
                message,
                merchantId,
                actorRole: "merchant",
                actorId: req.user?.id || null,
                metadata: {
                    source: String(raw?.source || "client").slice(0, 80),
                    path: String(raw?.path || "").slice(0, 512),
                    staffId: req.user?.staffId || null,
                    staffName: req.user?.name || null,
                    ...(raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : {}),
                },
            });
            written += 1;
        }
        res.json({ success: true, written });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to record client errors",
        });
    }
});
exports.default = router;
//# sourceMappingURL=client-errors.routes.js.map