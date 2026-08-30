import { Router, Request, Response } from "express";
import multer from "multer";
import { verifyToken, requireMerchantAccess, setMerchantContext } from "@/middleware/auth.middleware";
import { readKioskAddonEnabled, writeKioskAddonEnabled } from "@/lib/kiosk-addon";
import { KioskLicenseError, KioskService } from "@/services/kiosk.service";
import { isAllowedImageMime, saveMerchantImage } from "@/services/media-upload.service";

const router = Router();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedImageMime(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"));
  },
});

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

router.post("/:token/verify-admin-pin", async (req: Request, res: Response) => {
  try {
    const pin = String(req.body?.pin || "").trim();
    const { merchant, settings } = await loadMerchantByTokenForDiagnostics(req.params.token);
    if (!KioskService.verifyAdminPin(settings, pin)) {
      return res.status(403).json({ error: "Invalid admin code" });
    }
    res.json({
      success: true,
      adminUrl: `/kiosk/${req.params.token}/admin`,
      merchantSlug: merchant.slug,
    });
  } catch (error) {
    handleError(res, error, "Verification failed");
  }
});

router.get("/:token/diagnostics", async (req: Request, res: Response) => {
  try {
    const { merchant } = await loadMerchantByTokenForDiagnostics(req.params.token);
    const diagnostics = await KioskService.getDiagnostics(merchant.id);
    res.json({ success: true, diagnostics });
  } catch (error) {
    handleError(res, error, "Failed to load diagnostics", 500);
  }
});

router.post("/:token/admin-settings", async (req: Request, res: Response) => {
  try {
    const pin = String(req.body?.pin || "").trim();
    const { merchant, settings } = await loadMerchantByTokenForDiagnostics(req.params.token);
    if (!KioskService.verifyAdminPin(settings, pin)) {
      return res.status(403).json({ error: "Invalid admin code" });
    }
    res.json({ success: true, settings });
  } catch (error) {
    handleError(res, error, "Failed to load admin settings", 500);
  }
});

router.put("/:token/admin-settings", async (req: Request, res: Response) => {
  try {
    const pin = String(req.body?.pin || "").trim();
    const { merchant, settings } = await loadMerchantByTokenForDiagnostics(req.params.token);
    if (!KioskService.verifyAdminPin(settings, pin)) {
      return res.status(403).json({ error: "Invalid admin code" });
    }
    const saved = await KioskService.writeSettingsForMerchant(merchant.id, req.body?.settings);
    res.json({ success: true, settings: saved });
  } catch (error) {
    handleError(res, error, "Failed to save kiosk settings");
  }
});

router.post("/:token/upload", (req: Request, res: Response, next) => {
  imageUpload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      return res.status(400).json({ error: message });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  try {
    const pin = String(req.body?.pin || "").trim();
    const { merchant, settings } = await loadMerchantByTokenForDiagnostics(req.params.token);
    if (!KioskService.verifyAdminPin(settings, pin)) {
      return res.status(403).json({ error: "Invalid admin code" });
    }
    if (!req.file) return res.status(400).json({ error: "No image file uploaded" });
    const saved = await saveMerchantImage({
      merchantId: merchant.id,
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
    });
    res.status(201).json({ success: true, url: saved.url });
  } catch (error) {
    handleError(res, error, "Upload failed");
  }
});

async function loadMerchantByTokenForDiagnostics(token: string) {
  const config = await KioskService.getPublicConfig(token);
  const settings = await KioskService.readSettingsForMerchant(config.merchant.id);
  return { merchant: config.merchant, settings };
}

export default router;

/** Merchant-authenticated kiosk settings */
export const kioskMerchantRouter = Router();
kioskMerchantRouter.use(verifyToken);
kioskMerchantRouter.use(requireMerchantAccess);
kioskMerchantRouter.use(setMerchantContext);

kioskMerchantRouter.get("/diagnostics", async (req: Request, res: Response) => {
  try {
    const diagnostics = await KioskService.getDiagnostics(req.merchantId!);
    res.json({ success: true, diagnostics });
  } catch (error) {
    handleError(res, error, "Failed to load diagnostics", 500);
  }
});

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
