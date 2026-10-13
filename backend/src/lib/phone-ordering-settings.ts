/** Merchant phone-ordering channel — Twilio / generic SMS-voice webhook + staff take-order. */

export type PhoneOrderingSettings = {
  enabled?: boolean;
  phoneNumber?: string;
  hours?: string;
  webhookSecret?: string;
};

export type PhoneOrderingSettingsPublic = {
  enabled: boolean;
  phoneNumber: string | null;
  hours: string | null;
  webhookSecretMasked: string | null;
  webhookSecretSet: boolean;
  configured: boolean;
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

export function normalizePhoneOrderingSettings(
  raw?: PhoneOrderingSettings | Record<string, unknown> | null
): PhoneOrderingSettings {
  const src = (raw || {}) as PhoneOrderingSettings;
  return {
    enabled: src.enabled === true,
    phoneNumber: cleanStr(src.phoneNumber, 40),
    hours: cleanStr(src.hours, 200),
    webhookSecret: cleanStr(src.webhookSecret, 128),
  };
}

export function getPhoneOrderingPublic(
  raw?: PhoneOrderingSettings | Record<string, unknown> | null
): PhoneOrderingSettingsPublic {
  const s = normalizePhoneOrderingSettings(raw);
  const secretSet = !!s.webhookSecret;
  return {
    enabled: s.enabled === true,
    phoneNumber: s.phoneNumber || null,
    hours: s.hours || null,
    webhookSecretMasked: maskSecret(s.webhookSecret),
    webhookSecretSet: secretSet,
    configured: s.enabled === true && (!!s.phoneNumber || secretSet),
  };
}

/** Public shop payload — never includes webhook secret material. */
export function getPhoneOrderingShopPublic(
  raw?: PhoneOrderingSettings | Record<string, unknown> | null
): { enabled: boolean; phoneNumber: string | null; hours: string | null } {
  const s = getPhoneOrderingPublic(raw);
  return {
    enabled: s.enabled,
    phoneNumber: s.phoneNumber,
    hours: s.hours,
  };
}

function secretUnchanged(incoming: string | undefined): boolean {
  if (!incoming) return false;
  return incoming.includes("••••");
}

export function mergePhoneOrderingSettings(
  currentRaw: PhoneOrderingSettings | Record<string, unknown> | null | undefined,
  patchRaw: PhoneOrderingSettings | Record<string, unknown> | null | undefined
): PhoneOrderingSettings {
  const current = normalizePhoneOrderingSettings(currentRaw);
  if (!patchRaw || typeof patchRaw !== "object") return current;
  const patch = patchRaw as PhoneOrderingSettings;
  const next: PhoneOrderingSettings = {
    enabled: patch.enabled !== undefined ? patch.enabled === true : current.enabled,
    phoneNumber:
      patch.phoneNumber !== undefined ? cleanStr(patch.phoneNumber, 40) : current.phoneNumber,
    hours: patch.hours !== undefined ? cleanStr(patch.hours, 200) : current.hours,
    webhookSecret: current.webhookSecret,
  };
  if (patch.webhookSecret !== undefined && !secretUnchanged(patch.webhookSecret)) {
    next.webhookSecret = cleanStr(patch.webhookSecret, 128);
  }
  return next;
}

export function isPhoneOrderingReady(
  raw?: PhoneOrderingSettings | Record<string, unknown> | null
): boolean {
  const s = normalizePhoneOrderingSettings(raw);
  return s.enabled === true && !!s.webhookSecret;
}

export function timingSafeEqualSecret(expected?: string | null, provided?: string | null): boolean {
  const a = String(expected || "");
  const b = String(provided || "");
  if (!a || !b || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
