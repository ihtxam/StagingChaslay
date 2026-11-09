import type { Locale } from '@/lib/i18n';
import { panelIntlLocale } from '@/lib/panel-intl-locale';

const MERCHANT_TZ = 'Europe/Zurich';

export type ReportTranslate = (key: string, params?: Record<string, string | number>) => string;

function zurichNoonDate(ymd: string): Date {
  const day = ymd.slice(0, 10);
  return new Date(`${day}T12:00:00+02:00`);
}

export function formatReportYmdDisplay(ymd: string, locale: Locale | string): string {
  const day = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return String(ymd || '');
  const loc = panelIntlLocale(locale);
  return new Intl.DateTimeFormat(loc, {
    timeZone: MERCHANT_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(zurichNoonDate(day));
}

export function formatReportWeekdayLong(ymd: string, locale: Locale | string): string {
  const day = String(ymd || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  const loc = panelIntlLocale(locale);
  return new Intl.DateTimeFormat(loc, {
    timeZone: MERCHANT_TZ,
    weekday: 'long',
  }).format(zurichNoonDate(day));
}

export function formatReportMonthLong(month1to12: number, locale: Locale | string): string {
  const m = Math.max(1, Math.min(12, month1to12));
  const ymd = `2024-${String(m).padStart(2, '0')}-15`;
  const loc = panelIntlLocale(locale);
  return new Intl.DateTimeFormat(loc, {
    timeZone: MERCHANT_TZ,
    month: 'long',
  }).format(zurichNoonDate(ymd));
}

export function formatReportPeriodLabel(
  from: string,
  to: string,
  locale: Locale | string
): string {
  const f = String(from || '').slice(0, 10);
  const t = String(to || '').slice(0, 10);
  if (!f) return '';
  if (!t || f === t) return formatReportYmdDisplay(f, locale);
  const sep = locale === 'fr' ? ' au ' : locale === 'de' ? ' bis ' : ' – ';
  return `${formatReportYmdDisplay(f, locale)}${sep}${formatReportYmdDisplay(t, locale)}`;
}

export function localizeReportRangeLabel(
  label: string,
  from: string | undefined,
  to: string | undefined,
  locale: Locale | string
): string {
  if (from && to) return formatReportPeriodLabel(from, to, locale);
  const raw = String(label || '').trim();
  const range = raw.match(/^(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})$/i);
  if (range) return formatReportPeriodLabel(range[1]!, range[2]!, locale);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return formatReportYmdDisplay(raw, locale);
  return raw;
}

/** Short axis label for charts (day within multi-day range). */
export function formatReportChartDayLabel(ymdOrLabel: string, locale: Locale | string): string {
  const raw = String(ymdOrLabel || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const loc = panelIntlLocale(locale);
  return new Intl.DateTimeFormat(loc, {
    timeZone: MERCHANT_TZ,
    day: 'numeric',
    month: 'short',
  }).format(zurichNoonDate(raw));
}

export function reportChannelLabel(channel: string | null | undefined, t: ReportTranslate): string {
  const ch = String(channel || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
  if (ch === 'dine_in' || ch === 'dinein' || ch === 'eat_in') return t('dineIn');
  if (ch === 'delivery') return t('delivery');
  if (ch === 'takeaway' || ch === 'pickup') return t('takeaway');
  if (ch === 'in_store' || ch === 'pos' || ch === 'retail') return t('reportsChannelInStore');
  return channel?.trim() || '—';
}

export function formatReportVatRowLabel(
  row: { label: string; channel?: string; rate?: number },
  t: ReportTranslate
): string {
  if (row.channel) {
    const rate =
      row.rate != null && Number.isFinite(row.rate)
        ? row.rate
        : Number(String(row.label || '').match(/([\d.]+)\s*%/)?.[1]);
    const name = reportChannelLabel(row.channel, t);
    return Number.isFinite(rate) ? `${name} ${rate.toFixed(1)}%` : name;
  }
  const m = String(row.label || '').match(/^(.+?)\s+([\d.]+)%$/);
  if (m) {
    const guess = m[1]!.trim();
    const localized = localizeEnglishChannelName(guess, t);
    return `${localized} ${m[2]}%`;
  }
  return row.label;
}

function localizeEnglishChannelName(name: string, t: ReportTranslate): string {
  const n = name.toLowerCase();
  if (n === 'dine-in' || n === 'dine in') return t('dineIn');
  if (n === 'delivery') return t('delivery');
  if (n === 'takeaway') return t('takeaway');
  if (n === 'in store') return t('reportsChannelInStore');
  return name;
}

export type RevenueBreakdownRow = {
  id: string;
  label: string;
  sublabel?: string;
  total: number;
  from?: string;
  to?: string;
};

export function localizeRevenueBreakdownRows(
  rows: RevenueBreakdownRow[],
  mode: 'days' | 'weeks' | 'months' | 'custom',
  locale: Locale | string,
  t: ReportTranslate
): RevenueBreakdownRow[] {
  return rows.map((row) => {
    if (mode === 'months') {
      const m = Number(String(row.id || '').split('-')[1]);
      if (m >= 1 && m <= 12) {
        return { ...row, label: formatReportMonthLong(m, locale) };
      }
      return row;
    }
    if (mode === 'days' || mode === 'custom') {
      const ymd = /^\d{4}-\d{2}-\d{2}$/.test(row.id) ? row.id : row.from || row.id;
      if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
        return {
          ...row,
          label: formatReportYmdDisplay(ymd, locale),
          sublabel: formatReportWeekdayLong(ymd, locale),
        };
      }
      return row;
    }
    if (mode === 'weeks') {
      const cw = String(row.label || '').match(/^CW\s+(\d+)/i);
      const weekNum = cw ? cw[1] : row.id.replace(/^CW/i, '');
      const label = t('reportsCalendarWeek', { week: weekNum });
      let sublabel = row.sublabel;
      if (row.from && row.to) {
        sublabel = formatReportPeriodLabel(row.from, row.to, locale);
      } else if (sublabel && sublabel.includes(' - ')) {
        const [a, b] = sublabel.split(' - ').map((s) => s.trim());
        const norm = (part: string) => {
          if (/^\d{2}\.\d{2}$/.test(part) && row.from) {
            const [, mo] = row.from.split('-');
            return formatReportYmdDisplay(`${row.from.slice(0, 4)}-${mo}-${part.slice(0, 2)}`, locale);
          }
          if (/^\d{2}\.\d{2}\.\d{4}$/.test(part)) {
            const [da, mo, yr] = part.split('.');
            return formatReportYmdDisplay(`${yr}-${mo}-${da}`, locale);
          }
          return part;
        };
        const sep = locale === 'fr' ? ' au ' : locale === 'de' ? ' bis ' : ' – ';
        sublabel = `${norm(a!)}${sep}${norm(b!)}`;
      }
      return { ...row, label, sublabel };
    }
    return row;
  });
}
