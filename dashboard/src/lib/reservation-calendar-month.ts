import { ymdZurich } from '@/lib/date-format';

export type CalendarMonthGrid = {
  viewYm: string;
  firstWeekdayMon0: number;
  days: string[];
};

export function calendarViewYmFromDate(ymd = ymdZurich()): string {
  const [y, m] = ymd.split('-');
  return `${y}-${m}-01`;
}

export function shiftCalendarViewYm(viewYm: string, deltaMonths: number): string {
  const [y, m] = viewYm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function buildCalendarMonthGrid(viewYm: string): CalendarMonthGrid {
  const [y, m] = viewYm.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days: string[] = [];
  for (let d = 1; d <= count; d += 1) {
    days.push(
      `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
  }
  const firstWeekdayMon0 = (first.getUTCDay() + 6) % 7;
  return { viewYm, firstWeekdayMon0, days };
}

export function monthRangeIso(viewYm: string): { from: string; to: string } {
  const [y, m] = viewYm.split('-').map(Number);
  const fromYmd = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const toYmd = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from: fromYmd, to: toYmd };
}

export function groupReservationsByYmd<T extends { reservedAt: string }>(
  rows: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const ymd = ymdZurich(row.reservedAt);
    if (!ymd) continue;
    const list = map.get(ymd) || [];
    list.push(row);
    map.set(ymd, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => String(a.reservedAt).localeCompare(String(b.reservedAt)));
  }
  return map;
}
