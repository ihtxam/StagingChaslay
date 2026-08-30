import { Router, Request, Response } from "express";
import { verifyToken, requireMerchantAccess, setMerchantContext } from "@/middleware/auth.middleware";
import {
  PosSessionsService,
  type PosSessionKind,
  type PosSessionPlatform,
} from "@/services/pos-sessions.service";

const router = Router();

router.use(verifyToken);
router.use(requireMerchantAccess);
router.use(setMerchantContext);

/** GET /api/merchant/pos/sessions — active main + waiter stations */
router.get("/pos/sessions", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) {
      return res.status(400).json({ error: "Merchant ID is required" });
    }
    const [main, waiter, limits] = await Promise.all([
      PosSessionsService.listActive(merchantId, "main"),
      PosSessionsService.listActive(merchantId, "waiter"),
      PosSessionsService.getLimits(merchantId),
    ]);
    res.json({
      success: true,
      limits,
      sessions: { main, waiter },
    });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list POS sessions",
    });
  }
});

/** POST /api/merchant/pos/sessions/register */
router.post("/pos/sessions/register", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const body = req.body || {};
    const sessionKind = (body.sessionKind === "waiter" ? "waiter" : "main") as PosSessionKind;
    const platform = String(body.platform || "webpos").slice(0, 30) as PosSessionPlatform;
    const result = await PosSessionsService.registerSession(merchantId, {
      sessionKind,
      platform,
      deviceId: String(body.deviceId || ""),
      deviceLabel: body.deviceLabel ? String(body.deviceLabel) : null,
      staffId: body.staffId ? String(body.staffId) : null,
      staffName: body.staffName ? String(body.staffName) : null,
      locationId: body.locationId ? String(body.locationId) : null,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    const err = error as Error & { statusCode?: number; code?: string };
    res.status(err.statusCode === 403 ? 403 : 400).json({
      error: error instanceof Error ? error.message : "Failed to register POS session",
      code: err.code,
    });
  }
});

/** POST /api/merchant/pos/sessions/heartbeat */
router.post("/pos/sessions/heartbeat", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    const sessionId = String(req.body?.sessionId || "");
    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }
    const result = await PosSessionsService.heartbeat(merchantId, sessionId, {
      printAgentOnline:
        typeof req.body?.printAgentOnline === "boolean"
          ? req.body.printAgentOnline
          : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(410).json({
      error: error instanceof Error ? error.message : "Session expired",
      code: "POS_SESSION_EXPIRED",
    });
  }
});

/** DELETE /api/merchant/pos/sessions/:id — kick a station */
router.delete("/pos/sessions/:id", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId!;
    if (req.user?.role === "staff") {
      const perms = req.user.permissions || [];
      if (!perms.includes("MANAGE_SETTINGS")) {
        return res.status(403).json({ error: "Permission denied" });
      }
    }
    await PosSessionsService.revokeSession(merchantId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to revoke session",
    });
  }
});

export default router;
