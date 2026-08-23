/** Paid kitchen display (KDS) addon */
export function isKdsLicensed(input: {
  enabled?: boolean;
  kdsAddonEnabled?: boolean;
  kdsEnabled?: boolean;
} | null | undefined): boolean {
  if (!input) return false;
  return !!(input.enabled || input.kdsAddonEnabled || input.kdsEnabled);
}
