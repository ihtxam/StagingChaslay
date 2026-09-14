"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const custom_domain_service_1 = require("@/services/custom-domain.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
/**
 * GET /api/merchant/custom-domain
 */
router.get("/", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const status = await custom_domain_service_1.CustomDomainService.getStatus(merchantId);
        res.json({ success: true, status });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to load custom domain status",
        });
    }
});
/**
 * POST /api/merchant/custom-domain/start
 * Body: { domain: string }
 */
router.post("/start", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const domain = String(req.body?.domain || "");
        const status = await custom_domain_service_1.CustomDomainService.startSetup(merchantId, domain);
        res.json({ success: true, status });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "Failed to start custom domain setup",
        });
    }
});
/**
 * POST /api/merchant/custom-domain/verify-dns
 */
router.post("/verify-dns", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const status = await custom_domain_service_1.CustomDomainService.verifyDns(merchantId);
        res.json({ success: true, status });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "DNS verification failed",
        });
    }
});
/**
 * POST /api/merchant/custom-domain/refresh-ssl
 */
router.post("/refresh-ssl", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const status = await custom_domain_service_1.CustomDomainService.refreshSsl(merchantId);
        res.json({ success: true, status });
    }
    catch (error) {
        res.status(400).json({
            error: error instanceof Error ? error.message : "SSL check failed",
        });
    }
});
/**
 * DELETE /api/merchant/custom-domain
 */
router.delete("/", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        if (!merchantId)
            return res.status(400).json({ error: "Merchant ID is required" });
        const status = await custom_domain_service_1.CustomDomainService.removeDomain(merchantId);
        res.json({ success: true, status });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to remove custom domain",
        });
    }
});
exports.default = router;
//# sourceMappingURL=custom-domain.routes.js.map