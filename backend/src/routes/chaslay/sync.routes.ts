import { Router, Request, Response } from "express";
import { requireChaslayApiKey } from "@/middleware/chaslay-api-key.middleware";
import { ChaslayCompatService } from "@/services/chaslay-compat.service";
import { handleChaslayPosDiagnosticPost } from "@/routes/chaslay/pos-diagnostics.handler";

const router = Router();

router.use(requireChaslayApiKey);

router.get("/bootstrap", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayCompatService.syncBootstrap(req.chaslayMerchantId!);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Bootstrap failed" });
  }
});

router.get("/menu", async (req: Request, res: Response) => {
  try {
    const since = Number(req.query.since || 0);
    const data = await ChaslayCompatService.syncMenuChanges(req.chaslayMerchantId!, since);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Menu sync failed" });
  }
});

/** Push local POS catalog → merchant panel (two-way menu sync). */
router.post("/push-catalog", async (req: Request, res: Response) => {
  try {
    const { SyncService } = await import("@/services/sync.service");
    const data = await SyncService.pushCatalog(req.chaslayMerchantId!, req.body || {});
    res.json({ ok: true, serverTime: Date.now(), ...data });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Catalog push failed" });
  }
});

router.get("/payment-config", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayCompatService.getPaymentConfig(req.chaslayMerchantId!);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Payment config sync failed" });
  }
});

/** Active reservations window for native POS (read-only list + floor table hints). */
router.get("/reservations", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayCompatService.syncReservations(req.chaslayMerchantId!);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Reservation sync failed" });
  }
});

/** Toggle reservations module from native POS settings (sync API key). */
router.put("/reservations/config", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayCompatService.updateReservationsModule(req.chaslayMerchantId!, {
      enabled: req.body?.enabled,
    });
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update reservations" });
  }
});

/** Host actions: accept, seat, cancel, reject, complete, no_show, promote_waitlist, … */
router.post("/reservations/:id/action", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayCompatService.reservationHostAction(
      req.chaslayMerchantId!,
      req.params.id,
      String(req.body?.action || ""),
      {
        tableId: req.body?.tableId,
        internalNotes: req.body?.internalNotes,
        cancelReason: req.body?.cancelReason,
        sendRejectionEmail: req.body?.sendRejectionEmail,
      }
    );
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Reservation action failed" });
  }
});

/** Live cart state for native POS customer display (Sunmi rear screen polls cloud). */
router.post("/cds/push", async (req: Request, res: Response) => {
  try {
    const { CdsService } = await import("@/services/cds.service");
    const raw = req.body?.state ?? req.body;
    const state = await CdsService.pushLiveState(req.chaslayMerchantId!, raw);
    res.json({ ok: true, state });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "CDS push failed" });
  }
});

router.post("/terminals", async (req: Request, res: Response) => {
  try {
    const data = await ChaslayCompatService.pushTerminalsFromDevice(req.chaslayMerchantId!, req.body || {});
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Terminal sync failed" });
  }
});

router.get("/staff", async (req: Request, res: Response) => {
  try {
    const { StaffService } = await import("@/services/staff.service");
    const data = await StaffService.getSyncPayload(req.chaslayMerchantId!);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Staff sync failed" });
  }
});

router.post("/staff/verify-pin", async (req: Request, res: Response) => {
  try {
    const { StaffService } = await import("@/services/staff.service");
    const staff = await StaffService.verifyPin(req.chaslayMerchantId!, String(req.body?.pin || ""));
    res.json({ success: true, staff });
  } catch (error) {
    res.status(403).json({ error: error instanceof Error ? error.message : "Invalid PIN" });
  }
});

/**
 * GET /v1/sync/reports/profit-margin
 * Cloud profit & margin (same engine as merchant dashboard). Sync API key auth.
 * Query: preset, granularity=day|week|month, staffId (optional — scope to one staff member).
 */
router.get("/reports/profit-margin", async (req: Request, res: Response) => {
  try {
    const preset = String(req.query.preset || "today") as import("@/services/pos-reports.service").ReportPreset;
    const staffId = req.query.staffId ? String(req.query.staffId) : null;
    const { ProfitMarginService } = await import("@/services/profit-margin.service");
    const report = await ProfitMarginService.getProfitMarginReport(req.chaslayMerchantId!, {
      preset,
      from: req.query.from ? String(req.query.from) : undefined,
      to: req.query.to ? String(req.query.to) : undefined,
      granularity: req.query.granularity ? String(req.query.granularity) : undefined,
      staffId,
    });
    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load profit margin report",
    });
  }
});

/** Android POS crash/error logs — superadmin System Logs (+ support ticket when manual). */
router.post("/diagnostic-report", handleChaslayPosDiagnosticPost);
router.post("/diagnostics", handleChaslayPosDiagnosticPost);
router.post("/pos-logs", handleChaslayPosDiagnosticPost);

export default router;
