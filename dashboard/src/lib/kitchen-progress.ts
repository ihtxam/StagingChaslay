import type { CartLine } from '@/components/webpos/types';

export type KitchenProgress = {
  /** Lines sent to kitchen */
  sent: number;
  /** Lines marked ready (local cart or KDS) */
  ready: number;
  /** All cart lines */
  total: number;
};

export function kitchenProgressFromLines(lines: CartLine[]): KitchenProgress {
  const sentLines = lines.filter((l) => !!l.sentToKitchen);
  const readyLocal = sentLines.filter((l) => !!l.kitchenReadyAt).length;
  return {
    sent: sentLines.length,
    ready: readyLocal,
    total: lines.length,
  };
}

export function mergeKitchenProgress(
  local: KitchenProgress,
  kds?: { ready?: number; total?: number } | null
): KitchenProgress {
  if (!kds || (!kds.ready && !kds.total)) return local;
  const sent = Math.max(local.sent, kds.total || 0);
  const ready = Math.max(local.ready, kds.ready || 0);
  return { sent, ready: Math.min(ready, sent), total: local.total };
}

/** Normalize kitchen ticket keys (#1234 vs 1234 vs #1234@batch). */
export function kitchenTicketKeyBase(key: string): string {
  const trimmed = String(key || '').trim();
  if (!trimmed) return '';
  const base = trimmed.split('@')[0];
  if (/^#\d+/.test(base)) return base;
  if (/^\d+$/.test(base)) return `#${base}`;
  return base;
}

export function kitchenTicketKeysMatch(a: string, b: string): boolean {
  const aBase = kitchenTicketKeyBase(a);
  const bBase = kitchenTicketKeyBase(b);
  if (!aBase || !bBase) return false;
  return aBase === bBase || a.trim() === b.trim();
}

export function resolveKitchenTicketKey(meta: {
  ticketDisplay?: string | null;
  tabNumber?: string | null;
  ticketOrderNumber?: string | null;
}): string {
  const orderNum = String(meta.ticketOrderNumber || '').trim();
  if (orderNum) return kitchenTicketKeyBase(orderNum);
  const tab = String(meta.tabNumber || '')
    .trim()
    .replace(/^#/, '');
  if (tab) return `#${tab}`;
  return kitchenTicketKeyBase(String(meta.ticketDisplay || '').trim());
}
