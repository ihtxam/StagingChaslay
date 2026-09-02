/** Resolve a block prop for the active storefront locale (suffix keys like `title_fr`). */
export function resolveTranslatedProp(
  props: Record<string, unknown> | null | undefined,
  key: string,
  locale: string,
  defaultLanguage = 'en'
): string {
  if (!props) return '';
  const base = props[key];
  const loc = String(locale || defaultLanguage).toLowerCase().slice(0, 2);
  const def = String(defaultLanguage || 'en').toLowerCase().slice(0, 2);
  if (loc && loc !== def) {
    const localized = props[`${key}_${loc}`];
    if (typeof localized === 'string' && localized.trim()) return localized;
  }
  return typeof base === 'string' ? base : '';
}
