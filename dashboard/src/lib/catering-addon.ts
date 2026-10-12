/** Paid catering module — off unless Superadmin/reseller enables it. */
export function isCateringLicensed(input: {
  cateringEnabled?: boolean;
  cateringAddonEnabled?: boolean;
} | null | undefined): boolean {
  if (!input) return false;
  return input.cateringEnabled === true || input.cateringAddonEnabled === true;
}
