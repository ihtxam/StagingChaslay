// @ts-nocheck
'use client';

import { useMemo } from 'react';
import { useStorefront } from '../StorefrontContext';
import { listDailyStoreHours } from '@/lib/shop-hours-display';

export function useStorefrontHours() {
  const { storeHours, locale } = useStorefront();
  return useMemo(() => listDailyStoreHours(storeHours, locale), [storeHours, locale]);
}
