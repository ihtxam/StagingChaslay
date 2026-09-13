import { Router, Request, Response } from "express";
import { verifyToken, requireMerchantAccess, setMerchantContext } from "@/middleware/auth.middleware";
import { CdsService } from "@/services/cds.service";

const router = Router();

function handleError(res: Response, error: unknown, fallback: string, status = 400) {
  const message = error instanceof Error ? error.message : fallback;
  if (message.toLowerCase().includes("not found") || message.toLowerCase().includes("disabled")) {
    return res.status(404).json({ error: message });
  }
  return res.status(status).json({ error: message });
}

/** Public CDS config — token in URL, no JWT */
router.get("/:token/config", async (req: Request, res: Response) => {
  try {
    const data = await CdsService.configForToken(req.params.token);
    res.json({ success: true, ...data });
  } catch (error) {
    handleError(res, error, "Failed to load customer display config", 500);
  }
});

export default router;

/** Merchant-authenticated CDS settings */
export const cdsMerchantRouter = Router();
cdsMerchantRouter.use(verifyToken);
cdsMerchantRouter.use(requireMerchantAccess);
cdsMerchantRouter.use(setMerchantContext);

cdsMerchantRouter.get("/settings", async (req: Request, res: Response) => {
  try {
    const settings = await CdsService.getSettings(req.merchantId!);
    res.json({ success: true, settings });
  } catch (error) {
    handleError(res, error, "Failed to load customer display settings", 500);
  }
});

cdsMerchantRouter.put("/settings", async (req: Request, res: Response) => {
  try {
    const settings = await CdsService.updateSettings(req.merchantId!, req.body?.settings);
    res.json({ success: true, settings });
  } catch (error) {
    handleError(res, error, "Failed to save customer display settings");
  }
});

cdsMerchantRouter.post("/settings/rotate-token", async (req: Request, res: Response) => {
  try {
    const settings = await CdsService.rotateToken(req.merchantId!);
    res.json({ success: true, settings });
  } catch (error) {
    handleError(res, error, "Failed to rotate token");
  }
});
