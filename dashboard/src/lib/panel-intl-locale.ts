import type { Locale } from '@/lib/i18n';

/** BCP 47 tag for Swiss panel date/time formatting (weekdays, months). */
export function panelIntlLocale(locale: Locale | string | null | undefined): string {
  const l = String(locale || 'en')
    .trim()
    .toLowerCase()
    .slice(0, 2);
  if (l === 'fr') return 'fr-CH';
  if (l === 'de') return 'de-CH';
  return 'en-CH';
}
