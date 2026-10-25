import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { SmsService } from "@/services/sms.service";
import { SmsMarketingService } from "@/services/sms-marketing.service";
import { SmsBillingService } from "@/services/sms-billing.service";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

router.get("/overview", async (req: Request, res: Response) => {
  try {
    const data = await SmsService.overview(req.merchantId!);
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.put("/settings", async (req: Request, res: Response) => {
  try {
    const licensed = await SmsService.isLicensed(req.merchantId!);
    if (!licensed) return res.status(403).json({ error: "SMS addon is not enabled" });
    const settings = await SmsService.updateSettings(req.merchantId!, req.body || {});
    res.json({ success: true, settings });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.get("/billing", async (req: Request, res: Response) => {
  try {
    const licensed = await SmsService.isLicensed(req.merchantId!);
    if (!licensed) return res.status(403).json({ error: "SMS addon is not enabled" });
    const month = String(req.query.month || "").trim() || undefined;
    const report = await SmsBillingService.getMonthlyReport(req.merchantId!, month);
    res.json({ success: true, report });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.get("/messages", async (req: Request, res: Response) => {
  try {
    const licensed = await SmsService.isLicensed(req.merchantId!);
    if (!licensed) return res.status(403).json({ error: "SMS addon is not enabled" });
    const messages = await SmsService.listMessages(req.merchantId!, Number(req.query.limit) || 50);
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.post("/test", async (req: Request, res: Response) => {
  try {
    const licensed = await SmsService.isLicensed(req.merchantId!);
    if (!licensed) return res.status(403).json({ error: "SMS addon is not enabled" });
    const to = String(req.body?.to || "");
    const body = String(req.body?.body || "Test SMS from Reborn");
    const result = await SmsService.send({
      merchantId: req.merchantId!,
      to,
      type: "transactional",
      event: "test",
      body,
      skipEventToggle: true,
    });
    if (!result.ok) {
      return res.status(400).json({
        error:
          result.reason === "quota_exceeded"
            ? "Monthly SMS allowance reached"
            : result.reason === "esendex_not_configured"
              ? "Esendex is not configured"
              : result.reason,
        result,
      });
    }
    res.json({ success: true, result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.get("/audience", async (req: Request, res: Response) => {
  try {
    const licensed = await SmsService.isLicensed(req.merchantId!);
    if (!licensed) return res.status(403).json({ error: "SMS addon is not enabled" });
    const audience = await SmsMarketingService.listAudience(req.merchantId!);
    res.json({ success: true, audience });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.get("/campaigns", async (req: Request, res: Response) => {
  try {
    const licensed = await SmsService.isLicensed(req.merchantId!);
    if (!licensed) return res.status(403).json({ error: "SMS addon is not enabled" });
    const campaigns = await SmsMarketingService.listCampaigns(req.merchantId!);
    res.json({ success: true, campaigns });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.post("/campaigns", async (req: Request, res: Response) => {
  try {
    const campaign = await SmsMarketingService.saveCampaign(req.merchantId!, req.body || {});
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.post("/campaigns/:id/send", async (req: Request, res: Response) => {
  try {
    const campaign = await SmsMarketingService.sendCampaign(req.merchantId!, req.params.id, {
      audience: req.body?.audience,
      selectedPhones: req.body?.selectedPhones,
    });
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to send" });
  }
});

router.post("/inbox/process", async (req: Request, res: Response) => {
  try {
    const licensed = await SmsService.isLicensed(req.merchantId!);
    if (!licensed) return res.status(403).json({ error: "SMS addon is not enabled" });
    const result = await SmsService.processInbox(req.merchantId!);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

export default router;
