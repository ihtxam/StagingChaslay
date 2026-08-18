/** Paid restaurant inventory + recipes addon (merchant-level, not edition-gated). */
export function isInventoryAddonEnabled(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true" || value === "t";
}
