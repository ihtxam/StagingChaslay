/** Storekeeper mobile intake — separate addon or included with full inventory. */
export function isStorekeeperLicensed(input: {
  storekeeperAddonEnabled?: boolean;
  inventoryAddonEnabled?: boolean;
  inventoryEnabled?: boolean;
} | null | undefined): boolean {
  if (!input) return false;
  return (
    input.storekeeperAddonEnabled === true ||
    input.inventoryAddonEnabled === true ||
    input.inventoryEnabled === true
  );
}
