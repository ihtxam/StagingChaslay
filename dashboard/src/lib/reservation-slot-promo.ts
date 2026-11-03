/** Client-side helpers mirroring backend reservation-slot-promo (shop UI). */

export type ReservationSlotPromoKind = 'percent' | 'free_wine' | 'dine_free';

export type ReservationSlotPromo = {
  id: string;
  name: string;
  kind?: ReservationSlotPromoKind;
  percentOff?: number;
  payCovers?: number;
  receiveCovers?: number;
  scheduleMode?: 'specific_days' | 'whole_week';
  daysOfWeek?: string[];
  timeStart?: string | null;
  timeEnd?: string | null;
  specificTimes?: string[];
  peekMessage?: string | null;
  enabled?: boolean;
};

export type PeekBanner = {
  message: string;
  icon: 'percent' | 'wine' | 'dine';
};

export function promoKindIcon(kind: ReservationSlotPromoKind): PeekBanner['icon'] {
  if (kind === 'free_wine') return 'wine';
  if (kind === 'dine_free') return 'dine';
  return 'percent';
}

function defaultPromoLabel(p: ReservationSlotPromo): string {
  const kind = p.kind || (p.percentOff ? 'percent' : 'percent');
  if (kind === 'free_wine') return p.name?.trim() || '1 free wine bottle';
  if (kind === 'dine_free') {
    const pay = Math.max(1, Number(p.payCovers) || 3);
    const recv = Math.max(pay + 1, Number(p.receiveCovers) || 4);
    return p.name?.trim() || `Book ${recv} pay ${pay}`;
  }
  const pct = Math.min(90, Math.max(1, Number(p.percentOff) || 10));
  return p.name?.trim() || `${pct}% off`;
}

function defaultPeekMessage(p: ReservationSlotPromo): string {
  const custom = p.peekMessage?.trim();
  if (custom) return custom;
  const kind = p.kind || 'percent';
  if (kind === 'percent') {
    const pct = Math.min(90, Math.max(1, Number(p.percentOff) || 10));
    return `${pct}% off — click to explore. Available on selected days and times only.`;
  }
  if (kind === 'free_wine') {
    return 'Free wine bottle with your table — selected evenings only. Tap to book.';
  }
  const pay = Math.max(1, Number(p.payCovers) || 3);
  const recv = Math.max(pay + 1, Number(p.receiveCovers) || 4);
  return `Book for ${recv}, pay for ${pay}. This offer is only available on certain days and time slots.`;
}

export function peekBannerForDate(
  promos: ReservationSlotPromo[],
  dayKey: string,
): PeekBanner | null {
  for (const p of promos) {
    if (p.enabled === false) continue;
    const wholeWeek = p.scheduleMode === 'whole_week';
    const days = p.daysOfWeek || [];
    if (!wholeWeek && days.length && !days.includes(dayKey)) continue;
    const kind: ReservationSlotPromoKind =
      p.kind === 'free_wine' || p.kind === 'dine_free' || p.kind === 'percent'
        ? p.kind
        : 'percent';
    return {
      message: defaultPeekMessage({ ...p, kind }),
      icon: promoKindIcon(kind),
    };
  }
  return null;
}

export function dayKeyFromYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const short = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Europe/Zurich' }).format(
    dt,
  );
  const map: Record<string, string> = {
    Sun: 'sun',
    Mon: 'mon',
    Tue: 'tue',
    Wed: 'wed',
    Thu: 'thu',
    Fri: 'fri',
    Sat: 'sat',
  };
  return map[short] || 'mon';
}
