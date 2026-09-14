"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kioskMerchantRouter = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const auth_middleware_1 = require("@/middleware/auth.middleware");
const kiosk_addon_1 = require("@/lib/kiosk-addon");
const kiosk_service_1 = require("@/services/kiosk.service");
const media_upload_service_1 = require("@/services/media-upload.service");
const router = (0, express_1.Router)();
const imageUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 12 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if ((0, media_upload_service_1.isAllowedImageMime)(file.mimetype)) {
            cb(null, true);
            return;
        }
        cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"));
    },
});
function handleError(res, error, fallback, status = 400) {
    if (error instanceof kiosk_service_1.KioskLicenseError) {
        return res.status(403).json({ error: error.message, code: error.code });
    }
    const message = error instanceof Error ? error.message : fallback;
    if (message.toLowerCase().includes("not found")) {
        return res.status(404).json({ error: message });
    }
    return res.status(status).json({ error: message });
}
/** Public kiosk config — token in URL, no JWT */
router.get("/:token/config", async (req, res) => {
    try {
        const data = await kiosk_service_1.KioskService.getPublicConfig(req.params.token);
        res.json({ success: true, ...data });
    }
    catch (error) {
        handleError(res, error, "Failed to load kiosk config", 500);
    }
});
router.get("/:token/menu", async (req, res) => {
    try {
        const data = await kiosk_service_1.KioskService.getMenu(req.params.token);
        res.json({ success: true, data: data.menu, bestsellerIds: data.bestsellerIds || [] });
    }
    catch (error) {
        handleError(res, error, "Failed to load menu", 500);
    }
});
router.post("/:token/membership/lookup", async (req, res) => {
    try {
        const code = String(req.body?.code || "").trim();
        if (!code)
            return res.status(400).json({ error: "Membership code is required" });
        const card = await kiosk_service_1.KioskService.lookupMembership(req.params.token, code);
        res.json({ success: true, card });
    }
    catch (error) {
        handleError(res, error, "Membership not found", 404);
    }
});
router.post("/:token/orders/:orderId/terminal-pay", async (req, res) => {
    try {
        const result = await kiosk_service_1.KioskService.payOrderAtTerminal(req.params.token, req.params.orderId);
        res.json({ success: true, ...result });
    }
    catch (error) {
        handleError(res, error, "Terminal payment failed");
    }
});
router.post("/:token/verify-admin-pin", async (req, res) => {
    try {
        const pin = String(req.body?.pin || "").trim();
        const { merchant, settings } = await loadMerchantByTokenForDiagnostics(req.params.token);
        if (!kiosk_service_1.KioskService.verifyAdminPin(settings, pin)) {
            return res.status(403).json({ error: "Invalid admin code" });
        }
        res.json({
            success: true,
            adminUrl: `/kiosk/${req.params.token}/admin`,
            merchantSlug: merchant.slug,
        });
    }
    catch (error) {
        handleError(res, error, "Verification failed");
    }
});
router.get("/:token/diagnostics", async (req, res) => {
    try {
        const { merchant } = await loadMerchantByTokenForDiagnostics(req.params.token);
        const diagnostics = await kiosk_service_1.KioskService.getDiagnostics(merchant.id);
        res.json({ success: true, diagnostics });
    }
    catch (error) {
        handleError(res, error, "Failed to load diagnostics", 500);
    }
});
router.post("/:token/admin-settings", async (req, res) => {
    try {
        const pin = String(req.body?.pin || "").trim();
        const { merchant, settings } = await loadMerchantByTokenForDiagnostics(req.params.token);
        if (!kiosk_service_1.KioskService.verifyAdminPin(settings, pin)) {
            return res.status(403).json({ error: "Invalid admin code" });
        }
        res.json({ success: true, settings });
    }
    catch (error) {
        handleError(res, error, "Failed to load admin settings", 500);
    }
});
router.put("/:token/admin-settings", async (req, res) => {
    try {
        const pin = String(req.body?.pin || "").trim();
        const { merchant, settings } = await loadMerchantByTokenForDiagnostics(req.params.token);
        if (!kiosk_service_1.KioskService.verifyAdminPin(settings, pin)) {
            return res.status(403).json({ error: "Invalid admin code" });
        }
        const saved = await kiosk_service_1.KioskService.writeSettingsForMerchant(merchant.id, req.body?.settings);
        res.json({ success: true, settings: saved });
    }
    catch (error) {
        handleError(res, error, "Failed to save kiosk settings");
    }
});
router.post("/:token/upload", (req, res, next) => {
    imageUpload.single("file")(req, res, (err) => {
        if (err) {
            const message = err instanceof Error ? err.message : "Upload failed";
            return res.status(400).json({ error: message });
        }
        next();
    });
}, async (req, res) => {
    try {
        const pin = String(req.body?.pin || "").trim();
        const { merchant, settings } = await loadMerchantByTokenForDiagnostics(req.params.token);
        if (!kiosk_service_1.KioskService.verifyAdminPin(settings, pin)) {
            return res.status(403).json({ error: "Invalid admin code" });
        }
        if (!req.file)
            return res.status(400).json({ error: "No image file uploaded" });
        const saved = await (0, media_upload_service_1.saveMerchantImage)({
            merchantId: merchant.id,
            buffer: req.file.buffer,
            mimeType: req.file.mimetype,
            originalName: req.file.originalname,
        });
        res.status(201).json({ success: true, url: saved.url });
    }
    catch (error) {
        handleError(res, error, "Upload failed");
    }
});
async function loadMerchantByTokenForDiagnostics(token) {
    const config = await kiosk_service_1.KioskService.getPublicConfig(token);
    const settings = await kiosk_service_1.KioskService.readSettingsForMerchant(config.merchant.id);
    return { merchant: config.merchant, settings };
}
exports.default = router;
/** Merchant-authenticated kiosk settings */
exports.kioskMerchantRouter = (0, express_1.Router)();
exports.kioskMerchantRouter.use(auth_middleware_1.verifyToken);
exports.kioskMerchantRouter.use(auth_middleware_1.requireMerchantAccess);
exports.kioskMerchantRouter.use(auth_middleware_1.setMerchantContext);
exports.kioskMerchantRouter.get("/diagnostics", async (req, res) => {
    try {
        const diagnostics = await kiosk_service_1.KioskService.getDiagnostics(req.merchantId);
        res.json({ success: true, diagnostics });
    }
    catch (error) {
        handleError(res, error, "Failed to load diagnostics", 500);
    }
});
exports.kioskMerchantRouter.get("/settings", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const enabled = await (0, kiosk_addon_1.readKioskAddonEnabled)(merchantId);
        const settings = await kiosk_service_1.KioskService.readSettingsForMerchant(merchantId);
        res.json({ success: true, enabled, settings });
    }
    catch (error) {
        handleError(res, error, "Failed to load kiosk settings", 500);
    }
});
exports.kioskMerchantRouter.put("/settings", async (req, res) => {
    try {
        const merchantId = req.merchantId;
        const settings = await kiosk_service_1.KioskService.writeSettingsForMerchant(merchantId, req.body?.settings);
        res.json({ success: true, settings });
    }
    catch (error) {
        handleError(res, error, "Failed to save kiosk settings");
    }
});
exports.kioskMerchantRouter.post("/settings/regenerate-token", async (req, res) => {
    try {
        const settings = await kiosk_service_1.KioskService.regenerateToken(req.merchantId);
        res.json({ success: true, settings });
    }
    catch (error) {
        handleError(res, error, "Failed to regenerate token");
    }
});
exports.kioskMerchantRouter.put("/addon", async (req, res) => {
    try {
        const enabled = await (0, kiosk_addon_1.writeKioskAddonEnabled)(req.merchantId, !!req.body?.enabled);
        res.json({ success: true, enabled });
    }
    catch (error) {
        handleError(res, error, "Failed to update kiosk addon");
    }
});
//# sourceMappingURL=kiosk.routes.js.map