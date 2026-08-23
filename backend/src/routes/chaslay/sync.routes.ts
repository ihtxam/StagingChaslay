import { Router, Request, Response } from "express";
import { requireChaslayApiKey } from "@/middleware/chaslay-api-key.middleware";
import { ChaslayCompatService } from "@/services/chaslay-compat.service";

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
    res.status(401).json({ error: error instanceof Error ? error.message : "Invalid PIN" });
  }
});

/** Android POS crash/error logs — superadmin support inbox only. */
router.post("/diagnostic-report", async (req: Request, res: Response) => {
  try {
    const { SupportTicketService } = await import("@/services/support-ticket.service");
    const { subject, body, auto, deviceId, appVersion } = req.body || {};
    if (!subject?.trim() || !body?.trim()) {
      return res.status(400).json({ error: "Subject and body are required" });
    }
    const header = [
      "--- Chaslay Android POS diagnostics ---",
      JSON.stringify(
        {
          deviceId: deviceId ? String(deviceId).slice(0, 64) : null,
          appVersion: appVersion ? String(appVersion).slice(0, 64) : null,
          auto: auto === true || auto === "true",
        },
        null,
        2
      ),
      "--- Log ---",
    ].join("\n");
    const ticket = await SupportTicketService.createDiagnosticReport(req.chaslayMerchantId!, {
      source: "android",
      subject: String(subject).slice(0, 255),
      body: `${header}\n${String(body)}`,
      auto: auto === true || auto === "true",
      authorName: "Android POS",
    });
    res.json({ ok: true, ticketId: ticket.id });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to submit report" });
  }
});

export default router;
