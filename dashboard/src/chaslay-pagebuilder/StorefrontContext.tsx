// @ts-nocheck
'use client';

import React, { createContext, useCallback, useContext } from 'react';
import { resolveStorefrontHref } from './storefront-href';

export type SitePageLink = {
  title: string;
  slug: string;
  isHomepage: boolean;
  sortOrder?: number;
};

export type StorefrontContextValue = {
  shopKey: string;
  basePath: string;
  isStorefront: boolean;
  locale: string;
  defaultLanguage: string;
  sitePages: SitePageLink[];
  shopHref: (link?: string | null) => string;
  pageHref: (slug: string, isHomepage?: boolean) => string;
};

const defaultShopHref = (link?: string | null) => String(link || '').trim() || '#';

const StorefrontContext = createContext<StorefrontContextValue>({
  shopKey: '',
  basePath: '',
  isStorefront: false,
  locale: 'en',
  defaultLanguage: 'en',
  sitePages: [],
  shopHref: defaultShopHref,
  pageHref: () => '#',
});

export function StorefrontProvider({
  shopKey,
  basePath,
  locale = 'en',
  defaultLanguage = 'en',
  sitePages = [],
  children,
}: {
  shopKey: string;
  basePath: string;
  locale?: string;
  defaultLanguage?: string;
  sitePages?: SitePageLink[];
  children: React.ReactNode;
}) {
  const shopHref = useCallback(
    (link?: string | null) => resolveStorefrontHref(link, basePath, true),
    [basePath]
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
