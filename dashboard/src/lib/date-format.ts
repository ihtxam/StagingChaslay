import { MERCHANT_TZ } from '@/lib/shop-hours';

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
