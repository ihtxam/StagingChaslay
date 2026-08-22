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

export function resolveKitchenTicketKey(meta: {
  ticketDisplay?: string | null;
  tabNumber?: string | null;
}): string {
  const tab = String(meta.tabNumber || '')
    .trim()
    .replace(/^#/, '');
  if (tab) return `#${tab}`;
  return String(meta.ticketDisplay || '')
    .trim()
    .split('@')[0];
}
