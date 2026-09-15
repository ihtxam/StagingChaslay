import type { StoreHours } from '@/lib/shop-hours';

const DAYS = [
  { key: 'mon', labelEn: 'Monday', labelFr: 'Lundi', labelDe: 'Montag' },
  { key: 'tue', labelEn: 'Tuesday', labelFr: 'Mardi', labelDe: 'Dienstag' },
  { key: 'wed', labelEn: 'Wednesday', labelFr: 'Mercredi', labelDe: 'Mittwoch' },
  { key: 'thu', labelEn: 'Thursday', labelFr: 'Jeudi', labelDe: 'Donnerstag' },
  { key: 'fri', labelEn: 'Friday', labelFr: 'Vendredi', labelDe: 'Freitag' },
  { key: 'sat', labelEn: 'Saturday', labelFr: 'Samedi', labelDe: 'Samstag' },
  { key: 'sun', labelEn: 'Sunday', labelFr: 'Dimanche', labelDe: 'Sonntag' },
] as const;

function dayLabel(key: string, locale: string) {
  const d = DAYS.find((x) => x.key === key);
  if (!d) return key;
  if (locale === 'fr') return d.labelFr;
  if (locale === 'de') return d.labelDe;
  return d.labelEn;
}

function slotsText(slots: Array<{ open: string; close: string }> | undefined) {
  if (!slots?.length) return '-';
  return slots.map((s) => `${s.open}-${s.close}`).join(', ');
}

/**
 * Collapse consecutive days with identical hours into rows for the info sheet.
 */
export function summarizeStoreHours(
  storeHours: StoreHours | null | undefined,
  _channels?: unknown,
  locale = 'en'
): Array<{ label: string; hours: string }> {
  const source =
    storeHours?.takeaway || storeHours?.delivery || storeHours?.dine_in || ({} as Record<string, unknown>);
  const texts = DAYS.map((d) => slotsText((source as any)[d.key]));
  const closedLabel = closedText(locale);
  const rows: Array<{ label: string; hours: string }> = [];
  let i = 0;
  while (i < DAYS.length) {
    let j = i;
    while (j + 1 < DAYS.length && texts[j + 1] === texts[i]) j += 1;
    const label =
      i === j
        ? dayLabel(DAYS[i].key, locale)
        : `${dayLabel(DAYS[i].key, locale)} - ${dayLabel(DAYS[j].key, locale)}`;
    rows.push({ label, hours: texts[i] === '-' ? closedLabel : texts[i] });
    i = j + 1;
  }
  return rows;
}

function closedText(locale: string) {
  if (locale === 'de') return 'Geschlossen';
  if (locale === 'fr') return 'Fermé';
  return 'Closed';
}

/** Per-day rows for Chaslay hours sections (24h format, localized closed). */
export function listDailyStoreHours(
  storeHours: StoreHours | null | undefined,
  locale = 'en'
): Array<{ day: string; time: string; open: boolean; dayIndex: number }> {
  const source =
    storeHours?.takeaway || storeHours?.delivery || storeHours?.dine_in || ({} as Record<string, unknown>);
  const closedLabel = closedText(locale);
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;

  return DAYS.map((d, index) => {
    const slots = (source as Record<string, Array<{ open: string; close: string }>>)[d.key];
    const open = !!slots?.length;
    const time = open ? slots.map((s) => `${s.open}–${s.close}`).join(', ') : closedLabel;
    return {
      day: dayLabel(d.key, locale),
      time,
      open,
      dayIndex: index,
      isToday: index === todayIndex,
    };
  });
}
