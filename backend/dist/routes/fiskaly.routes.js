"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const fiskaly_service_1 = require("@/services/fiskaly.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchantAccess);
router.use(auth_middleware_1.setMerchantContext);
/**
 * POST /api/merchant/fiskaly/test-connection
 * Body: { country: 'DE' | 'FR' }
 */
router.post("/test-connection", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const country = String(req.body?.country || "").trim().toUpperCase();
        if (country !== "DE" && country !== "FR") {
            return res.status(400).json({ error: "country must be DE or FR" });
        }
        await fiskaly_service_1.FiskalyService.testConnection(merchantId, country);
        res.json({ ok: true, country });
    }
    catch (error) {
        console.error("[fiskaly] test-connection failed:", error);
        res.status(400).json({
            error: error instanceof Error ? error.message : "Fiskaly connection test failed",
        });
    }
});
/**
 * POST /api/merchant/fiskaly/provision-de
 * Creates cloud TSS + client from saved API credentials (Germany only).
 */
router.post("/provision-de", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const clientSerial = req.body?.clientSerial != null ? String(req.body.clientSerial).trim().slice(0, 70) : undefined;
        const description = req.body?.description != null ? String(req.body.description).trim().slice(0, 255) : undefined;
        const fiskalySettings = await fiskaly_service_1.FiskalyService.provisionDe(merchantId, {
            clientSerial: clientSerial || undefined,
            description: description || undefined,
        });
        res.json({ ok: true, fiskalySettings });
    }
    catch (error) {
        console.error("[fiskaly] provision-de failed:", error);
        res.status(400).json({
            error: error instanceof Error ? error.message : "Fiskaly DE provisioning failed",
        });
    }
});
exports.default = router;
//# sourceMappingURL=fiskaly.routes.js.map