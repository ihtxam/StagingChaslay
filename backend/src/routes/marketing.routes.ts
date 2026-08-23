import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { MarketingService } from "@/services/marketing.service";
import { EmailService } from "@/services/email.service";
import { getDb, schema } from "@/db";
import { eq } from "drizzle-orm";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

/**
 * GET /api/merchant/marketing/audience
 */
router.get("/audience", async (req: Request, res: Response) => {
  try {
    const audience = await MarketingService.listAudience(req.merchantId!);
    res.json({ success: true, audience });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/merchant/marketing/campaigns
 */
router.get("/campaigns", async (req: Request, res: Response) => {
  try {
    const campaigns = await MarketingService.listCampaigns(req.merchantId!);
    res.json({ success: true, campaigns });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/merchant/marketing/campaigns — create/update draft
 */
router.post("/campaigns", async (req: Request, res: Response) => {
  try {
    const campaign = await MarketingService.saveCampaign(req.merchantId!, {
      id: req.body.id,
      title: req.body.title,
      subject: req.body.subject,
      bodyHtml: req.body.bodyHtml,
      designJson: req.body.designJson ?? null,
      audience: req.body.audience,
      selectedEmails: req.body.selectedEmails,
    });
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/merchant/marketing/campaigns/:id/send
 */
router.post("/campaigns/:id/send", async (req: Request, res: Response) => {
  try {
    const campaign = await MarketingService.sendCampaign(req.merchantId!, req.params.id, {
      audience: req.body.audience,
      selectedEmails: req.body.selectedEmails,
    });
    res.json({ success: true, campaign });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to send" });
  }
});

/**
 * GET /api/merchant/marketing/email-status
 */
router.get("/email-status", async (req: Request, res: Response) => {
  try {
    const status = await EmailService.status(req.merchantId!);
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/merchant/marketing/brevo-usage
 * Local daily/monthly counters + live Brevo account credits (when API key set).
 */
router.get("/brevo-usage", async (req: Request, res: Response) => {
  try {
    const usage = await EmailService.getMerchantBrevoUsage(req.merchantId!);
    res.json({ success: true, usage });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Failed";
    const needsMigrate =
      /email_brevo_settings/i.test(raw) && /does not exist|column/i.test(raw);
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
router.post("/test-email", async (req: Request, res: Response) => {
  try {
    const to = String(req.body.to || "").trim();
    if (!to.includes("@")) return res.status(400).json({ error: "Valid email required" });
    const db = getDb();
    const merchant = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, req.merchantId!),
    });
    await EmailService.send({
      merchantId: req.merchantId!,
      to,
      subject: `Test email from ${merchant?.name || "ChaslayReborn"}`,
      html: `<p>This is a test message from your SMTP / email settings.</p><p>${new Date().toISOString()}</p>`,
      emailType: "marketing_test",
    });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Send failed" });
  }
});

/**
 * GET /api/merchant/marketing/platform-email-usage
 */
router.get("/platform-email-usage", async (req: Request, res: Response) => {
  try {
    const { EmailUsageService } = await import("@/services/email-usage.service");
    const usage = await EmailUsageService.getMerchantPlatformUsage(req.merchantId!);
    res.json({ success: true, usage });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load platform email usage",
    });
  }
});

export default router;
