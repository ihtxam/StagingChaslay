/** Paid inventory + recipes addon — accept any of the API field names. */
export function isInventoryLicensed(input: {
  enabled?: boolean;
  inventoryAddonEnabled?: boolean;
  inventoryEnabled?: boolean;
} | null | undefined): boolean {
  if (!input) return false;
  return !!(input.enabled || input.inventoryAddonEnabled || input.inventoryEnabled);
}
