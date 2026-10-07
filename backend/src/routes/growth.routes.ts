import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { merchantHasMarketingAutomationLicense } from "@/lib/marketing-automation-addon";
import { merchantHasSmartSegmentsLicense } from "@/lib/smart-segments-addon";
import { merchantHasReservationCampaignsLicense } from "@/lib/reservation-campaigns-addon";
import { merchantHasAiCoachLicense } from "@/lib/ai-coach-addon";
import { merchantHasGoogleReputationLicense } from "@/lib/google-reputation-addon";
import { merchantHasAiWebSeoLicense } from "@/lib/ai-web-seo-addon";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

async function denyUnless(has: () => Promise<boolean>, code: string, label: string, res: Response) {
  if (!(await has())) {
    res.status(403).json({ error: `${label} requires the paid add-on`, code });
    return false;
  }
  return true;
}

router.get("/marketing-automation/settings", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasMarketingAutomationLicense(req.merchantId!), "MARKETING_AUTOMATION_ADDON", "Marketing automations", res))) return;
    const { MarketingAutomationService } = await import("@/services/marketing-automation.service");
    const settings = await MarketingAutomationService.getSettings(req.merchantId!);
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.put("/marketing-automation/settings", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasMarketingAutomationLicense(req.merchantId!), "MARKETING_AUTOMATION_ADDON", "Marketing automations", res))) return;
    const { MarketingAutomationService } = await import("@/services/marketing-automation.service");
    const settings = await MarketingAutomationService.updateSettings(req.merchantId!, req.body?.settings || req.body);
    res.json({ success: true, settings });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.get("/smart-segments/settings", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasSmartSegmentsLicense(req.merchantId!), "SMART_SEGMENTS_ADDON", "Smart segments", res))) return;
    const { SmartSegmentsService } = await import("@/services/smart-segments.service");
    const settings = await SmartSegmentsService.getSettings(req.merchantId!);
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.put("/smart-segments/settings", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasSmartSegmentsLicense(req.merchantId!), "SMART_SEGMENTS_ADDON", "Smart segments", res))) return;
    const { SmartSegmentsService } = await import("@/services/smart-segments.service");
    const settings = await SmartSegmentsService.updateSettings(req.merchantId!, req.body?.settings || req.body);
    res.json({ success: true, settings });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.get("/smart-segments/preview", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasSmartSegmentsLicense(req.merchantId!), "SMART_SEGMENTS_ADDON", "Smart segments", res))) return;
    const { SmartSegmentsService } = await import("@/services/smart-segments.service");
    const preview = await SmartSegmentsService.preview(req.merchantId!);
    res.json({ success: true, ...preview });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.post("/smart-segments/apply", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasSmartSegmentsLicense(req.merchantId!), "SMART_SEGMENTS_ADDON", "Smart segments", res))) return;
    const { SmartSegmentsService } = await import("@/services/smart-segments.service");
    const result = await SmartSegmentsService.apply(req.merchantId!);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.get("/reservation-campaigns", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasReservationCampaignsLicense(req.merchantId!), "RESERVATION_CAMPAIGNS_ADDON", "Reservation campaigns", res))) return;
    const { ReservationCampaignsService } = await import("@/services/reservation-campaigns.service");
    const campaigns = await ReservationCampaignsService.list(req.merchantId!);
    res.json({ success: true, campaigns });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.post("/reservation-campaigns", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasReservationCampaignsLicense(req.merchantId!), "RESERVATION_CAMPAIGNS_ADDON", "Reservation campaigns", res))) return;
    const { ReservationCampaignsService } = await import("@/services/reservation-campaigns.service");
    const campaign = await ReservationCampaignsService.save(req.merchantId!, req.body || {});
    res.json({ success: true, campaign });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.get("/ai-coach/brief", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasAiCoachLicense(req.merchantId!), "AI_COACH_ADDON", "AI insights coach", res))) return;
    const { AiCoachService } = await import("@/services/ai-coach.service");
    const brief = await AiCoachService.getBrief(req.merchantId!, {
      refresh: req.query.refresh === "1" || req.query.refresh === "true",
    });
    res.json({ success: true, brief });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.post("/ai-coach/refresh", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasAiCoachLicense(req.merchantId!), "AI_COACH_ADDON", "AI insights coach", res))) return;
    const { AiCoachService } = await import("@/services/ai-coach.service");
    const brief = await AiCoachService.regenerate(req.merchantId!);
    res.json({ success: true, brief });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.get("/google-reputation/settings", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasGoogleReputationLicense(req.merchantId!), "GOOGLE_REPUTATION_ADDON", "Google reputation", res))) return;
    const { GoogleReputationService } = await import("@/services/google-reputation.service");
    const settings = await GoogleReputationService.getSettings(req.merchantId!);
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.put("/google-reputation/settings", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasGoogleReputationLicense(req.merchantId!), "GOOGLE_REPUTATION_ADDON", "Google reputation", res))) return;
    const { GoogleReputationService } = await import("@/services/google-reputation.service");
    const settings = await GoogleReputationService.updateSettings(req.merchantId!, req.body?.settings || req.body);
    res.json({ success: true, settings });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.post("/google-reputation/reviews", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasGoogleReputationLicense(req.merchantId!), "GOOGLE_REPUTATION_ADDON", "Google reputation", res))) return;
    const { GoogleReputationService } = await import("@/services/google-reputation.service");
    const result = await GoogleReputationService.addReview(req.merchantId!, req.body || {});
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.post("/google-reputation/reviews/:reviewId/draft-reply", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasGoogleReputationLicense(req.merchantId!), "GOOGLE_REPUTATION_ADDON", "Google reputation", res))) return;
    const { GoogleReputationService } = await import("@/services/google-reputation.service");
    const settings = await GoogleReputationService.draftReplyForReview(req.merchantId!, req.params.reviewId);
    res.json({ success: true, settings });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.post("/google-reputation/reviews/:reviewId/mark-replied", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasGoogleReputationLicense(req.merchantId!), "GOOGLE_REPUTATION_ADDON", "Google reputation", res))) return;
    const { GoogleReputationService } = await import("@/services/google-reputation.service");
    const settings = await GoogleReputationService.markReplied(req.merchantId!, req.params.reviewId);
    res.json({ success: true, settings });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.get("/ai-web-seo/settings", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasAiWebSeoLicense(req.merchantId!), "AI_WEB_SEO_ADDON", "AI website & SEO", res))) return;
    const { AiWebSeoService } = await import("@/services/ai-web-seo.service");
    const settings = await AiWebSeoService.getSettings(req.merchantId!);
    res.json({ success: true, settings });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.put("/ai-web-seo/settings", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasAiWebSeoLicense(req.merchantId!), "AI_WEB_SEO_ADDON", "AI website & SEO", res))) return;
    const { AiWebSeoService } = await import("@/services/ai-web-seo.service");
    const settings = await AiWebSeoService.updateSettings(req.merchantId!, req.body?.settings || req.body);
    res.json({ success: true, settings });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

router.post("/ai-web-seo/scan", async (req: Request, res: Response) => {
  try {
    if (!(await denyUnless(() => merchantHasAiWebSeoLicense(req.merchantId!), "AI_WEB_SEO_ADDON", "AI website & SEO", res))) return;
    const { AiWebSeoService } = await import("@/services/ai-web-seo.service");
    const settings = await AiWebSeoService.runScan(req.merchantId!);
    res.json({ success: true, settings });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Failed" });
  }
});

export default router;
