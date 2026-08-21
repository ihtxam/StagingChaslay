import api from '@/lib/api';
import type { CartLine, PosChannel } from '@/components/webpos/types';

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

export async function fetchKdsReadyLineIds(ticketKey: string): Promise<string[]> {
  if (!ticketKey) return [];
  try {
    const res = await api.get('/merchant/kds/ticket-status', {
      params: { ticketKey },
    });
    return (res.data?.readyLineIds || []) as string[];
  } catch {
    return [];
  }
}
