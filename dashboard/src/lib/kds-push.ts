import api from '@/lib/api';
import type { CartLine, PosChannel } from '@/components/webpos/types';
import { createAddonPollGate } from '@/lib/addon-poll';
import { kitchenTicketKeyBase, kitchenTicketKeysMatch } from '@/lib/kitchen-progress';
import {
  buildKdsReadyMap as buildKdsReadyMapFromPayload,
  collectReadyLineIds as collectReadyLineIdsFromPayload,
  matchBoardTickets as matchBoardTicketsFromPayload,
  parseKdsBoardPayload,
  type KdsBoardTicket,
} from '@/lib/kds-board-parse';
import { asArray, asStringArray } from '@/lib/safe-iterables';

export { parseKdsBoardPayload, type KdsBoardTicket } from '@/lib/kds-board-parse';

const kdsPollGate = createAddonPollGate();

export function isKdsPollingStopped(): boolean {
  return kdsPollGate.isStopped();
}

export function resetKdsPollingGate(): void {
  kdsPollGate.reset();
}

export type KdsTicketStatus = {
  readyLineIds: string[];
  ready: number;
  total: number;
  sent: number;
  status?: string;
};

export function resolveKdsTicketKey(opts: {
  ticketDisplay?: string | null;
  tabNumber?: string | null;
  ticketOrderNumber?: string | null;
  orderNumber?: string | null;
}): string {
  const display = String(opts.ticketDisplay || '').trim();
  if (display) return display;
  const tab = String(opts.tabNumber || '').trim();
  if (tab) return tab.startsWith('#') ? tab : `#${tab}`;
  const orderNum = String(opts.ticketOrderNumber || opts.orderNumber || '').trim();
  return orderNum;
}

export async function dismissKdsTicket(ticketKey: string): Promise<void> {
  const base = kitchenTicketKeyBase(ticketKey);
  if (!base) return;
  try {
    await api.post('/merchant/kds/dismiss', { ticketKey: base });
  } catch (e) {
    kdsPollGate.noteError(e);
    console.warn('[kds] dismiss failed', e);
  }
}

export async function pushCartLinesToKds(opts: {
  ticketKey: string;
  orderNumber?: string | null;
  tableLabel?: string | null;
  tabNumber?: string | null;
  channel?: PosChannel | null;
  lines: CartLine[];
}): Promise<void> {
  const items = asArray<CartLine>(opts.lines)
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
    kdsPollGate.noteError(e);
    console.warn('[kds] push failed', e);
  }
}

/** Live tills call /kds/board; board-status is the same handler. */
export async function fetchKdsBoardStatus(): Promise<KdsBoardTicket[]> {
  if (kdsPollGate.isStopped()) return [];
  try {
    const res = await api.get('/merchant/kds/board');
    return parseKdsBoardPayload(res.data);
  } catch (e) {
    kdsPollGate.noteError(e);
    return [];
  }
}

export async function fetchKdsTicketStatus(ticketKey: string): Promise<KdsTicketStatus | null> {
  const base = kitchenTicketKeyBase(ticketKey);
  if (!base || kdsPollGate.isStopped()) return null;
  try {
    const res = await api.get('/merchant/kds/ticket-status', {
      params: { ticketKey: base },
    });
    return {
      readyLineIds: asStringArray(res.data?.readyLineIds),
      ready: Number(res.data?.ready) || 0,
      total: Number(res.data?.total) || 0,
      sent: Number(res.data?.sent ?? res.data?.total) || 0,
      status: res.data?.status ? String(res.data.status) : undefined,
    };
  } catch (e) {
    kdsPollGate.noteError(e);
    return null;
  }
}

export async function fetchKdsReadyLineIds(ticketKey: string): Promise<string[]> {
  const status = await fetchKdsTicketStatus(ticketKey);
  return status?.readyLineIds || [];
}

/** Apply KDS ready line ids onto cart lines (sets kitchenReadyAt). */
export function applyKdsReadyToCart(lines: CartLine[], readyLineIds: string[]): CartLine[] {
  const safeLines = asArray<CartLine>(lines);
  const safeReady = asStringArray(readyLineIds);
  if (!safeReady.length) return safeLines;
  const readySet = new Set(safeReady);
  let changed = false;
  const next = safeLines.map((l) => {
    if (readySet.has(l.lineId) && !l.kitchenReadyAt) {
      changed = true;
      return { ...l, kitchenReadyAt: Date.now() };
    }
    return l;
  });
  return changed ? next : safeLines;
}

/** Match board tickets to any of the candidate POS ticket keys. */
export function matchBoardTickets(
  board: KdsBoardTicket[] | null | undefined,
  candidateKeys: Iterable<string> | null | undefined
): KdsBoardTicket[] {
  return matchBoardTicketsFromPayload(board, candidateKeys);
}

/** Build map of ticket key -> ready line ids (includes normalized base keys). */
export function buildKdsReadyMap(
  tickets: KdsBoardTicket[] | null | undefined
): Map<string, Set<string>> {
  return buildKdsReadyMapFromPayload(tickets);
}

export function lineKitchenReady(
  lineId: string,
  ticketKeys: string[] | null | undefined,
  readyMap: Map<string, Set<string>>
): boolean {
  if (!lineId || !readyMap.size) return false;
  for (const key of asStringArray(ticketKeys)) {
    for (const [mapKey, readySet] of readyMap) {
      if (kitchenTicketKeysMatch(key, mapKey) && readySet.has(lineId)) return true;
    }
  }
  return false;
}

export function lineIdKitchenReady(lineId: string, readyMap: Map<string, Set<string>>): boolean {
  if (!lineId || !readyMap.size) return false;
  for (const readySet of readyMap.values()) {
    if (readySet.has(lineId)) return true;
  }
  return false;
}

export function cartLineKitchenReady(
  line: CartLine,
  ticketKeys: string[],
  readyMap: Map<string, Set<string>>
): boolean {
  if (line.kitchenReadyAt) return true;
  if (!line.sentToKitchen) return false;
  const lineId = String(line.lineId || '');
  if (lineIdKitchenReady(lineId, readyMap)) return true;
  return lineKitchenReady(lineId, ticketKeys, readyMap);
}

export function collectReadyLineIds(tickets: KdsBoardTicket[] | null | undefined): Set<string> {
  return collectReadyLineIdsFromPayload(tickets);
}

export function collectKdsTicketKeys(opts: {
  tabNumber?: string | null;
  ticketDisplay?: string | null;
  ticketOrderNumber?: string | null;
  lastKitchenTicket?: string | null;
  kitchenTicketKey?: string | null;
  tabOrderShout?: (tab: string | null | undefined) => string;
}): string[] {
  const keys = new Set<string>();
  const tabShout = opts.tabOrderShout?.(opts.tabNumber) || '';
  if (tabShout) keys.add(kitchenTicketKeyBase(tabShout));
  const kitchenKey = String(opts.kitchenTicketKey || '').trim();
  if (kitchenKey) keys.add(kitchenTicketKeyBase(kitchenKey));
  const display = String(opts.ticketDisplay || '').trim();
  if (display) keys.add(kitchenTicketKeyBase(display));
  const last = String(opts.lastKitchenTicket || '').trim();
  if (last) keys.add(kitchenTicketKeyBase(last));
  const orderNum = String(opts.ticketOrderNumber || '').trim();
  if (orderNum) keys.add(kitchenTicketKeyBase(orderNum));
  return [...keys];
}
