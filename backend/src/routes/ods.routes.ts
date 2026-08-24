import { Router, Request, Response } from "express";
import { verifyToken, requireMerchantAccess, setMerchantContext } from "@/middleware/auth.middleware";
import { OdsService, OdsLicenseError } from "@/services/ods.service";

const router = Router();

function handleError(res: Response, error: unknown, fallback: string) {
  if (error instanceof OdsLicenseError) {
    return res.status(403).json({ error: error.message, code: error.code });
  }
  const msg = error instanceof Error ? error.message : fallback;
  return res.status(400).json({ error: msg });
}

/** Public ODS customer display — token in URL, no JWT */
router.get("/:token/board", async (req: Request, res: Response) => {
  try {
    const data = await OdsService.boardForToken(req.params.token);
    res.json({ success: true, ...data });
  } catch (error) {
    if (error instanceof OdsLicenseError) {
      return res.status(403).json({ error: error.message, code: error.code });
    }
    res.status(404).json({ error: error instanceof Error ? error.message : "ODS not found" });
  }
});

/** Merchant-authenticated ODS management */
const merchantRouter = Router();
merchantRouter.use(verifyToken);
merchantRouter.use(requireMerchantAccess);
merchantRouter.use(setMerchantContext);

merchantRouter.get("/displays", async (req: Request, res: Response) => {
  try {
    const displays = await OdsService.listDisplays(req.merchantId!);
    res.json({ success: true, displays });
  } catch (error) {
    handleError(res, error, "Failed");
  }
});

merchantRouter.post("/displays", async (req: Request, res: Response) => {
  try {
    const display = await OdsService.createDisplay(req.merchantId!, req.body || {});
    res.status(201).json({ success: true, display });
  } catch (error) {
    handleError(res, error, "Failed");
  }
});

merchantRouter.put("/displays/:id", async (req: Request, res: Response) => {
  try {
    const display = await OdsService.updateDisplay(req.merchantId!, req.params.id, req.body || {});
    res.json({ success: true, display });
  } catch (error) {
    handleError(res, error, "Failed");
  }
});

merchantRouter.delete("/displays/:id", async (req: Request, res: Response) => {
  try {
    await OdsService.deleteDisplay(req.merchantId!, req.params.id);
    res.json({ success: true });
  } catch (error) {
    handleError(res, error, "Failed");
  }
});

merchantRouter.post("/displays/:id/rotate-token", async (req: Request, res: Response) => {
  try {
    const display = await OdsService.rotateToken(req.merchantId!, req.params.id);
    res.json({ success: true, display });
  } catch (error) {
    handleError(res, error, "Failed");
  }
});

merchantRouter.post("/push", async (req: Request, res: Response) => {
  try {
    const result = await OdsService.pushOrder(req.merchantId!, req.body || {});
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, "Failed");
  }
});

merchantRouter.post("/dismiss", async (req: Request, res: Response) => {
  try {
    const orderNumber = String(req.body?.orderNumber || "").trim();
    const result = await OdsService.dismissOrder(req.merchantId!, orderNumber);
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, "Failed");
  }
});

merchantRouter.post("/clear-all", async (req: Request, res: Response) => {
  try {
    const result = await OdsService.clearAllOrders(req.merchantId!);
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, "Failed");
  }
});

export { merchantRouter as odsMerchantRoutes };
export default router;
