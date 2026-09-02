import { useMemo } from 'react';
import { useStorefront } from '../StorefrontContext';
import { resolveTranslatedProp } from './resolve-translated-prop';
import { resolveNavbarMenuItems, type NavbarMenuItem } from './navbar-site-nav';

export function useNavbarDisplay(
  props: Record<string, unknown>,
  configuredItems: NavbarMenuItem[] | undefined,
  useSitePagesNav = true
) {
  const { isStorefront, sitePages, locale, defaultLanguage } = useStorefront();
  const menuItems = useMemo(
    () => resolveNavbarMenuItems(configuredItems, sitePages, useSitePagesNav, isStorefront),
    [configuredItems, sitePages, useSitePagesNav, isStorefront]
  );
  const t = (key: string) => resolveTranslatedProp(props, key, locale, defaultLanguage);
  return { menuItems, t, isStorefront };
}
