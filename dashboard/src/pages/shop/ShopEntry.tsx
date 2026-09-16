import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey } from '@/lib/shop-cart';
import OrderingPage from './OrderingPage';
import ShopHomePage from './ShopHomePage';
import ChaslayShopHomePage from './ChaslayShopHomePage';
import { useI18n } from '@/lib/i18n';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import { normalizeShopSiteSettings, type ShopSiteSettings } from '@/lib/shop-site-settings';

/**
 * Shop root: CMS homepage when published + enabled, otherwise the ordering menu.
 */
export default function ShopEntry() {
  const { t } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const [mode, setMode] = useState<'loading' | 'cms' | 'chaslay' | 'menu'>('loading');
  const [site, setSite] = useState<ShopSiteSettings | null>(null);

  useEffect(() => {
    if (!shopKey) {
      setMode('menu');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`/api/shop/${shopKey}`);
        const data = res.data.data;
        if (cancelled) return;
        setSite(normalizeShopSiteSettings(data?.site));
        if (data?.cmsHomepageEnabled) {
          try {
            const homeRes = await axios.get(`/api/shop/${shopKey}/pages/home`);
            if (!cancelled) {
              setMode(homeRes.data?.data?.engine === 'chaslay' ? 'chaslay' : 'cms');
            }
            return;
          } catch {
            /* fall through to menu */
          }
        }
        if (!cancelled) setMode('menu');
      } catch {
        if (!cancelled) setMode('menu');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey]);

  if (mode === 'loading') {
    return (
      <ShopThemeShell site={site}>
        <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-600">
          {t('loading')}
        </div>
      </ShopThemeShell>
    );
  }
  if (mode === 'chaslay') return <ChaslayShopHomePage />;
  if (mode === 'cms') return <ShopHomePage />;
  return <OrderingPage />;
}
