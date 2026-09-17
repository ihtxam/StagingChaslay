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

export default router;
