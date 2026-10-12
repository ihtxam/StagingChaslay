/** Timestamps used to place POS Commandes cards (newest = top-left, then LTR). */

export type PosBoardTimeFields = {
  createdAt?: string | number | Date | null;
  updatedAt?: string | number | Date | null;
  completedAt?: string | number | Date | null;
};

export function toPosBoardTimeMs(raw: string | number | Date | null | undefined): number {
  if (raw == null || raw === '') return 0;
  const n = new Date(raw as string | number | Date).getTime();
  return Number.isFinite(n) ? n : 0;
}

/**
 * Prefer createdAt — same "when this ticket appeared" clock the board age uses
 * (`time || now`). Fall back to updated/completed only when createdAt is missing.
 * Missing timestamps sort as newest so a just-placed local ticket stays top-left.
 */
export function posBoardItemTimeMs(row: PosBoardTimeFields, nowMs = Date.now()): number {
  return (
    toPosBoardTimeMs(row.createdAt) ||
    toPosBoardTimeMs(row.updatedAt) ||
    toPosBoardTimeMs(row.completedAt) ||
    nowMs
  );
}

export function comparePosBoardNewestFirst(a: PosBoardTimeFields, b: PosBoardTimeFields, nowMs = Date.now()): number {
  return posBoardItemTimeMs(b, nowMs) - posBoardItemTimeMs(a, nowMs);
}

export function sortPosBoardNewestFirst<T extends PosBoardTimeFields>(items: T[], nowMs = Date.now()): T[] {
  return [...items].sort((a, b) => comparePosBoardNewestFirst(a, b, nowMs));
}
