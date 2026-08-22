"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const chaslay_compat_service_1 = require("@/services/chaslay-compat.service");
const router = (0, express_1.Router)();
router.post("/login", async (req, res) => {
    try {
        const { email, password, tenantSlug } = req.body ?? {};
        if (!email?.trim() || !password) {
            return res.status(400).json({ error: "email and password are required" });
        }
        const result = await chaslay_compat_service_1.ChaslayCompatService.posLogin(email.trim(), password, tenantSlug?.trim() || req.header("X-Tenant-Slug")?.trim() || null);
        res.json(result);
    }
    catch (error) {
        res.status(401).json({ error: error instanceof Error ? error.message : "Invalid credentials" });
    }
});
exports.default = router;
//# sourceMappingURL=pos-auth.routes.js.map