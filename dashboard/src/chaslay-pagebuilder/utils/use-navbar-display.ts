import { useMemo } from 'react';
import { useStorefront } from '../StorefrontContext';
import { resolveTranslatedProp } from './resolve-translated-prop';
import { translateSectionCopy } from './section-copy';
import { constrainStorefrontTopNav, resolveNavbarMenuItems, type NavbarMenuItem } from './navbar-site-nav';

export function useNavbarDisplay(
  props: Record<string, unknown>,
  configuredItems: NavbarMenuItem[] | undefined,
  useSitePagesNav = true
) {
  const { isStorefront, sitePages, locale, defaultLanguage } = useStorefront();
  const menuItems = useMemo(() => {
    const items = resolveNavbarMenuItems(configuredItems, sitePages, useSitePagesNav, isStorefront);
    const translated = items.map((item, i) => {
      const fromProp = resolveTranslatedProp(props, `menuItems_${i}_label`, locale, defaultLanguage);
      const loc = String(locale || defaultLanguage).toLowerCase().slice(0, 2);
      const def = String(defaultLanguage || 'en').toLowerCase().slice(0, 2);
      const hasOverride = Boolean(loc && loc !== def && fromProp.trim());
      return {
        ...item,
        label: hasOverride ? fromProp : translateSectionCopy(fromProp || item.label, locale, defaultLanguage),
      };
    });
    if (!isStorefront) return translated;
    return constrainStorefrontTopNav(translated).map((item) => ({
      ...item,
      label: translateSectionCopy(item.label, locale, defaultLanguage),
    }));
  }, [configuredItems, sitePages, useSitePagesNav, isStorefront, props, locale, defaultLanguage]);
  const t = (key: string) => {
    const resolved = resolveTranslatedProp(props, key, locale, defaultLanguage);
    const base = typeof props[key] === 'string' ? (props[key] as string) : '';
    const loc = String(locale || defaultLanguage).toLowerCase().slice(0, 2);
    const def = String(defaultLanguage || 'en').toLowerCase().slice(0, 2);
    const localized = props[`${key}_${loc}`];
    const hasOverride = Boolean(loc && loc !== def && typeof localized === 'string' && localized.trim());
    const value = resolved || base;
    return hasOverride ? value : translateSectionCopy(value, locale, defaultLanguage);
  };
  return { menuItems, t, isStorefront };
}
