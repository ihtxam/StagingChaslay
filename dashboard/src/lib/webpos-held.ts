import { loadPersistedWebPosCarts, savePersistedWebPosCarts } from '@/lib/webpos-cart-persist';
import api from '@/lib/api';
import type { CartLine, OpenCartDraft, PosChannel } from '@/components/webpos/types';

export type HeldCartMeta = {
  cart: CartLine[];
  channel?: PosChannel | null;
  tableId?: string | null;
  tableLabel?: string | null;
  tabNumber?: string | null;
  ticketDisplay?: string | null;
  ticketOrderNumber?: string | null;
  kitchenTicketKey?: string | null;
  orderNote?: string | null;
  billDiscount?: { percent?: number; amount?: number } | null;
};

export function parseHeldCartJson(raw: unknown): HeldCartMeta {
  let data: unknown = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return { cart: [] };
    }
  }
  if (Array.isArray(data)) {
    return { cart: data as CartLine[] };
  }
  if (!data || typeof data !== 'object') return { cart: [] };
  const o = data as Record<string, unknown>;
  const cart = Array.isArray(o.cart) ? (o.cart as CartLine[]) : [];
  return {
    cart,
    channel: (o.channel as PosChannel | null) ?? null,
    tableId: typeof o.tableId === 'string' ? o.tableId : null,
    tableLabel: typeof o.tableLabel === 'string' ? o.tableLabel : null,
    tabNumber: o.tabNumber != null ? String(o.tabNumber) : null,
    ticketDisplay: typeof o.ticketDisplay === 'string' ? o.ticketDisplay : null,
    ticketOrderNumber: typeof o.ticketOrderNumber === 'string' ? o.ticketOrderNumber : null,
    kitchenTicketKey: typeof o.kitchenTicketKey === 'string' ? o.kitchenTicketKey : null,
    orderNote: typeof o.orderNote === 'string' ? o.orderNote : null,
    billDiscount: o.billDiscount && typeof o.billDiscount === 'object' ? (o.billDiscount as HeldCartMeta['billDiscount']) : null,
  };
}

/** Normalize #5126 / D-5126 / 0-5126 / P-5126 so search finds the shout number. */
export function ticketSearchTokens(value?: string | null): string[] {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const tokens = new Set<string>([raw.toLowerCase()]);
  const compact = raw.replace(/[#\s]/g, '').toLowerCase();
  if (compact) tokens.add(compact);
  const digits = compact.replace(/^[a-z]+-?/i, '').replace(/^0+/, '');
  if (digits) tokens.add(digits);
  const bare = raw.replace(/^#/, '').trim().toLowerCase();
  if (bare) tokens.add(bare);
  return [...tokens];
}

export function ticketQueryMatches(query: string, ...values: Array<string | null | undefined>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const qTokens = ticketSearchTokens(q);
  const hay = values.flatMap((v) => ticketSearchTokens(v)).join(' ');
  if (hay.includes(q)) return true;
  return qTokens.some((tok) => tok.length >= 3 && hay.includes(tok));
}

export function resolveHeldChannel(opts: {
  channel?: string | null;
  cartJson?: unknown;
}): string {
  const meta = parseHeldCartJson(opts.cartJson);
  if (meta.tableId || meta.tableLabel) return 'dine_in';
  const ch = (opts.channel || meta.channel || 'takeaway').toLowerCase();
  if (ch === 'dine_in' || ch === 'delivery' || ch === 'takeaway') return ch;
  return 'takeaway';
}

export function draftToHeldRow(key: string, draft: OpenCartDraft): {
  id: string;
  label: string;
  status: string;
  channel: string;
  cartJson: HeldCartMeta;
  createdAt?: string;
  updatedAt?: string;
} | null {
  if (!draft?.cart?.length && !draft?.orderSent) return null;
  const sent = !!draft.orderSent || draft.cart.some((l) => l.sentToKitchen);
  const channel = resolveHeldChannel({ channel: draft.channel, cartJson: draft });
  const label = [draft.tableLabel, draft.tabNumber ? `#${draft.tabNumber}` : null, draft.ticketDisplay, channel]
    .filter(Boolean)
    .join(' · ');
  return {
    id: `local:${key}`,
    label: label || 'Held',
    status: sent ? 'sent_to_kitchen' : 'held',
    channel,
    cartJson: {
      cart: draft.cart,
      channel: draft.channel,
      tableId: draft.tableId,
      tableLabel: draft.tableLabel,
      tabNumber: draft.tabNumber,
      ticketDisplay: draft.ticketDisplay,
      ticketOrderNumber: draft.ticketOrderNumber,
      orderNote: draft.orderNote,
      billDiscount: draft.billDiscount,
    },
  };
}

/** Local session drafts that never reached /merchant/pos/held. */
export function localHeldRowsFromSession(): ReturnType<typeof draftToHeldRow>[] {
  const persisted = loadPersistedWebPosCarts();
  if (!persisted) return [];
  const rows: ReturnType<typeof draftToHeldRow>[] = [];
  const seen = new Set<string>();
  const add = (key: string, draft: OpenCartDraft | null | undefined) => {
    if (!draft) return;
    const row = draftToHeldRow(key, draft);
    if (!row) return;
    const ident = row.cartJson.ticketDisplay || row.cartJson.tableId || row.cartJson.tabNumber || key;
    if (seen.has(ident)) return;
    seen.add(ident);
    rows.push(row);
  };
  add('active', persisted.active || undefined);
  for (const [key, draft] of Object.entries(persisted.drafts || {})) add(key, draft);
  return rows;
}

export function removeLocalHeldDraft(ident: {
  ticketDisplay?: string | null;
  tableId?: string | null;
  tabNumber?: string | null;
  localId?: string | null;
}) {
  const persisted = loadPersistedWebPosCarts();
  if (!persisted) return;
  const matches = (draft: OpenCartDraft | null | undefined, key: string) => {
    if (!draft) return false;
    if (ident.localId && `local:${key}` === ident.localId) return true;
    return sameHeldIdentity(ident, {
      ticketDisplay: draft.ticketDisplay,
      tableId: draft.tableId,
      tabNumber: draft.tabNumber,
    });
  };
  const drafts = { ...persisted.drafts };
  for (const [key, draft] of Object.entries(drafts)) {
    if (matches(draft, key)) delete drafts[key];
  }
  const active = matches(persisted.active, 'active') ? null : persisted.active;
  savePersistedWebPosCarts({
    drafts,
    active,
    mobileCartOpen: persisted.mobileCartOpen,
    customer: persisted.customer,
  });
}

export function sameHeldIdentity(
  a: { ticketDisplay?: string | null; tableId?: string | null; tabNumber?: string | null },
  b: { ticketDisplay?: string | null; tableId?: string | null; tabNumber?: string | null }
): boolean {
  if (a.ticketDisplay && b.ticketDisplay && a.ticketDisplay === b.ticketDisplay) return true;
  if (a.tableId && b.tableId && a.tableId === b.tableId) {
    if (a.ticketDisplay && b.ticketDisplay) return a.ticketDisplay === b.ticketDisplay;
    if (a.ticketDisplay || b.ticketDisplay) return false;
    return true;
  }
  if (!a.tableId && !b.tableId && a.tabNumber && b.tabNumber && a.tabNumber === b.tabNumber) {
    return true;
  }
  return false;
}

export type HeldOrderRow = {
  id: string;
  cartJson?: unknown;
  status?: string | null;
  label?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

function heldRowTimeMs(row: Pick<HeldOrderRow, 'updatedAt' | 'createdAt'>): number {
  const updated = row.updatedAt ? Date.parse(row.updatedAt) : 0;
  const created = row.createdAt ? Date.parse(row.createdAt) : 0;
  return Math.max(updated, created);
}

/** Best open held row for a table — newest row that still has cart lines. */
export function findHeldOrderForTable(
  tableId: string,
  rows: HeldOrderRow[]
): HeldOrderRow | null {
  const tid = String(tableId || '').trim();
  if (!tid) return null;
  const matches = rows.filter((row) => parseHeldCartJson(row.cartJson).tableId === tid);
  if (!matches.length) return null;
  const withLines = matches.filter((row) => parseHeldCartJson(row.cartJson).cart.length > 0);
  const pool = withLines.length ? withLines : matches;
  return [...pool].sort((a, b) => heldRowTimeMs(b) - heldRowTimeMs(a))[0] || null;
}

export type HeldReleaseIdent = {
  heldId?: string | null;
  ticketDisplay?: string | null;
  tableId?: string | null;
  tabNumber?: string | null;
};

/** Drop held rows after payment — works without CANCEL_ORDERS permission. */
export async function releaseHeldOrder(ident: HeldReleaseIdent): Promise<void> {
  const hasIdent =
    ident.heldId ||
    ident.ticketDisplay?.trim() ||
    ident.tableId?.trim() ||
    ident.tabNumber?.trim();
  if (!hasIdent) return;
  try {
    await api.post('/merchant/pos/held/release', {
      heldId: ident.heldId || undefined,
      ticketDisplay: ident.ticketDisplay || undefined,
      tableId: ident.tableId || undefined,
      tabNumber: ident.tabNumber || undefined,
    });
  } catch {
    /* payment already recorded — best-effort cleanup */
  }
  removeLocalHeldDraft(ident);
}
