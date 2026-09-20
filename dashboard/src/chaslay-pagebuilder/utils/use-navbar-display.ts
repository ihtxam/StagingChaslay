import { useMemo } from 'react';
import { useStorefront } from '../StorefrontContext';
import { resolveTranslatedProp } from './resolve-translated-prop';
import { translateSectionCopy } from './section-copy';
import {
  buildStorefrontDrawerExtras,
  buildStorefrontTopbarItems,
  resolveNavbarMenuItems,
  type NavbarMenuItem,
} from './navbar-site-nav';

function translateMenuItems(
  items: NavbarMenuItem[],
  props: Record<string, unknown>,
  locale: string,
  defaultLanguage: string
): NavbarMenuItem[] {
  return items.map((item, i) => {
    const fromProp = resolveTranslatedProp(props, `menuItems_${i}_label`, locale, defaultLanguage);
    const loc = String(locale || defaultLanguage).toLowerCase().slice(0, 2);
    const def = String(defaultLanguage || 'en').toLowerCase().slice(0, 2);
    const hasOverride = Boolean(loc && loc !== def && fromProp.trim());
    return {
      ...item,
      label: hasOverride ? fromProp : translateSectionCopy(fromProp || item.label, locale, defaultLanguage),
    };
  });
}

export function useNavbarDisplay(
  props: Record<string, unknown>,
  configuredItems: NavbarMenuItem[] | undefined,
  useSitePagesNav = true
) {
  const {
    isStorefront,
    sitePages,
    locale,
    defaultLanguage,
    giftCardsEnabled,
    reservationsEnabled,
  } = useStorefront();

  const resolvedItems = useMemo(
    () => resolveNavbarMenuItems(configuredItems, sitePages, useSitePagesNav, isStorefront),
    [configuredItems, sitePages, useSitePagesNav, isStorefront]
  );

  const translatedAll = useMemo(
    () => translateMenuItems(resolvedItems, props, locale, defaultLanguage),
    [resolvedItems, props, locale, defaultLanguage]
  );

  const topbarItems = useMemo(() => {
    if (!isStorefront) return translatedAll;
    if (configuredItems?.length) {
      return translateMenuItems(
        buildStorefrontTopbarItems(resolvedItems, {
          showGiftCards: giftCardsEnabled,
          showReservations: reservationsEnabled,
          giftCardLabel: 'Gift Card',
          reservationsLabel: 'Reservations',
        }),
        props,
        locale,
        defaultLanguage
      );
    }
    return translateMenuItems(
      buildStorefrontTopbarItems(resolvedItems, {
        showGiftCards: giftCardsEnabled,
        showReservations: reservationsEnabled,
        giftCardLabel: 'Gift Card',
        reservationsLabel: 'Reservations',
      }),
      props,
      locale,
      defaultLanguage
    );
  }, [
    isStorefront,
    configuredItems?.length,
    resolvedItems,
    translatedAll,
    giftCardsEnabled,
    reservationsEnabled,
    props,
    locale,
    defaultLanguage,
  ]);

  const drawerExtras = useMemo(() => {
    if (!isStorefront) return [] as NavbarMenuItem[];
    const rawTopbar = buildStorefrontTopbarItems(resolvedItems, {
      showGiftCards: giftCardsEnabled,
      showReservations: reservationsEnabled,
    });
    return translateMenuItems(
      buildStorefrontDrawerExtras(resolvedItems, rawTopbar),
      props,
      locale,
      defaultLanguage
    );
  }, [
    isStorefront,
    resolvedItems,
    giftCardsEnabled,
    reservationsEnabled,
    props,
    locale,
    defaultLanguage,
  ]);

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

  return { menuItems: topbarItems, drawerExtras, t, isStorefront };
}
