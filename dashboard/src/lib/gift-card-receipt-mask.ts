/** Mask gift card numbers on customer receipts (show last 4–5 digits). */
export function maskGiftCardNumberForReceipt(
  raw: string | null | undefined,
  visibleTail = 5
): string | null {
  const compact = String(raw || '')
    .trim()
    .replace(/\s+/g, '');
  if (!compact) return null;
  const tail =
    compact.length <= 6 ? Math.min(4, compact.length) : Math.min(visibleTail, compact.length);
  if (compact.length <= tail) return compact;
  return `${'*'.repeat(compact.length - tail)}${compact.slice(-tail)}`;
}
