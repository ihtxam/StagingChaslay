import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { merchantHasMarketingAutomationLicense } from "@/lib/marketing-automation-addon";
import { merchantHasSmartSegmentsLicense } from "@/lib/smart-segments-addon";
import { merchantHasReservationCampaignsLicense } from "@/lib/reservation-campaigns-addon";
import { merchantHasAiCoachLicense } from "@/lib/ai-coach-addon";

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

export default router;
