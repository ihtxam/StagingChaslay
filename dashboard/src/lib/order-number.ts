const SHORT_WEB_RE = /^WEB-(\d{1,6})$/;
const LEGACY_WEB_RE = /^WEB-(\d{10,})(?:-([A-F0-9]{4,8}))?$/i;
const OPAQUE_ORDER_RE = /^(WP|DI)-/i;

function normalizeShout(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('#') ? trimmed : `#${trimmed.replace(/^#/, '')}`;
}

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

/**
 * Guest-facing primary order reference.
 * Kitchen shout / tab # wins over opaque WP-/DI- ids; TX and WEB numbers stay full.
 */
export function guestOrderNumber(opts: {
  orderNumber?: string | null;
  orderDisplay?: string | null;
  tabNumber?: string | null;
}): string {
  const shout = String(opts.orderDisplay || '').trim();
  if (shout && !OPAQUE_ORDER_RE.test(shout)) {
    return normalizeShout(shout);
  }
  const tab = String(opts.tabNumber || '')
    .trim()
    .replace(/^#/, '');
  if (tab) return `#${tab}`;
  const raw = formatOrderNumberDisplay(opts.orderNumber);
  if (!raw || OPAQUE_ORDER_RE.test(raw)) return '';
  return raw;
}

/** Checkout AMOUNT DUE line — same primary number as receipts; kitchen secondary when distinct. */
export function formatCheckoutOrderRef(
  orderNumber?: string | null,
  kitchenNumber?: string | null,
  tabNumber?: string | null
): string {
  const primary = guestOrderNumber({ orderNumber, orderDisplay: kitchenNumber, tabNumber });
  if (!primary) return '';
  const kitchen = String(kitchenNumber || '')
    .trim()
    .replace(/^#/, '');
  const kitchenHash = kitchen ? `#${kitchen}` : '';
  const raw = String(orderNumber || '').trim();
  if (
    kitchenHash &&
    kitchenHash !== primary &&
    /^TX-/i.test(raw) &&
    primary.toUpperCase() === raw.toUpperCase()
  ) {
    return `${primary} · Kitchen ${kitchenHash}`;
  }
  return primary;
}
