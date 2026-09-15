import { useEffect, useState } from 'react';
import axios from 'axios';
import { normalizeShopTheme, type ShopThemeConfig } from '@/lib/shop-theme';
import { normalizeShopSiteSettings, type ShopSiteSettings } from '@/lib/shop-site-settings';

/** Load published CMS theme + global shop site settings for shop surfaces. */
export function useShopCmsTheme(shopKey: string | undefined) {
  const [theme, setTheme] = useState<ShopThemeConfig | null>(null);
  const [site, setSite] = useState<ShopSiteSettings | null>(null);

  useEffect(() => {
    if (!shopKey) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/shop/${encodeURIComponent(shopKey)}`);
        if (cancelled) return;
        const rawTheme = res.data?.data?.cmsTheme;
        if (rawTheme && typeof rawTheme === 'object') {
          setTheme(normalizeShopTheme(rawTheme as Record<string, unknown>));
        }
        setSite(normalizeShopSiteSettings(res.data?.data?.site));
      } catch {
        /* optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey]);

  return { theme, site };
}
