const SHORT_WEB_RE = /^WEB-(\d{1,6})$/;
const LEGACY_WEB_RE = /^WEB-(\d{10,})(?:-([A-F0-9]{4,8}))?$/i;

/** Display-friendly web order number — shortens legacy WEB-{timestamp}-{suffix} values. */
export function formatOrderNumberDisplay(orderNumber: string | null | undefined): string {
  const n = String(orderNumber || '').trim();
  if (!n) return n;
  if (SHORT_WEB_RE.test(n)) return n;
  const legacy = n.match(LEGACY_WEB_RE);
  if (legacy) {
    if (legacy[2]) return `WEB-${legacy[2]}`;
    return `WEB-${legacy[1].slice(-4)}`;
  }
  return n;
}

/** Checkout AMOUNT DUE line: public order number plus kitchen ticket when both exist. */
export function formatCheckoutOrderRef(
  orderNumber?: string | null,
  kitchenNumber?: string | null
): string {
  const order = String(orderNumber || '').trim();
  const kitchen = String(kitchenNumber || '').trim();
  if (order && kitchen && kitchen !== order) return `${order} / ${kitchen}`;
  return order || kitchen;
}
