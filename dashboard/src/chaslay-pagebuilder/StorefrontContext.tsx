// @ts-nocheck
'use client';

import React, { createContext, useContext } from 'react';

export type StorefrontContextValue = {
  shopKey: string;
  basePath: string;
  isStorefront: boolean;
};

const StorefrontContext = createContext<StorefrontContextValue>({
  shopKey: '',
  basePath: '',
  isStorefront: false,
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
  return (
    <StorefrontContext.Provider value={{ shopKey, basePath, isStorefront: true }}>
      {children}
    </StorefrontContext.Provider>
  );
}

export function useStorefront() {
  return useContext(StorefrontContext);
}
