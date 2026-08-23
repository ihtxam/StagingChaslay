import { useEffect, useState } from 'react';
import axios from 'axios';
import { normalizeShopTheme, type ShopThemeConfig } from '@/lib/shop-theme';

/** Load published CMS theme for shop / menu / reservations pages. */
export function useShopCmsTheme(shopKey: string | undefined) {
  const [theme, setTheme] = useState<ShopThemeConfig | null>(null);

  useEffect(() => {
    if (!shopKey) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/shop/${encodeURIComponent(shopKey)}`);
        const raw = res.data?.data?.cmsTheme;
        if (!cancelled && raw && typeof raw === 'object') {
          setTheme(normalizeShopTheme(raw as Record<string, unknown>));
        }
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey]);

  return theme;
}
