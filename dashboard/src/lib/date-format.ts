import {
  addCalendarDaysZurich,
  MERCHANT_TZ,
  pad2,
  zonedLocalDate,
} from '@/lib/shop-hours';

export { MERCHANT_TZ };

export type DateInput = string | number | Date | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input == null || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Calendar date YYYY-MM-DD in Europe/Zurich (API / filter keys). */
export function ymdZurich(input: DateInput = new Date()): string {
  const d = toDate(input);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: MERCHANT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** User-facing calendar date: DD-MM-YYYY */
export function formatDateDDMMYYYY(input: DateInput): string {
  const ymd = ymdZurich(input);
  if (!ymd) return '';
  const [y, m, day] = ymd.split('-');
  return `${day}-${m}-${y}`;
}

/** User-facing time: HH:mm (24h, Europe/Zurich) */
export function formatTimeHHMM(input: DateInput): string {
  const d = toDate(input);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: MERCHANT_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/** User-facing date + time: DD-MM-YYYY HH:mm */
export function formatDateTimeDDMMYYYY(input: DateInput): string {
  const datePart = formatDateDDMMYYYY(input);
  if (!datePart) return '';
  const timePart = formatTimeHHMM(input);
  return timePart ? `${datePart} ${timePart}` : datePart;
}

/** YYYY-MM-DD and HH:mm in merchant TZ for reservation form fields. */
export function reservationFormParts(input: DateInput): { date: string; time: string } {
  return {
    date: ymdZurich(input),
    time: formatTimeHHMM(input),
  };
}

/** Today + N calendar days as YYYY-MM-DD in merchant TZ. */
export function addDaysYmdZurich(days: number, from: DateInput = new Date()): string {
  const baseYmd = ymdZurich(from);
  if (!baseYmd) return '';
  const [y, m, d] = baseYmd.split('-').map(Number);
  const noon = zonedLocalDate(y, m, d, 12, 0);
  const next = addCalendarDaysZurich(noon, days);
  return `${next.year}-${pad2(next.month)}-${pad2(next.day)}`;
}

/** Start of a merchant-TZ calendar day (00:00) as UTC Date. */
export function zurichDayStartFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return zonedLocalDate(y, m, d, 0, 0);
}

/** End of a merchant-TZ calendar day (23:59:59.999) as UTC Date. */
export function zurichDayEndFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  const next = addCalendarDaysZurich(zonedLocalDate(y, m, d, 12, 0), 1);
  return new Date(zonedLocalDate(next.year, next.month, next.day, 0, 0).getTime() - 1);
}
