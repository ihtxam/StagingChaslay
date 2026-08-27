"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("@/middleware/auth.middleware");
const marketing_service_1 = require("@/services/marketing.service");
const email_service_1 = require("@/services/email.service");
const db_1 = require("@/db");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
/**
 * GET /api/merchant/marketing/audience
 */
router.get("/audience", async (req, res) => {
    try {
        const audience = await marketing_service_1.MarketingService.listAudience(req.merchantId);
        res.json({ success: true, audience });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * GET /api/merchant/marketing/campaigns
 */
router.get("/campaigns", async (req, res) => {
    try {
        const campaigns = await marketing_service_1.MarketingService.listCampaigns(req.merchantId);
        res.json({ success: true, campaigns });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * POST /api/merchant/marketing/campaigns — create/update draft
 */
router.post("/campaigns", async (req, res) => {
    try {
        const campaign = await marketing_service_1.MarketingService.saveCampaign(req.merchantId, {
            id: req.body.id,
            title: req.body.title,
            subject: req.body.subject,
            bodyHtml: req.body.bodyHtml,
            designJson: req.body.designJson ?? null,
            audience: req.body.audience,
            selectedEmails: req.body.selectedEmails,
        });
        res.json({ success: true, campaign });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * POST /api/merchant/marketing/campaigns/:id/send
 */
router.post("/campaigns/:id/send", async (req, res) => {
    try {
        const campaign = await marketing_service_1.MarketingService.sendCampaign(req.merchantId, req.params.id, {
            audience: req.body.audience,
            selectedEmails: req.body.selectedEmails,
        });
        res.json({ success: true, campaign });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Failed to send" });
    }
});
/**
 * GET /api/merchant/marketing/email-status
 */
router.get("/email-status", async (req, res) => {
    try {
        const status = await email_service_1.EmailService.status(req.merchantId);
        res.json({ success: true, status });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
    }
});
/**
 * GET /api/merchant/marketing/brevo-usage
 * Local daily/monthly counters + live Brevo account credits (when API key set).
 */
router.get("/brevo-usage", async (req, res) => {
    try {
        const usage = await email_service_1.EmailService.getMerchantBrevoUsage(req.merchantId);
        res.json({ success: true, usage });
    }
    catch (error) {
        const raw = error instanceof Error ? error.message : "Failed";
        const needsMigrate = /email_brevo_settings/i.test(raw) && /does not exist|column/i.test(raw);
        res.status(needsMigrate ? 400 : 500).json({
            error: needsMigrate
                ? "Database is missing email_brevo_settings. Run backend/sql/ensure-merchant-brevo-settings.sql"
                : raw,
        });
    }
});
/**
 * POST /api/merchant/marketing/test-email
 */
router.post("/test-email", async (req, res) => {
    try {
        const to = String(req.body.to || "").trim();
        if (!to.includes("@"))
            return res.status(400).json({ error: "Valid email required" });
        const db = (0, db_1.getDb)();
        const merchant = await db.query.merchants.findFirst({
            where: (0, drizzle_orm_1.eq)(db_1.schema.merchants.id, req.merchantId),
        });
        await email_service_1.EmailService.send({
            merchantId: req.merchantId,
            to,
            subject: `Test email from ${merchant?.name || "Reborn"}`,
            html: `<p>This is a test message from your SMTP / email settings.</p><p>${new Date().toISOString()}</p>`,
            emailType: "marketing_test",
        });
        res.json({ success: true });
    }
    catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Send failed" });
    }
});
/**
 * GET /api/merchant/marketing/platform-email-usage
 */
router.get("/platform-email-usage", async (req, res) => {
    try {
        const { EmailUsageService } = await Promise.resolve().then(() => __importStar(require("@/services/email-usage.service")));
        const usage = await EmailUsageService.getMerchantPlatformUsage(req.merchantId);
        res.json({ success: true, usage });
    }
    catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to load platform email usage",
        });
    }
});
exports.default = router;
//# sourceMappingURL=marketing.routes.js.map