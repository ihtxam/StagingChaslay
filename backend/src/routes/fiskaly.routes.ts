import { Router, Request, Response } from "express";
import { verifyToken, requireMerchantAccess, setMerchantContext } from "@/middleware/auth.middleware";
import { FiskalyService } from "@/services/fiskaly.service";

const router = Router();
router.use(verifyToken);
router.use(requireMerchantAccess);
router.use(setMerchantContext);

/**
 * POST /api/merchant/fiskaly/test-connection
 * Body: { country: 'DE' | 'FR' }
 */
router.post("/test-connection", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const country = String(req.body?.country || "").trim().toUpperCase();
    if (country !== "DE" && country !== "FR") {
      return res.status(400).json({ error: "country must be DE or FR" });
    }
    await FiskalyService.testConnection(merchantId, country);
    res.json({ ok: true, country });
  } catch (error) {
    console.error("[fiskaly] test-connection failed:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Fiskaly connection test failed",
    });
  }
});

/**
 * POST /api/merchant/fiskaly/provision-de
 * Creates cloud TSS + client from saved API credentials (Germany only).
 */
router.post("/provision-de", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const clientSerial =
      req.body?.clientSerial != null ? String(req.body.clientSerial).trim().slice(0, 70) : undefined;
    const description =
      req.body?.description != null ? String(req.body.description).trim().slice(0, 255) : undefined;
    const fiskalySettings = await FiskalyService.provisionDe(merchantId, {
      clientSerial: clientSerial || undefined,
      description: description || undefined,
    });
    res.json({ ok: true, fiskalySettings });
  } catch (error) {
    console.error("[fiskaly] provision-de failed:", error);
    res.status(400).json({
      error: error instanceof Error ? error.message : "Fiskaly DE provisioning failed",
    });
  }
});

export default router;
