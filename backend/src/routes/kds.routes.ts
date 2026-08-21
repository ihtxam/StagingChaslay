import { Router, Request, Response } from "express";
import { verifyToken, requireMerchantAccess, setMerchantContext } from "@/middleware/auth.middleware";
import { KdsService } from "@/services/kds.service";

const router = Router();

/** Public KDS display — token in URL, no JWT */
router.get("/:token/orders", async (req: Request, res: Response) => {
  try {
    const since = req.query.since ? String(req.query.since) : undefined;
    const data = await KdsService.listForToken(req.params.token, since);
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "KDS not found" });
  }
});

router.patch("/:token/items/:itemId/ready", async (req: Request, res: Response) => {
  try {
    const data = await KdsService.markItemReady(req.params.token, req.params.itemId);
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.patch("/:token/tickets/:ticketId/complete", async (req: Request, res: Response) => {
  try {
    const data = await KdsService.completeTicket(req.params.token, req.params.ticketId);
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

router.patch("/:token/tickets/:ticketId/recall", async (req: Request, res: Response) => {
  try {
    const data = await KdsService.recallTicket(req.params.token, req.params.ticketId);
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/** Merchant-authenticated KDS station management */
const merchantRouter = Router();
merchantRouter.use(verifyToken);
merchantRouter.use(requireMerchantAccess);
merchantRouter.use(setMerchantContext);

merchantRouter.get("/stations", async (req: Request, res: Response) => {
  try {
    const stations = await KdsService.listStations(req.merchantId!);
    res.json({ success: true, stations });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

merchantRouter.post("/stations", async (req: Request, res: Response) => {
  try {
    const station = await KdsService.createStation(req.merchantId!, req.body || {});
    res.status(201).json({ success: true, station });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

merchantRouter.put("/stations/:id", async (req: Request, res: Response) => {
  try {
    const station = await KdsService.updateStation(req.merchantId!, req.params.id, req.body || {});
    res.json({ success: true, station });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

merchantRouter.delete("/stations/:id", async (req: Request, res: Response) => {
  try {
    await KdsService.deleteStation(req.merchantId!, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

merchantRouter.post("/stations/:id/rotate-token", async (req: Request, res: Response) => {
  try {
    const station = await KdsService.rotateToken(req.merchantId!, req.params.id);
    res.json({ success: true, station });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

merchantRouter.post("/push", async (req: Request, res: Response) => {
  try {
    const result = await KdsService.pushKitchen(req.merchantId!, req.body || {});
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

merchantRouter.get("/ticket-status", async (req: Request, res: Response) => {
  try {
    const ticketKey = String(req.query.ticketKey || "").trim();
    if (!ticketKey) return res.status(400).json({ error: "ticketKey required" });
    const status = await KdsService.ticketStatusForPos(req.merchantId!, ticketKey);
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

export { merchantRouter as kdsMerchantRoutes };
export default router;
