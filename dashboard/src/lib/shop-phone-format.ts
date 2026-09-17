/** Display Swiss (+41) numbers as +41 32 361 17 17; otherwise return trimmed input. */
export function formatShopPhoneDisplay(raw?: string | null): string {
  const original = String(raw || '').trim();
  if (!original) return '';
  const compact = original.replace(/[^\d+]/g, '');
  const m = compact.match(/^\+?41(\d+)$/) || compact.match(/^0041(\d+)$/);
  if (!m) return original;
  const national = m[1].replace(/^0/, '');
  if (national.length < 9) return original;
  return `+41 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5, 7)} ${national.slice(7, 9)}`;
}
