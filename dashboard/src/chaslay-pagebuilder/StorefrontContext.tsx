// @ts-nocheck
'use client';

import React, { createContext, useCallback, useContext } from 'react';
import { resolveStorefrontHref, type StorefrontSurface } from './storefront-href';

export type SitePageLink = {
  title: string;
  slug: string;
  isHomepage: boolean;
  sortOrder?: number;
};

export type MerchantContact = {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
};

export type StorefrontContextValue = {
  shopKey: string;
  basePath: string;
  isStorefront: boolean;
  locale: string;
  setLocale?: (code: string) => void;
  defaultLanguage: string;
  sitePages: SitePageLink[];
  contact: MerchantContact | null;
  surface: StorefrontSurface;
  shopHref: (link?: string | null) => string;
  pageHref: (slug: string, isHomepage?: boolean) => string;
};

const defaultShopHref = (link?: string | null) => String(link || '').trim() || '#';

const StorefrontContext = createContext<StorefrontContextValue>({
  shopKey: '',
  basePath: '',
  isStorefront: false,
  locale: 'en',
  setLocale: undefined,
  defaultLanguage: 'en',
  sitePages: [],
  contact: null,
  surface: 'home',
  shopHref: defaultShopHref,
  pageHref: () => '#',
});

export function StorefrontProvider({
  shopKey,
  basePath,
  locale = 'en',
  onLocaleChange,
  defaultLanguage = 'en',
  sitePages = [],
  contact = null,
  surface = 'home',
  children,
}: {
  shopKey: string;
  basePath: string;
  locale?: string;
  onLocaleChange?: (code: string) => void;
  defaultLanguage?: string;
  sitePages?: SitePageLink[];
  contact?: MerchantContact | null;
  surface?: StorefrontSurface;
  children: React.ReactNode;
}) {
  const shopHref = useCallback(
    (link?: string | null) => resolveStorefrontHref(link, basePath, true, { surface }),
    [basePath, surface]
  );
  const pageHref = useCallback(
    (slug: string, isHomepage?: boolean) => {
      if (isHomepage || slug === 'home') return basePath || '/';
      return `${basePath}/pages/${slug}`;
    },
    [basePath]
  );
  const setLocale = useCallback(
    (code: string) => {
      onLocaleChange?.(code);
    },
    [onLocaleChange]
  );
  return (
    <StorefrontContext.Provider
      value={{
        shopKey,
        basePath,
        isStorefront: true,
        locale,
        setLocale,
        defaultLanguage,
        sitePages,
        contact,
        surface,
        shopHref,
        pageHref,
      }}
    >
      {children}
    </StorefrontContext.Provider>
  );
}

export function useStorefront() {
  return useContext(StorefrontContext);
}
