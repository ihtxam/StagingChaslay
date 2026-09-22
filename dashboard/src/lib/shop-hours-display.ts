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

export type StoreHoursChannel = 'takeaway' | 'dine_in' | 'delivery';

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

function closedText(locale: string) {
  if (locale === 'de') return 'Geschlossen';
  if (locale === 'fr') return 'Fermé';
  return 'Closed';
}

function channelSource(
  storeHours: StoreHours | null | undefined,
  channel?: StoreHoursChannel
): Record<string, Array<{ open: string; close: string }>> {
  if (channel) {
    return (storeHours?.[channel] || {}) as Record<string, Array<{ open: string; close: string }>>;
  }
  return (
    storeHours?.takeaway ||
    storeHours?.delivery ||
    storeHours?.dine_in ||
    ({} as Record<string, Array<{ open: string; close: string }>>)
  );
}

/** Whether a channel has at least one configured open slot. */
export function hasChannelHours(
  storeHours: StoreHours | null | undefined,
  channel: StoreHoursChannel
): boolean {
  const source = channelSource(storeHours, channel);
  return DAYS.some((d) => !!source[d.key]?.length);
}

/**
 * Collapse consecutive days with identical hours into rows for a single channel.
 */
export function summarizeChannelHours(
  storeHours: StoreHours | null | undefined,
  channel: StoreHoursChannel,
  locale = 'en'
): Array<{ label: string; hours: string }> {
  const source = channelSource(storeHours, channel);
  const texts = DAYS.map((d) => slotsText(source[d.key]));
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

/**
 * Collapse consecutive days with identical hours into rows for the info sheet.
 */
export function summarizeStoreHours(
  storeHours: StoreHours | null | undefined,
  _channels?: unknown,
  locale = 'en'
): Array<{ label: string; hours: string }> {
  const source = channelSource(storeHours);
  const texts = DAYS.map((d) => slotsText(source[d.key]));
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

/** Per-day rows for Chaslay hours sections (24h format, localized closed). */
export function listDailyStoreHours(
  storeHours: StoreHours | null | undefined,
  locale = 'en',
  channel?: StoreHoursChannel
): Array<{ day: string; time: string; open: boolean; dayIndex: number; isToday?: boolean }> {
  const source = channelSource(storeHours, channel);
  const closedLabel = closedText(locale);
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;

  return DAYS.map((d, index) => {
    const slots = source[d.key];
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
