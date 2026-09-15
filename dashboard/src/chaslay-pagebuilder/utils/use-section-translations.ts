import { useStorefront } from '../StorefrontContext';
import { resolveTranslatedProp } from './resolve-translated-prop';
import { translateSectionCopy } from './section-copy';

function hasLocaleOverride(props: Record<string, unknown>, key: string, locale: string, defaultLanguage: string) {
  const loc = String(locale || defaultLanguage).toLowerCase().slice(0, 2);
  const def = String(defaultLanguage || 'en').toLowerCase().slice(0, 2);
  if (!loc || loc === def) return false;
  const localized = props[`${key}_${loc}`];
  return typeof localized === 'string' && localized.trim().length > 0;
}

/** Resolve translatable section props for the active storefront locale. */
export function useSectionTranslations(props: Record<string, unknown>) {
  const { locale, defaultLanguage } = useStorefront();
  const tr = (key: string) => {
    const resolved = resolveTranslatedProp(props, key, locale, defaultLanguage);
    const base = typeof props[key] === 'string' ? (props[key] as string) : '';
    const value = resolved || base;
    if (hasLocaleOverride(props, key, locale, defaultLanguage)) return value;
    return translateSectionCopy(value, locale, defaultLanguage);
  };
  const trText = (value: string | undefined | null) =>
    translateSectionCopy(String(value || ''), locale, defaultLanguage);
  const trList = <T extends { label?: string }>(arrayKey: string, items: T[] | undefined): T[] =>
    (items || []).map((item, i) => {
      const key = `${arrayKey}_${i}_label`;
      const fromProp = resolveTranslatedProp(props, key, locale, defaultLanguage);
      const label = fromProp || trText(item.label || '');
      return { ...item, label };
    });
  const trArrayField = (arrayKey: string, index: number, field: string, fallback: string) => {
    const key = `${arrayKey}_${index}_${field}`;
    const resolved = resolveTranslatedProp(props, key, locale, defaultLanguage);
    const value = resolved || fallback || '';
    if (hasLocaleOverride(props, key, locale, defaultLanguage)) return value;
    return translateSectionCopy(value, locale, defaultLanguage);
  };
  return { tr, trText, trList, trArrayField, locale, defaultLanguage };
}
