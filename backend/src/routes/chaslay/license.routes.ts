import { Router, Request, Response } from "express";
import { ChaslayCompatService } from "@/services/chaslay-compat.service";
import { logPosLicenseActivation } from "@/lib/license-activation-log";

const router = Router();

router.post("/activate", async (req: Request, res: Response) => {
  const { deviceId, activationCode, appVersion, deviceModel, tenantSlug } = req.body ?? {};
  const resolvedTenantSlug = tenantSlug ?? req.header("X-Tenant-Slug");
  try {
    if (!deviceId || !activationCode) {
      const referenceId = await logPosLicenseActivation({
        outcome: "failure",
        deviceId: String(deviceId || ""),
        activationCode: String(activationCode || ""),
        errorMessage: "deviceId and activationCode are required",
        tenantSlug: resolvedTenantSlug,
        appVersion,
        deviceModel,
      });
      return res.status(400).json({
        error: "deviceId and activationCode are required",
        referenceId,
      });
    }
    const result = await ChaslayCompatService.activateLicense({
      deviceId,
      activationCode,
      appVersion,
      deviceModel,
      tenantSlug: resolvedTenantSlug,
    });
    await logPosLicenseActivation({
      outcome: "success",
      deviceId: String(deviceId),
      activationCode: String(activationCode),
      tenantSlug: result.tenantSlug,
      appVersion,
      deviceModel,
    });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Activation failed";
    const referenceId = await logPosLicenseActivation({
      outcome: "failure",
      deviceId: String(deviceId || ""),
      activationCode: String(activationCode || ""),
      errorMessage: message,
      tenantSlug: resolvedTenantSlug,
      appVersion,
      deviceModel,
    });
    res.status(400).json({ error: message, referenceId });
  }
});

/** Client-side activation failures (network, parse) before/during activate — no auth required. */
router.post("/report-error", async (req: Request, res: Response) => {
  try {
    const { deviceId, activationCode, errorMessage, appVersion, deviceModel, tenantSlug } = req.body ?? {};
    if (!deviceId || !errorMessage) {
      return res.status(400).json({ error: "deviceId and errorMessage are required" });
    }
    const referenceId = await logPosLicenseActivation({
      outcome: "failure",
      deviceId: String(deviceId),
      activationCode: String(activationCode || ""),
      errorMessage: String(errorMessage),
      tenantSlug: tenantSlug ?? req.header("X-Tenant-Slug"),
      appVersion,
      deviceModel,
      source: "android_client",
    });
    res.json({ ok: true, referenceId });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to record error" });
  }
});

router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { deviceId, appVersion, tenantSlug } = req.body ?? {};
    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required" });
    }
    const result = await ChaslayCompatService.validateLicense({
      deviceId,
      appVersion,
      tenantSlug: tenantSlug ?? req.header("X-Tenant-Slug"),
    });
    res.json(result);
  } catch (error) {
    res.status(403).json({ error: error instanceof Error ? error.message : "Validation failed" });
  }
});

export default router;
