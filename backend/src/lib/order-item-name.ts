/** True when a stored/sent product name can be shown (rejects null/"null"/empty). */
export function isUsableProductName(value: unknown): boolean {
  if (value == null) return false;
  const s = String(value).trim();
  if (!s) return false;
  const lower = s.toLowerCase();
  return lower !== "null" && lower !== "undefined";
}

/**
 * Pick the first usable display name from snapshot / aliases / linked product.
 * Falls back to "Item" when nothing valid is available.
 */
export function resolveOrderItemName(...candidates: unknown[]): string {
  for (const value of candidates) {
    if (!isUsableProductName(value)) continue;
    return String(value).trim().slice(0, 255);
  }
  return "Item";
}
