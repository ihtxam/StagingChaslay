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
const marketing_automation_addon_1 = require("@/lib/marketing-automation-addon");
const smart_segments_addon_1 = require("@/lib/smart-segments-addon");
const reservation_campaigns_addon_1 = require("@/lib/reservation-campaigns-addon");
const ai_coach_addon_1 = require("@/lib/ai-coach-addon");
const google_reputation_addon_1 = require("@/lib/google-reputation-addon");
const ai_web_seo_addon_1 = require("@/lib/ai-web-seo-addon");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.verifyToken);
router.use(auth_middleware_1.requireMerchant);
router.use(auth_middleware_1.setMerchantContext);
async function denyUnless(has, code, label, res) {
    if (!(await has())) {
        res.status(403).json({ error: `${label} requires the paid add-on`, code });
        return false;
    }
    return true;
}
router.get("/marketing-automation/settings", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, marketing_automation_addon_1.merchantHasMarketingAutomationLicense)(req.merchantId), "MARKETING_AUTOMATION_ADDON", "Marketing automations", res)))
            return;
        const { MarketingAutomationService } = await Promise.resolve().then(() => __importStar(require("@/services/marketing-automation.service")));
        const settings = await MarketingAutomationService.getSettings(req.merchantId);
        res.json({ success: true, settings });
    }
    catch (e) {
        res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.put("/marketing-automation/settings", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, marketing_automation_addon_1.merchantHasMarketingAutomationLicense)(req.merchantId), "MARKETING_AUTOMATION_ADDON", "Marketing automations", res)))
            return;
        const { MarketingAutomationService } = await Promise.resolve().then(() => __importStar(require("@/services/marketing-automation.service")));
        const settings = await MarketingAutomationService.updateSettings(req.merchantId, req.body?.settings || req.body);
        res.json({ success: true, settings });
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.get("/smart-segments/settings", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, smart_segments_addon_1.merchantHasSmartSegmentsLicense)(req.merchantId), "SMART_SEGMENTS_ADDON", "Smart segments", res)))
            return;
        const { SmartSegmentsService } = await Promise.resolve().then(() => __importStar(require("@/services/smart-segments.service")));
        const settings = await SmartSegmentsService.getSettings(req.merchantId);
        res.json({ success: true, settings });
    }
    catch (e) {
        res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.put("/smart-segments/settings", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, smart_segments_addon_1.merchantHasSmartSegmentsLicense)(req.merchantId), "SMART_SEGMENTS_ADDON", "Smart segments", res)))
            return;
        const { SmartSegmentsService } = await Promise.resolve().then(() => __importStar(require("@/services/smart-segments.service")));
        const settings = await SmartSegmentsService.updateSettings(req.merchantId, req.body?.settings || req.body);
        res.json({ success: true, settings });
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.get("/smart-segments/preview", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, smart_segments_addon_1.merchantHasSmartSegmentsLicense)(req.merchantId), "SMART_SEGMENTS_ADDON", "Smart segments", res)))
            return;
        const { SmartSegmentsService } = await Promise.resolve().then(() => __importStar(require("@/services/smart-segments.service")));
        const preview = await SmartSegmentsService.preview(req.merchantId);
        res.json({ success: true, ...preview });
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.post("/smart-segments/apply", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, smart_segments_addon_1.merchantHasSmartSegmentsLicense)(req.merchantId), "SMART_SEGMENTS_ADDON", "Smart segments", res)))
            return;
        const { SmartSegmentsService } = await Promise.resolve().then(() => __importStar(require("@/services/smart-segments.service")));
        const result = await SmartSegmentsService.apply(req.merchantId);
        res.json({ success: true, ...result });
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.get("/reservation-campaigns", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, reservation_campaigns_addon_1.merchantHasReservationCampaignsLicense)(req.merchantId), "RESERVATION_CAMPAIGNS_ADDON", "Reservation campaigns", res)))
            return;
        const { ReservationCampaignsService } = await Promise.resolve().then(() => __importStar(require("@/services/reservation-campaigns.service")));
        const campaigns = await ReservationCampaignsService.list(req.merchantId);
        res.json({ success: true, campaigns });
    }
    catch (e) {
        res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.post("/reservation-campaigns", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, reservation_campaigns_addon_1.merchantHasReservationCampaignsLicense)(req.merchantId), "RESERVATION_CAMPAIGNS_ADDON", "Reservation campaigns", res)))
            return;
        const { ReservationCampaignsService } = await Promise.resolve().then(() => __importStar(require("@/services/reservation-campaigns.service")));
        const campaign = await ReservationCampaignsService.save(req.merchantId, req.body || {});
        res.json({ success: true, campaign });
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.get("/ai-coach/brief", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, ai_coach_addon_1.merchantHasAiCoachLicense)(req.merchantId), "AI_COACH_ADDON", "AI insights coach", res)))
            return;
        const { AiCoachService } = await Promise.resolve().then(() => __importStar(require("@/services/ai-coach.service")));
        const brief = await AiCoachService.getBrief(req.merchantId, {
            refresh: req.query.refresh === "1" || req.query.refresh === "true",
        });
        res.json({ success: true, brief });
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.post("/ai-coach/refresh", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, ai_coach_addon_1.merchantHasAiCoachLicense)(req.merchantId), "AI_COACH_ADDON", "AI insights coach", res)))
            return;
        const { AiCoachService } = await Promise.resolve().then(() => __importStar(require("@/services/ai-coach.service")));
        const brief = await AiCoachService.regenerate(req.merchantId);
        res.json({ success: true, brief });
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.get("/google-reputation/settings", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, google_reputation_addon_1.merchantHasGoogleReputationLicense)(req.merchantId), "GOOGLE_REPUTATION_ADDON", "Google reputation", res)))
            return;
        const { GoogleReputationService } = await Promise.resolve().then(() => __importStar(require("@/services/google-reputation.service")));
        const settings = await GoogleReputationService.getSettings(req.merchantId);
        res.json({ success: true, settings });
    }
    catch (e) {
        res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.put("/google-reputation/settings", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, google_reputation_addon_1.merchantHasGoogleReputationLicense)(req.merchantId), "GOOGLE_REPUTATION_ADDON", "Google reputation", res)))
            return;
        const { GoogleReputationService } = await Promise.resolve().then(() => __importStar(require("@/services/google-reputation.service")));
        const settings = await GoogleReputationService.updateSettings(req.merchantId, req.body?.settings || req.body);
        res.json({ success: true, settings });
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.post("/google-reputation/reviews", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, google_reputation_addon_1.merchantHasGoogleReputationLicense)(req.merchantId), "GOOGLE_REPUTATION_ADDON", "Google reputation", res)))
            return;
        const { GoogleReputationService } = await Promise.resolve().then(() => __importStar(require("@/services/google-reputation.service")));
        const result = await GoogleReputationService.addReview(req.merchantId, req.body || {});
        res.json({ success: true, ...result });
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.post("/google-reputation/reviews/:reviewId/draft-reply", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, google_reputation_addon_1.merchantHasGoogleReputationLicense)(req.merchantId), "GOOGLE_REPUTATION_ADDON", "Google reputation", res)))
            return;
        const { GoogleReputationService } = await Promise.resolve().then(() => __importStar(require("@/services/google-reputation.service")));
        const settings = await GoogleReputationService.draftReplyForReview(req.merchantId, req.params.reviewId);
        res.json({ success: true, settings });
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.post("/google-reputation/reviews/:reviewId/mark-replied", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, google_reputation_addon_1.merchantHasGoogleReputationLicense)(req.merchantId), "GOOGLE_REPUTATION_ADDON", "Google reputation", res)))
            return;
        const { GoogleReputationService } = await Promise.resolve().then(() => __importStar(require("@/services/google-reputation.service")));
        const settings = await GoogleReputationService.markReplied(req.merchantId, req.params.reviewId);
        res.json({ success: true, settings });
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.get("/ai-web-seo/settings", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, ai_web_seo_addon_1.merchantHasAiWebSeoLicense)(req.merchantId), "AI_WEB_SEO_ADDON", "AI website & SEO", res)))
            return;
        const { AiWebSeoService } = await Promise.resolve().then(() => __importStar(require("@/services/ai-web-seo.service")));
        const settings = await AiWebSeoService.getSettings(req.merchantId);
        res.json({ success: true, settings });
    }
    catch (e) {
        res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.put("/ai-web-seo/settings", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, ai_web_seo_addon_1.merchantHasAiWebSeoLicense)(req.merchantId), "AI_WEB_SEO_ADDON", "AI website & SEO", res)))
            return;
        const { AiWebSeoService } = await Promise.resolve().then(() => __importStar(require("@/services/ai-web-seo.service")));
        const settings = await AiWebSeoService.updateSettings(req.merchantId, req.body?.settings || req.body);
        res.json({ success: true, settings });
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
router.post("/ai-web-seo/scan", async (req, res) => {
    try {
        if (!(await denyUnless(() => (0, ai_web_seo_addon_1.merchantHasAiWebSeoLicense)(req.merchantId), "AI_WEB_SEO_ADDON", "AI website & SEO", res)))
            return;
        const { AiWebSeoService } = await Promise.resolve().then(() => __importStar(require("@/services/ai-web-seo.service")));
        const settings = await AiWebSeoService.runScan(req.merchantId);
        res.json({ success: true, settings });
    }
    catch (e) {
        res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
    }
});
exports.default = router;
//# sourceMappingURL=growth.routes.js.map