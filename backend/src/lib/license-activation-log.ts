import { PlatformLogService } from "@/services/platform-log.service";
import { normalizeChaslayDeviceId } from "@/services/chaslay-compat.service";

type LicenseActivationLogInput = {
  outcome: "success" | "failure";
  deviceId: string;
  activationCode: string;
  errorMessage?: string;
  tenantSlug?: string | null;
  appVersion?: string;
  deviceModel?: string;
  merchantId?: string | null;
  source?: "android_pos" | "android_client";
};

function activationCodeHint(code: string): string {
  const clean = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!clean) return "(empty)";
  if (clean.length <= 4) return `${clean}***`;
  return `${clean.slice(0, 4)}***`;
}

/** Write a platform event log entry for superadmin System Logs. Returns log id as reference. */
export async function logPosLicenseActivation(input: LicenseActivationLogInput): Promise<string> {
  const deviceId = normalizeChaslayDeviceId(input.deviceId) || input.deviceId.trim();
  const codeHint = activationCodeHint(input.activationCode);
  const source = input.source || "android_pos";

  const message =
    input.outcome === "success"
      ? `POS license activated (device ${deviceId || "unknown"})`
      : `POS license activation failed: ${input.errorMessage || "unknown error"}`;

  const row = await PlatformLogService.write({
    level: input.outcome === "success" ? "info" : "error",
    category: "license_activation",
    message,
    merchantId: input.merchantId || null,
    metadata: {
      outcome: input.outcome,
      source,
      deviceId: deviceId || null,
      activationCodeHint: codeHint,
      errorMessage: input.errorMessage || null,
      tenantSlug: input.tenantSlug || null,
      appVersion: input.appVersion || null,
      deviceModel: input.deviceModel || null,
    },
  });

  return row.id;
}
