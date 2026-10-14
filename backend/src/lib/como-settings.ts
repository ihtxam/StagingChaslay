/** Como Sense (Comosense) merchant credentials — never expose the raw API key. */

export const COMO_API_BASE_LIVE = "https://api.prod.bcomo.com/api/v4";

export type ComoSettings = {
  enabled?: boolean;
  /** Documented live host is api.prod.bcomo.com. Test keys from Como Hub use the same host. */
  environment?: "live";
  apiKey?: string;
  branchId?: string;
  posId?: string;
  /** Allow POS/kiosk to call quickRegistration when getMemberDetails returns Customer Not Found. */
  allowQuickRegistration?: boolean;
};

export type ComoSettingsPublic = {
  enabled: boolean;
  environment: "live";
  apiKeyMasked: string | null;
  apiKeySet: boolean;
  branchId: string | null;
  posId: string | null;
  allowQuickRegistration: boolean;
  configured: boolean;
  lastTestOkAt?: string | null;
};

function cleanStr(value: unknown, max = 255): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  if (!s) return undefined;
  return s.slice(0, max);
}

export function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}

export function normalizeComoSettings(
  raw?: ComoSettings | Record<string, unknown> | null
): ComoSettings {
  const src = (raw || {}) as ComoSettings;
  return {
    enabled: src.enabled === true,
    environment: "live",
    apiKey: cleanStr(src.apiKey, 512),
    branchId: cleanStr(src.branchId, 128),
    posId: cleanStr(src.posId, 64),
    allowQuickRegistration: src.allowQuickRegistration === true,
  };
}

export function getComoPublic(
  raw?: ComoSettings | Record<string, unknown> | null
): ComoSettingsPublic {
  const s = normalizeComoSettings(raw);
  const extra = (raw || {}) as { lastTestOkAt?: string | null };
  const apiKeySet = !!s.apiKey;
  return {
    enabled: s.enabled === true,
    environment: "live",
    apiKeyMasked: maskSecret(s.apiKey),
    apiKeySet,
    branchId: s.branchId || null,
    posId: s.posId || null,
    allowQuickRegistration: s.allowQuickRegistration === true,
    configured: s.enabled === true && apiKeySet,
    lastTestOkAt: extra.lastTestOkAt ? String(extra.lastTestOkAt) : null,
  };
}

function secretUnchanged(incoming: string | undefined): boolean {
  if (!incoming) return false;
  return incoming.includes("••••");
}

export function mergeComoSettings(
  currentRaw: ComoSettings | Record<string, unknown> | null | undefined,
  patchRaw: ComoSettings | Record<string, unknown> | null | undefined
): ComoSettings & { lastTestOkAt?: string | null } {
  const current = normalizeComoSettings(currentRaw);
  const prev = (currentRaw || {}) as { lastTestOkAt?: string | null };
  if (!patchRaw || typeof patchRaw !== "object") {
    return { ...current, lastTestOkAt: prev.lastTestOkAt || null };
  }
  const patch = patchRaw as ComoSettings & { lastTestOkAt?: string | null };
  const next: ComoSettings & { lastTestOkAt?: string | null } = {
    enabled: patch.enabled !== undefined ? patch.enabled === true : current.enabled,
    environment: "live",
    apiKey: current.apiKey,
    branchId: patch.branchId !== undefined ? cleanStr(patch.branchId, 128) : current.branchId,
    posId: patch.posId !== undefined ? cleanStr(patch.posId, 64) : current.posId,
    allowQuickRegistration:
      patch.allowQuickRegistration !== undefined
        ? patch.allowQuickRegistration === true
        : current.allowQuickRegistration,
    lastTestOkAt: prev.lastTestOkAt || null,
  };
  if (patch.apiKey !== undefined && !secretUnchanged(patch.apiKey)) {
    next.apiKey = cleanStr(patch.apiKey, 512);
  }
  if (patch.lastTestOkAt !== undefined) {
    next.lastTestOkAt = patch.lastTestOkAt ? String(patch.lastTestOkAt) : null;
  }
  return next;
}

export function isComoReady(
  raw?: ComoSettings | Record<string, unknown> | null
): boolean {
  const s = normalizeComoSettings(raw);
  return s.enabled === true && !!s.apiKey;
}
