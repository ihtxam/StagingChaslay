import { kitchenTicketKeyBase, kitchenTicketKeysMatch } from './kitchen-progress';
import { asArray, asStringArray } from './safe-iterables';

export type KdsBoardTicket = {
  ticketKey: string;
  status: string;
  completedAt?: string | null;
  readyLineIds: string[];
  total: number;
  ready: number;
};

export function parseKdsBoardPayload(data: unknown): KdsBoardTicket[] {
  if (data == null) return [];
  const raw =
    data && typeof data === 'object'
      ? ((data as { tickets?: unknown; board?: unknown }).tickets ??
        (data as { board?: unknown }).board ??
        data)
      : data;
  return asArray<unknown>(raw)
    .map((row) => normalizeKdsBoardTicket(row))
    .filter((row): row is KdsBoardTicket => !!row);
}

function normalizeKdsBoardTicket(row: unknown): KdsBoardTicket | null {
  if (!row || typeof row !== 'object') return null;
  const t = row as Record<string, unknown>;
  const ticketKey = String(t.ticketKey || t.ticket_key || '').trim();
  if (!ticketKey) return null;
  return {
    ticketKey,
    status: String(t.status || ''),
    completedAt: t.completedAt != null ? String(t.completedAt) : null,
    readyLineIds: asStringArray(t.readyLineIds ?? t.ready_line_ids),
    total: Number(t.total) || 0,
    ready: Number(t.ready) || 0,
  };
}

export function matchBoardTickets(
  board: KdsBoardTicket[] | null | undefined,
  candidateKeys: Iterable<string> | null | undefined
): KdsBoardTicket[] {
  const tickets = asArray<KdsBoardTicket>(board);
  const keys = asStringArray(candidateKeys);
  if (!keys.length || !tickets.length) return [];
  return tickets.filter((ticket) => keys.some((key) => kitchenTicketKeysMatch(ticket.ticketKey, key)));
}

export function buildKdsReadyMap(
  tickets: KdsBoardTicket[] | null | undefined
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const mergeInto = (key: string, lineIds: unknown) => {
    if (!key) return;
    const existing = map.get(key) || new Set<string>();
    for (const id of asStringArray(lineIds)) existing.add(id);
    map.set(key, existing);
  };
  for (const ticket of asArray<KdsBoardTicket>(tickets)) {
    mergeInto(ticket.ticketKey, ticket.readyLineIds);
    mergeInto(kitchenTicketKeyBase(ticket.ticketKey), ticket.readyLineIds);
  }
  return map;
}

export function collectReadyLineIds(tickets: KdsBoardTicket[] | null | undefined): Set<string> {
  const readyIds = new Set<string>();
  for (const ticket of asArray<KdsBoardTicket>(tickets)) {
    for (const lineId of asStringArray(ticket.readyLineIds)) readyIds.add(lineId);
  }
  return readyIds;
}
