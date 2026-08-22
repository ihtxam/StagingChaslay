"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const voucher_service_1 = require("@/services/voucher.service");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken, auth_middleware_1.requireMerchant, auth_middleware_1.setMerchantContext);
router.get("/", async (req, res) => {
    try {
        const vouchers = await voucher_service_1.VoucherService.list(req.merchantId);
        res.json({ success: true, vouchers });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list vouchers" });
    }
});
router.post("/", async (req, res) => {
    try {
        const voucher = await voucher_service_1.VoucherService.create(req.merchantId, req.body || {});
        res.status(201).json({ success: true, voucher });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create voucher" });
    }
});
router.get("/:voucherId/redemptions", async (req, res) => {
    try {
        const redemptions = await voucher_service_1.VoucherService.listRedemptions(req.merchantId, req.params.voucherId);
        res.json({ success: true, redemptions });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to load redemptions" });
    }
});
router.put("/:voucherId", async (req, res) => {
    try {
        const voucher = await voucher_service_1.VoucherService.update(req.merchantId, req.params.voucherId, req.body || {});
        res.json({ success: true, voucher });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update voucher" });
    }
});
router.delete("/:voucherId", async (req, res) => {
    try {
        await voucher_service_1.VoucherService.remove(req.merchantId, req.params.voucherId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete voucher" });
    }
});
exports.default = router;
//# sourceMappingURL=vouchers.routes.js.map