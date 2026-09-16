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
      const label = hasLocaleOverride(props, key, locale, defaultLanguage)
        ? fromProp || String(item.label || '')
        : fromProp || trText(item.label || '');
      return { ...item, label };
    });
  const trArrayField = (arrayKey: string, index: number, field: string, baseValue: string | undefined | null) => {
    const key = `${arrayKey}_${index}_${field}`;
    const resolved = resolveTranslatedProp(props, key, locale, defaultLanguage);
    const base = String(baseValue || '');
    const value = resolved || base;
    if (hasLocaleOverride(props, key, locale, defaultLanguage)) return value;
    return translateSectionCopy(value, locale, defaultLanguage);
  };
  // Named function (no default params) — Safari/iOS crashed with
  // "r is not a function" when trTestimonials was an object-literal arrow
  // with a default argument.
  function trTestimonials<
    T extends { text?: string; author?: string; role?: string; rating?: number; photo?: string },
  >(items: T[] | undefined, arrayKey?: string): T[] {
    const key = arrayKey || 'testimonials';
    const list = Array.isArray(items) ? items : [];
    return list.map((item, i) => ({
      ...item,
      text: trArrayField(key, i, 'text', item.text),
      author: trArrayField(key, i, 'author', item.author),
      role: item.role ? trArrayField(key, i, 'role', item.role) : item.role,
    }));
  }
  return { tr, trText, trList, trArrayField, trTestimonials, locale, defaultLanguage };
}
