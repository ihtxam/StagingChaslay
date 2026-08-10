/** Reject empty / literal "null" snapshots so linked catalog names can win. */
export function usableOrderItemName(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === 'null' || lower === 'undefined') return null;
  return s;
}

export function resolveOrderItemName(...candidates: unknown[]): string {
  for (const value of candidates) {
    const usable = usableOrderItemName(value);
    if (usable) return usable;
  }
  return 'Item';
}
