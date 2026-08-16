import { Router, Request, Response } from "express";
import { requireChaslayApiKey } from "@/middleware/chaslay-api-key.middleware";
import {
  PosSessionsService,
  type PosSessionKind,
  type PosSessionPlatform,
} from "@/services/pos-sessions.service";

const router = Router();

router.use(requireChaslayApiKey);

/** POST /v1/pos/sessions/register — Android main / waiter register */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const merchantId = req.chaslayMerchantId!;
    const body = req.body || {};
    const sessionKind = (body.sessionKind === "waiter" ? "waiter" : "main") as PosSessionKind;
    const platform = "android" as PosSessionPlatform;
    const result = await PosSessionsService.registerSession(merchantId, {
      sessionKind,
      platform,
      deviceId: String(body.deviceId || ""),
      deviceLabel: body.deviceLabel ? String(body.deviceLabel) : null,
      staffId: body.staffId ? String(body.staffId) : null,
      staffName: body.staffName ? String(body.staffName) : null,
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to register POS session",
    });
  }
});

/** POST /v1/pos/sessions/heartbeat */
router.post("/heartbeat", async (req: Request, res: Response) => {
  try {
    const merchantId = req.chaslayMerchantId!;
    const sessionId = String(req.body?.sessionId || "");
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    const result = await PosSessionsService.heartbeat(merchantId, sessionId);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(410).json({
      error: error instanceof Error ? error.message : "Session expired",
      code: "POS_SESSION_EXPIRED",
    });
  }
});

/** POST /v1/pos/sessions/revoke — logout / app background */
router.post("/revoke", async (req: Request, res: Response) => {
  try {
    const merchantId = req.chaslayMerchantId!;
    const sessionId = req.body?.sessionId ? String(req.body.sessionId) : "";
    if (sessionId) {
      await PosSessionsService.revokeSession(merchantId, sessionId);
    } else if (req.body?.deviceId) {
      const kind =
        req.body?.sessionKind === "waiter" ? ("waiter" as const) : ("main" as const);
      await PosSessionsService.revokeByDevice(
        merchantId,
        String(req.body.deviceId),
        kind
      );
    } else {
      return res.status(400).json({ error: "sessionId or deviceId required" });
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to revoke session",
    });
  }
});

export default router;
