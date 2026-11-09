import type { Locale } from '@/lib/i18n';

/** Append panel locale so report APIs return localized date/channel labels. */
export function appendReportLocale(params: URLSearchParams, locale: Locale | string): URLSearchParams {
  const lang = String(locale || 'en').slice(0, 2);
  if (lang === 'en' || lang === 'fr' || lang === 'de') {
    params.set('locale', lang);
  }
  return params;
}
