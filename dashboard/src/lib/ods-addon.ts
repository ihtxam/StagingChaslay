/** Paid order display system (ODS) addon */
export function isOdsLicensed(input: {
  enabled?: boolean;
  odsAddonEnabled?: boolean;
  odsEnabled?: boolean;
} | null | undefined): boolean {
  if (!input) return false;
  return !!(input.enabled || input.odsAddonEnabled || input.odsEnabled);
}
