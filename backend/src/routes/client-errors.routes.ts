import { Router, type Request, type Response } from "express";
import { PlatformLogService } from "@/services/platform-log.service";

const router = Router();

/** Merchant / waiter / WebPOS client errors — visible in superadmin System Logs. */
router.post("/", async (req: Request, res: Response) => {
  try {
    const merchantId = req.merchantId;
    if (!merchantId) return res.status(400).json({ error: "Merchant ID is required" });

    const errors = Array.isArray(req.body?.errors) ? req.body.errors : [];
    if (!errors.length) return res.json({ success: true, written: 0 });

    let written = 0;
    for (const raw of errors.slice(0, 30)) {
      const message = String(raw?.message || "").trim().slice(0, 2000);
      if (!message) continue;
      const level = String(raw?.level || "error").toLowerCase() === "warn" ? "warn" : "error";
      await PlatformLogService.write({
        level,
        category: "client_error",
        message,
        merchantId,
        actorRole: "merchant",
        actorId: req.user?.id || null,
        metadata: {
          source: String(raw?.source || "client").slice(0, 80),
          path: String(raw?.path || "").slice(0, 512),
          actorRole: req.user?.role || null,
          actorEmail: req.user?.email || null,
          actorDisplayName: req.user?.name || null,
          // Legacy key — for merchant owners this is merchant.name (store), not POS staff.
          staffId: req.user?.staffId || null,
          staffName: req.user?.role === "staff" ? req.user?.name || null : null,
          merchantDisplayName:
            req.user?.role === "merchant" ? req.user?.name || null : null,
          ...(raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : {}),
        },
      });
      written += 1;
    }

    res.json({ success: true, written });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to record client errors",
    });
  }
});

export default router;
