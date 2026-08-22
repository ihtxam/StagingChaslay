import api from '@/lib/api';
import type { CartLine, PosChannel } from '@/components/webpos/types';

export type KdsTicketStatus = {
  readyLineIds: string[];
  ready: number;
  total: number;
  sent: number;
  status?: string;
};

export async function pushCartLinesToKds(opts: {
  ticketKey: string;
  orderNumber?: string | null;
  tableLabel?: string | null;
  tabNumber?: string | null;
  channel?: PosChannel | null;
  lines: CartLine[];
}): Promise<void> {
  const items = opts.lines
    .filter((l) => !l.giftCard && !String(l.productId || '').startsWith('__gift_card_'))
    .map((l) => ({
      lineId: l.lineId,
      productId: l.productId,
      categoryId: l.categoryId,
      name: l.name,
      quantity: l.quantity,
      lineNote: l.lineNote,
      courseNumber: l.courseNumber,
      selectedExtras: l.selectedExtras,
      comboSelections: l.comboSelections,
    }));
  if (!items.length) return;
  try {
    await api.post('/merchant/kds/push', {
      ticketKey: opts.ticketKey,
      orderNumber: opts.orderNumber,
      tableLabel: opts.tableLabel,
      tabNumber: opts.tabNumber,
      channel: opts.channel,
      items,
    });
  } catch (e) {
    console.warn('[kds] push failed', e);
  }
}

export async function fetchKdsTicketStatus(ticketKey: string): Promise<KdsTicketStatus | null> {
  const base = String(ticketKey || '')
    .trim()
    .split('@')[0];
  if (!base) return null;
  try {
    const res = await api.get('/merchant/kds/ticket-status', {
      params: { ticketKey: base },
    });
    return {
      readyLineIds: (res.data?.readyLineIds || []) as string[],
      ready: Number(res.data?.ready) || 0,
      total: Number(res.data?.total) || 0,
      sent: Number(res.data?.sent ?? res.data?.total) || 0,
      status: res.data?.status ? String(res.data.status) : undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchKdsReadyLineIds(ticketKey: string): Promise<string[]> {
  const status = await fetchKdsTicketStatus(ticketKey);
  return status?.readyLineIds || [];
}

/** Apply KDS ready line ids onto cart lines (sets kitchenReadyAt). */
export function applyKdsReadyToCart(lines: CartLine[], readyLineIds: string[]): CartLine[] {
  if (!readyLineIds.length) return lines;
  const readySet = new Set(readyLineIds);
  let changed = false;
  const next = lines.map((l) => {
    if (readySet.has(l.lineId) && !l.kitchenReadyAt) {
      changed = true;
      return { ...l, kitchenReadyAt: Date.now() };
    }
    return l;
  });
  return changed ? next : lines;
}
