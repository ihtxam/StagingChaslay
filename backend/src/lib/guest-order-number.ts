const OPAQUE_ORDER_RE = /^(WP|DI)-/i;
const TICKET_NOTE_RE = /\[ticket:([^\]]+)\]/i;
const TAB_NOTE_RE = /\[tab:([^\]]+)\]/i;

/** Normalize kitchen / tab shout to #1234 form. */
function normalizeShout(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed.replace(/^#/, "")}`;
}

export function parseOrderMetaFromNotes(notes?: string | null): {
  ticketDisplay?: string;
  tabNumber?: string;
} {
  const text = String(notes || "");
  let ticketDisplay = text.match(TICKET_NOTE_RE)?.[1]?.trim();
  if (ticketDisplay && !ticketDisplay.startsWith("#")) {
    ticketDisplay = `#${ticketDisplay.replace(/^#/, "")}`;
  }
  const tabNumber = text.match(TAB_NOTE_RE)?.[1]?.trim();
  return { ticketDisplay: ticketDisplay || undefined, tabNumber: tabNumber || undefined };
}

/**
 * Guest-facing primary order reference.
 * Prefers kitchen shout / tab number over opaque WP-/DI- backend ids.
 */
export function guestOrderNumber(opts: {
  orderNumber?: string | null;
  orderDisplay?: string | null;
  tabNumber?: string | null;
}): string {
  const shout = String(opts.orderDisplay || "").trim();
  if (shout && !OPAQUE_ORDER_RE.test(shout)) {
    return normalizeShout(shout);
  }
  const tab = String(opts.tabNumber || "")
    .trim()
    .replace(/^#/, "");
  if (tab) return `#${tab}`;
  const raw = String(opts.orderNumber || "").trim();
  if (!raw || OPAQUE_ORDER_RE.test(raw)) return "";
  return raw;
}
