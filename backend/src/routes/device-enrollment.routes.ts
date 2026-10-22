import { Router, Request, Response } from "express";
import { requirePermission } from "@/middleware/auth.middleware";
import { DeviceEnrollmentService } from "@/services/device-enrollment.service";

const router = Router();

/** POS / desktop runtime config for the current device. */
router.get("/device-config", async (req: Request, res: Response) => {
  try {
    const deviceId = String(req.query.deviceId || "").trim();
    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }
    const config = await DeviceEnrollmentService.getDeviceConfig(req.merchantId!, deviceId);
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load device config",
    });
  }
});

router.get("/", requirePermission("MANAGE_SETTINGS"), async (req: Request, res: Response) => {
  try {
    const enrollments = await DeviceEnrollmentService.list(req.merchantId!);
    res.json({ success: true, enrollments });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to list device enrollments",
    });
  }
});

router.post("/", requirePermission("MANAGE_SETTINGS"), async (req: Request, res: Response) => {
  try {
    const staffId = req.user?.staffId || null;
    const enrollment = await DeviceEnrollmentService.enroll(req.merchantId!, staffId, {
      deviceId: String(req.body?.deviceId || ""),
      locationId: String(req.body?.locationId || ""),
      stationId: req.body?.stationId ?? null,
      paymentProfileId: String(req.body?.paymentProfileId || ""),
      paymentTerminalId: String(req.body?.paymentTerminalId || ""),
      printSnapshot:
        req.body?.printSnapshot && typeof req.body.printSnapshot === "object"
          ? req.body.printSnapshot
          : undefined,
      lockEnrollment: req.body?.lockEnrollment,
    });
    res.status(201).json({ success: true, enrollment });
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to enroll device",
    });
  }
});

router.delete(
  "/:deviceId",
  requirePermission("MANAGE_SETTINGS"),
  async (req: Request, res: Response) => {
    try {
      await DeviceEnrollmentService.remove(req.merchantId!, req.params.deviceId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Failed to remove enrollment",
      });
    }
  }
);

export default router;
