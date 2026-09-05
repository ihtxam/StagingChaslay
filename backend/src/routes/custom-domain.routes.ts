import { Router, Request, Response } from "express";
import { verifyToken, requireMerchant, setMerchantContext } from "@/middleware/auth.middleware";
import { CustomDomainService } from "@/services/custom-domain.service";

const router = Router();

router.use(verifyToken);
router.use(requireMerchant);
router.use(setMerchantContext);

/**
 * GET /api/merchant/custom-domain
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });

    const status = await CustomDomainService.getStatus(merchantId);
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load custom domain status",
    });
  }
});

/**
 * POST /api/merchant/custom-domain/start
 * Body: { domain: string }
 */
router.post("/start", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });

    const domain = String(req.body?.domain || "");
    const status = await CustomDomainService.startSetup(merchantId, domain);
    res.json({ success: true, status });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to start custom domain setup",
    });
  }
});

/**
 * POST /api/merchant/custom-domain/verify-dns
 */
router.post("/verify-dns", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });

    const status = await CustomDomainService.verifyDns(merchantId);
    res.json({ success: true, status });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "DNS verification failed",
    });
  }
});

/**
 * POST /api/merchant/custom-domain/refresh-ssl
 */
router.post("/refresh-ssl", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });

    const status = await CustomDomainService.refreshSsl(merchantId);
    res.json({ success: true, status });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "SSL check failed",
    });
  }
});

/**
 * DELETE /api/merchant/custom-domain
 */
router.delete("/", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });

    const status = await CustomDomainService.removeDomain(merchantId);
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to remove custom domain",
    });
  }
});

export default router;
