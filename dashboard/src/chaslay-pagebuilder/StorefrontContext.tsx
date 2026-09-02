// @ts-nocheck
'use client';

import React, { createContext, useCallback, useContext } from 'react';
import { resolveStorefrontHref } from './storefront-href';

export type StorefrontContextValue = {
  shopKey: string;
  basePath: string;
  isStorefront: boolean;
  shopHref: (link?: string | null) => string;
};

const defaultShopHref = (link?: string | null) => String(link || '').trim() || '#';

const StorefrontContext = createContext<StorefrontContextValue>({
  shopKey: '',
  basePath: '',
  isStorefront: false,
  shopHref: defaultShopHref,
});

export function StorefrontProvider({
  shopKey,
  basePath,
  children,
}: {
  shopKey: string;
  basePath: string;
  children: React.ReactNode;
}) {
  const shopHref = useCallback(
    (link?: string | null) => resolveStorefrontHref(link, basePath, true),
    [basePath]
  );
  return (
    <StorefrontContext.Provider value={{ shopKey, basePath, isStorefront: true, shopHref }}>
      {children}
    </StorefrontContext.Provider>
  );
}

export function useStorefront() {
  return useContext(StorefrontContext);
}
