import { Router, Request, Response } from "express";
import { verifyToken, requireMerchantAccess, setMerchantContext } from "@/middleware/auth.middleware";
import { requireRestaurantModule } from "@/middleware/business-module.middleware";
import { SignageLicenseError, SignageService } from "@/services/signage.service";

const router = Router();

function sendError(res: Response, error: unknown, fallback: string) {
  if (error instanceof SignageLicenseError) {
    return res.status(403).json({ error: error.message, code: "SIGNAGE_ADDON_REQUIRED" });
  }
  const message = error instanceof Error ? error.message : fallback;
  const status = /not found|invalid screen/i.test(message) ? 404 : 400;
  return res.status(status).json({ error: message });
}

/** Public TV player — token in URL, no JWT */
router.get("/:token", async (req: Request, res: Response) => {
  try {
    const data = await SignageService.playerForToken(req.params.token);
    res.json({ success: true, ...data });
  } catch (error) {
    sendError(res, error, "Screen not found");
  }
});

const merchantRouter = Router();
merchantRouter.use(verifyToken);
merchantRouter.use(requireMerchantAccess);
merchantRouter.use(setMerchantContext);
merchantRouter.use(requireRestaurantModule);

merchantRouter.get("/overview", async (req: Request, res: Response) => {
  try {
    const overview = await SignageService.overview(req.merchantId!);
    res.json({ success: true, ...overview });
  } catch (error) {
    sendError(res, error, "Failed");
  }
});

merchantRouter.get("/screens", async (req: Request, res: Response) => {
  try {
    const overview = await SignageService.overview(req.merchantId!);
    const screens = overview.enabled ? await SignageService.listScreens(req.merchantId!) : [];
    res.json({ success: true, screens, ...overview });
  } catch (error) {
    sendError(res, error, "Failed");
  }
});

merchantRouter.post("/screens", async (req: Request, res: Response) => {
  try {
    const screen = await SignageService.createScreen(req.merchantId!, req.body || {});
    res.status(201).json({ success: true, screen });
  } catch (error) {
    sendError(res, error, "Failed");
  }
});

merchantRouter.put("/screens/:id", async (req: Request, res: Response) => {
  try {
    const screen = await SignageService.updateScreen(req.merchantId!, req.params.id, req.body || {});
    res.json({ success: true, screen });
  } catch (error) {
    sendError(res, error, "Failed");
  }
});

merchantRouter.delete("/screens/:id", async (req: Request, res: Response) => {
  try {
    await SignageService.deleteScreen(req.merchantId!, req.params.id);
    res.json({ success: true });
  } catch (error) {
    sendError(res, error, "Failed");
  }
});

merchantRouter.post("/screens/:id/rotate-token", async (req: Request, res: Response) => {
  try {
    const screen = await SignageService.rotateToken(req.merchantId!, req.params.id);
    res.json({ success: true, screen });
  } catch (error) {
    sendError(res, error, "Failed");
  }
});

merchantRouter.get("/playlists", async (req: Request, res: Response) => {
  try {
    const playlists = await SignageService.listPlaylists(req.merchantId!);
    res.json({ success: true, playlists });
  } catch (error) {
    sendError(res, error, "Failed");
  }
});

merchantRouter.post("/playlists", async (req: Request, res: Response) => {
  try {
    const playlist = await SignageService.createPlaylist(req.merchantId!, req.body || {});
    res.status(201).json({ success: true, playlist });
  } catch (error) {
    sendError(res, error, "Failed");
  }
});

merchantRouter.put("/playlists/:id", async (req: Request, res: Response) => {
  try {
    const playlist = await SignageService.updatePlaylist(req.merchantId!, req.params.id, req.body || {});
    res.json({ success: true, playlist });
  } catch (error) {
    sendError(res, error, "Failed");
  }
});

merchantRouter.delete("/playlists/:id", async (req: Request, res: Response) => {
  try {
    await SignageService.deletePlaylist(req.merchantId!, req.params.id);
    res.json({ success: true });
  } catch (error) {
    sendError(res, error, "Failed");
  }
});

merchantRouter.post("/playlists/:id/slides", async (req: Request, res: Response) => {
  try {
    const slide = await SignageService.createSlide(req.merchantId!, req.params.id, req.body || {});
    res.status(201).json({ success: true, slide });
  } catch (error) {
    sendError(res, error, "Failed");
  }
});

merchantRouter.put("/slides/:id", async (req: Request, res: Response) => {
  try {
    const slide = await SignageService.updateSlide(req.merchantId!, req.params.id, req.body || {});
    res.json({ success: true, slide });
  } catch (error) {
    sendError(res, error, "Failed");
  }
});

merchantRouter.delete("/slides/:id", async (req: Request, res: Response) => {
  try {
    await SignageService.deleteSlide(req.merchantId!, req.params.id);
    res.json({ success: true });
  } catch (error) {
    sendError(res, error, "Failed");
  }
});

merchantRouter.get("/catalog", async (req: Request, res: Response) => {
  try {
    const data = await SignageService.listCatalog(req.merchantId!);
    res.json({ success: true, ...data });
  } catch (error) {
    sendError(res, error, "Failed");
  }
});

export { merchantRouter as signageMerchantRoutes };
export default router;
