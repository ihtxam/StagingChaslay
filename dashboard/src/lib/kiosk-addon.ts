/** Paid self-order kiosk addon */
export function isKioskLicensed(input: {
  enabled?: boolean;
  kioskAddonEnabled?: boolean;
  kioskEnabled?: boolean;
} | null | undefined): boolean {
  if (!input) return false;
  return !!(input.enabled || input.kioskAddonEnabled || input.kioskEnabled);
}
