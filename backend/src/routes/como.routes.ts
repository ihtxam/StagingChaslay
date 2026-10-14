import { Router, Request, Response } from "express";
import { verifyToken, requireMerchantAccess, setMerchantContext } from "@/middleware/auth.middleware";
import { ComoService, type ComoSessionInput } from "@/services/como.service";
const router = Router();
router.use(verifyToken);
router.use(requireMerchantAccess);
router.use(setMerchantContext);

function sessionFromBody(body: Record<string, unknown>, channel: "pos" | "kiosk"): ComoSessionInput {
  return {
    identifier: body.identifier != null ? String(body.identifier) : undefined,
    phone: body.phone != null ? String(body.phone) : undefined,
    email: body.email != null ? String(body.email) : undefined,
    membershipKey: body.membershipKey != null ? String(body.membershipKey) : undefined,
    transactionId: body.transactionId != null ? String(body.transactionId) : undefined,
    orderType: body.orderType != null ? String(body.orderType) : channel,
    items: Array.isArray(body.items) ? (body.items as ComoSessionInput["items"]) : [],
    totalMajor: body.totalMajor != null ? Number(body.totalMajor) : undefined,
    assetKeys: Array.isArray(body.assetKeys)
      ? (body.assetKeys as unknown[]).map((k) => String(k)).filter(Boolean)
      : undefined,
    channel,
    orderId: body.orderId != null ? String(body.orderId) : undefined,
    confirmation: body.confirmation != null ? String(body.confirmation) : undefined,
  } as ComoSessionInput & { orderId?: string; confirmation?: string };
}

router.get("/status", async (req: Request, res: Response) => {
  try {
    const pub = await ComoService.readPublic(req.merchantId!);
    res.json({ success: true, como: pub, ready: pub.configured });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to load Como status" });
  }
});

router.post("/test-connection", async (req: Request, res: Response) => {
  try {
    const result = await ComoService.testConnection(req.merchantId!);
    if (!result.ok) return res.status(400).json(result);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Como connection test failed",
    });
  }
});

router.post("/identify", async (req: Request, res: Response) => {
  try {
    const data = await ComoService.identify(req.merchantId!, sessionFromBody(req.body || {}, "pos"));
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Como identify failed" });
  }
});

router.post("/benefits", async (req: Request, res: Response) => {
  try {
    const data = await ComoService.getBenefits(req.merchantId!, sessionFromBody(req.body || {}, "pos"));
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Como benefits failed" });
  }
});

router.post("/submit", async (req: Request, res: Response) => {
  try {
    const data = await ComoService.submitPurchase(
      req.merchantId!,
      sessionFromBody(req.body || {}, "pos")
    );
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Como submit failed" });
  }
});

router.post("/void", async (req: Request, res: Response) => {
  try {
    const data = await ComoService.voidPurchase(
      req.merchantId!,
      sessionFromBody(req.body || {}, "pos")
    );
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Como void failed" });
  }
});

export default router;
