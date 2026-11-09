import { normalizePanelLang, panelIntlLocale, type PanelLang } from "@/lib/panel-intl-locale";

const MERCHANT_TZ = "Europe/Zurich";

function zurichNoonDate(ymd: string): Date {
  const day = ymd.slice(0, 10);
  return new Date(`${day}T12:00:00+02:00`);
}

export function formatReportYmdDisplay(ymd: string, locale?: string | null): string {
  const day = String(ymd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return String(ymd || "");
  const loc = panelIntlLocale(locale);
  return new Intl.DateTimeFormat(loc, {
    timeZone: MERCHANT_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(zurichNoonDate(day));
}

export function formatReportWeekdayLong(ymd: string, locale?: string | null): string {
  const day = String(ymd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  const loc = panelIntlLocale(locale);
  return new Intl.DateTimeFormat(loc, {
    timeZone: MERCHANT_TZ,
    weekday: "long",
  }).format(zurichNoonDate(day));
}

export function formatReportMonthLong(month1to12: number, locale?: string | null): string {
  const m = Math.max(1, Math.min(12, month1to12));
  const ymd = `2024-${String(m).padStart(2, "0")}-15`;
  const loc = panelIntlLocale(locale);
  return new Intl.DateTimeFormat(loc, {
    timeZone: MERCHANT_TZ,
    month: "long",
  }).format(zurichNoonDate(ymd));
}

export function formatReportPeriodLabel(
  from: string,
  to: string,
  locale?: string | null
): string {
  const f = String(from || "").slice(0, 10);
  const t = String(to || "").slice(0, 10);
  if (!f) return "";
  if (!t || f === t) return formatReportYmdDisplay(f, locale);
  const lang = normalizePanelLang(locale);
  const sep = lang === "fr" ? " au " : lang === "de" ? " bis " : " – ";
  return `${formatReportYmdDisplay(f, locale)}${sep}${formatReportYmdDisplay(t, locale)}`;
}

export function localizeReportRangeLabel(
  from: string,
  to: string,
  locale?: string | null
): string {
  return formatReportPeriodLabel(from, to, locale);
}

const CHANNEL_LABELS: Record<PanelLang, Record<string, string>> = {
  en: {
    dine_in: "Dine-in",
    delivery: "Delivery",
    takeaway: "Takeaway",
    in_store: "In store",
    pos: "In store",
    retail: "In store",
  },
  fr: {
    dine_in: "Sur place",
    delivery: "Livraison",
    takeaway: "À emporter",
    in_store: "En magasin",
    pos: "En magasin",
    retail: "En magasin",
  },
  de: {
    dine_in: "Vor Ort",
    delivery: "Lieferung",
    takeaway: "Takeaway",
    in_store: "Im Laden",
    pos: "Im Laden",
    retail: "Im Laden",
  },
};

export function reportChannelLabel(channel: string, locale?: string | null): string {
  const lang = normalizePanelLang(locale);
  const ch = String(channel || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  return CHANNEL_LABELS[lang][ch] || CHANNEL_LABELS.en[ch] || channel || "";
}

export function formatReportChartDayShort(ymd: string, locale?: string | null): string {
  const day = String(ymd || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return String(ymd || "");
  const loc = panelIntlLocale(locale);
  return new Intl.DateTimeFormat(loc, {
    timeZone: MERCHANT_TZ,
    day: "numeric",
    month: "short",
  }).format(zurichNoonDate(day));
}

export function reportCalendarWeekLabel(week: number | string, locale?: string | null): string {
  const lang = normalizePanelLang(locale);
  const n = String(week);
  if (lang === "fr") return `SC ${n}`;
  if (lang === "de") return `KW ${n}`;
  return `CW ${n}`;
}
