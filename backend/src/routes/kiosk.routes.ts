import { Router, Request, Response } from "express";
import { verifyToken, requireMerchantAccess, setMerchantContext } from "@/middleware/auth.middleware";
import { readKioskAddonEnabled, writeKioskAddonEnabled } from "@/lib/kiosk-addon";
import { KioskLicenseError, KioskService } from "@/services/kiosk.service";

const router = Router();

function handleError(res: Response, error: unknown, fallback: string, status = 400) {
  if (error instanceof KioskLicenseError) {
    return res.status(403).json({ error: error.message, code: error.code });
  }
  const message = error instanceof Error ? error.message : fallback;
  if (message.toLowerCase().includes("not found")) {
    return res.status(404).json({ error: message });
  }
  return res.status(status).json({ error: message });
}

/** Public kiosk config — token in URL, no JWT */
router.get("/:token/config", async (req: Request, res: Response) => {
  try {
    const data = await KioskService.getPublicConfig(req.params.token);
    res.json({ success: true, ...data });
  } catch (error) {
    handleError(res, error, "Failed to load kiosk config", 500);
  }
});

router.get("/:token/menu", async (req: Request, res: Response) => {
  try {
    const data = await KioskService.getMenu(req.params.token);
    res.json({ success: true, data: data.menu });
  } catch (error) {
    handleError(res, error, "Failed to load menu", 500);
  }
});

router.post("/:token/membership/lookup", async (req: Request, res: Response) => {
  try {
    const code = String(req.body?.code || "").trim();
    if (!code) return res.status(400).json({ error: "Membership code is required" });
    const card = await KioskService.lookupMembership(req.params.token, code);
    res.json({ success: true, card });
  } catch (error) {
    handleError(res, error, "Membership not found", 404);
  }
});

router.post("/:token/orders/:orderId/terminal-pay", async (req: Request, res: Response) => {
  try {
    const result = await KioskService.payOrderAtTerminal(req.params.token, req.params.orderId);
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, "Terminal payment failed");
  }
});

export default router;

/** Merchant-authenticated kiosk settings */
export const kioskMerchantRouter = Router();
kioskMerchantRouter.use(verifyToken);
kioskMerchantRouter.use(requireMerchantAccess);
kioskMerchantRouter.use(setMerchantContext);

kioskMerchantRouter.get("/settings", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const enabled = await readKioskAddonEnabled(merchantId);
    const settings = await KioskService.readSettingsForMerchant(merchantId);
    res.json({ success: true, enabled, settings });
  } catch (error) {
    handleError(res, error, "Failed to load kiosk settings", 500);
  }
});

kioskMerchantRouter.put("/settings", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const settings = await KioskService.writeSettingsForMerchant(merchantId, req.body?.settings);
    res.json({ success: true, settings });
  } catch (error) {
    handleError(res, error, "Failed to save kiosk settings");
  }
});

kioskMerchantRouter.post("/settings/regenerate-token", async (req: Request, res: Response) => {
  try {
    const settings = await KioskService.regenerateToken(req.merchantId!);
    res.json({ success: true, settings });
  } catch (error) {
    handleError(res, error, "Failed to regenerate token");
  }
});

kioskMerchantRouter.put("/addon", async (req: Request, res: Response) => {
  try {
    const enabled = await writeKioskAddonEnabled(req.merchantId!, !!req.body?.enabled);
    res.json({ success: true, enabled });
  } catch (error) {
    handleError(res, error, "Failed to update kiosk addon");
  }
});
