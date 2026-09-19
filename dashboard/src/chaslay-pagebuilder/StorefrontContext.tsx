// @ts-nocheck
'use client';

import React, { createContext, useCallback, useContext } from 'react';
import { resolveStorefrontHref, type StorefrontSurface } from './storefront-href';
import { useShopLoggedIn } from '@/hooks/useShopLoggedIn';

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
  defaultLanguage: string;
  sitePages: SitePageLink[];
  contact: MerchantContact | null;
  merchantDisplayName: string | null;
  accountPath: string;
  storeHours: import('@/lib/shop-hours').StoreHours | null;
  surface: StorefrontSurface;
  shopHref: (link?: string | null) => string;
  pageHref: (slug: string, isHomepage?: boolean) => string;
  loggedIn: boolean;
};

const defaultShopHref = (link?: string | null) => String(link || '').trim() || '#';

const StorefrontContext = createContext<StorefrontContextValue>({
  shopKey: '',
  basePath: '',
  isStorefront: false,
  locale: 'en',
  defaultLanguage: 'en',
  sitePages: [],
  contact: null,
  merchantDisplayName: null,
  accountPath: '',
  storeHours: null,
  surface: 'home',
  shopHref: defaultShopHref,
  pageHref: () => '#',
  loggedIn: false,
});

export function StorefrontProvider({
  shopKey,
  basePath,
  locale = 'en',
  defaultLanguage = 'en',
  sitePages = [],
  contact = null,
  merchantDisplayName = null,
  accountPath = '',
  storeHours = null,
  surface = 'home',
  children,
}: {
  shopKey: string;
  basePath: string;
  locale?: string;
  defaultLanguage?: string;
  sitePages?: SitePageLink[];
  contact?: MerchantContact | null;
  merchantDisplayName?: string | null;
  accountPath?: string;
  storeHours?: import('@/lib/shop-hours').StoreHours | null;
  surface?: StorefrontSurface;
  children: React.ReactNode;
}) {
  const loggedIn = useShopLoggedIn(shopKey);
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
  return (
    <StorefrontContext.Provider
      value={{
        shopKey,
        basePath,
        isStorefront: true,
        locale,
        defaultLanguage,
        sitePages,
        contact,
        merchantDisplayName,
        accountPath: accountPath || `${basePath}/account`.replace(/\/+/g, '/'),
        storeHours,
        surface,
        shopHref,
        pageHref,
        loggedIn,
      }}
    >
      {children}
    </StorefrontContext.Provider>
  );
}

export function useStorefront() {
  return useContext(StorefrontContext);
}
