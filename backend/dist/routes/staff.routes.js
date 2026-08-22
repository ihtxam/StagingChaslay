"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const staff_service_1 = require("@/services/staff.service");
const permissions_1 = require("@/lib/permissions");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchantAccess);
router.use(auth_middleware_1.setMerchantContext);
function requireStaffManage(req, res, next) {
    if (req.user?.role === "merchant")
        return next();
    const perms = req.user?.permissions || [];
    if (perms.includes("MANAGE_STAFF") || perms.includes("MANAGE_ROLES"))
        return next();
    return res.status(403).json({ error: "Staff management permission required" });
}
router.get("/permissions", (_req, res) => {
    res.json({ success: true, permissions: permissions_1.ALL_PERMISSIONS });
});
router.get("/roles", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const roles = await staff_service_1.StaffService.listRoles(merchantId);
        res.json({
            success: true,
            roles: roles.map((r) => ({
                id: r.id,
                name: r.name,
                permissions: r.permissions.split(",").filter(Boolean),
                isSystem: r.isSystem,
                sortOrder: r.sortOrder,
            })),
        });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list roles" });
    }
});
router.post("/roles", requireStaffManage, async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { name, permissions } = req.body;
        const role = await staff_service_1.StaffService.createRole(merchantId, name, (permissions || []));
        res.json({ success: true, role });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create role" });
    }
});
router.put("/roles/:roleId", requireStaffManage, async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { name, permissions } = req.body;
        const role = await staff_service_1.StaffService.updateRole(merchantId, req.params.roleId, {
            name,
            permissions: permissions,
        });
        res.json({ success: true, role });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update role" });
    }
});
router.delete("/roles/:roleId", requireStaffManage, async (req, res) => {
    try {
        const merchantId = req.merchantId;
        await staff_service_1.StaffService.deleteRole(merchantId, req.params.roleId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete role" });
    }
});
router.get("/staff", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const staff = await staff_service_1.StaffService.listStaff(merchantId);
        res.json({ success: true, staff });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list staff" });
    }
});
router.post("/staff", requireStaffManage, async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const staff = await staff_service_1.StaffService.createStaff(merchantId, req.body);
        res.json({ success: true, staff });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create staff" });
    }
});
router.put("/staff/:staffId", requireStaffManage, async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const staff = await staff_service_1.StaffService.updateStaff(merchantId, req.params.staffId, req.body);
        res.json({ success: true, staff });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update staff" });
    }
});
router.delete("/staff/:staffId", requireStaffManage, async (req, res) => {
    try {
        const merchantId = req.merchantId;
        await staff_service_1.StaffService.deleteStaff(merchantId, req.params.staffId);
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete staff" });
    }
});
/** WebPOS / counter PIN verify (merchant JWT required) */
router.post("/staff/verify-pin", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const { pin } = req.body;
        const staff = await staff_service_1.StaffService.verifyPin(merchantId, String(pin || ""));
        res.json({ success: true, staff });
    }
    catch (error) {
        // 403 (not 401): invalid PIN must not clear the merchant dashboard JWT.
        res.status(403).json({ error: error instanceof Error ? error.message : "Invalid PIN" });
    }
});
exports.default = router;
//# sourceMappingURL=staff.routes.js.map