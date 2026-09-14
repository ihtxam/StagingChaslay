/** Canonical alphanumeric form of a POS activation / license code. */
export function compactActivationCode(code: string): string {
  return String(code ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Reborn short codes are 12 hex chars grouped as XXXX-XXXX-XXXX. */
export function formatShortActivationCode(compact: string): string {
  const c = compactActivationCode(compact);
  if (c.length === 12) {
    return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
  }
  return c.match(/.{1,4}/g)?.join("-") ?? c;
}

/**
 * Normalize what the user typed so it matches stored Reborn codes.
 * Strips spaces, accepts upper/lower case, and inserts hyphens for 12-char codes.
 */
export function normalizeActivationCode(code: string): string {
  const compact = compactActivationCode(code);
  if (!compact) return "";
  if (compact.length === 12) return formatShortActivationCode(compact);
  return String(code ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

/** Candidate license_key values to try before a compact SQL fallback. */
export function activationCodeLookupKeys(code: string): string[] {
  const compact = compactActivationCode(code);
  const raw = String(code ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const keys = new Set<string>();
  if (raw) keys.add(raw);
  if (compact) keys.add(compact);
  if (compact.length === 12) keys.add(formatShortActivationCode(compact));
  return [...keys];
}

export function isPlaceholderDeviceId(externalId: string): boolean {
  return /^POS-/i.test(String(externalId || "").trim());
}

export type UnusedDeviceProbe = {
  lastSync?: Date | string | null;
  appVersion?: string | null;
};

/** Issued in admin but never actually activated from a tablet. */
export function isUnusedIssuedDevice(device: UnusedDeviceProbe | null | undefined): boolean {
  if (!device) return true;
  if (device.lastSync) return false;
  return !String(device.appVersion || "").trim();
}

export function canRebindLicenseDevice(
  device: (UnusedDeviceProbe & { deviceId?: string }) | null | undefined,
  incomingMatchesStored: boolean
): boolean {
  if (!device) return true;
  if (incomingMatchesStored) return true;
  if (isPlaceholderDeviceId(device.deviceId || "")) return true;
  return isUnusedIssuedDevice(device);
}
