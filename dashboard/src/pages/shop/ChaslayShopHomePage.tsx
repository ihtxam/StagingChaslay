import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { CalendarDays, ShoppingBag } from 'lucide-react';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { shopLangStorageKey, useI18n } from '@/lib/i18n';
import { shopDocumentTitle } from '@/lib/brand';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';
import ChaslayHomepageRenderer from '@/chaslay-pagebuilder/ChaslayHomepageRenderer';

type MerchantInfo = {
  name?: string;
  reservationsEnabled?: boolean;
  language?: string;
};

/**
 * Public shop homepage rendered from an active Chaslay Craft.js layout.
 */
export default function ChaslayShopHomePage() {
  const { t, locale, setLocale } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);
  const theme = useShopCmsTheme(shopKey);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorState, setEditorState] = useState('');
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
  const [seoTitle, setSeoTitle] = useState('');

  useEffect(() => {
    if (!shopKey) {
      setLoading(false);
      setError(t('shopNotFound'));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const pageRes = await axios.get(`/api/shop/${shopKey}/pages/home`);
        if (cancelled) return;
        const page = pageRes.data.data;
        if (page.engine !== 'chaslay' || !page.editorState) {
          setError(t('cmsHomeUnavailable'));
          return;
        }
        setMerchant(page.merchant);
        setSeoTitle(page.seoTitle || page.title || page.merchant?.name || '');
        setEditorState(page.editorState);
        const lang = page.merchant?.language;
        if (lang === 'en' || lang === 'fr' || lang === 'de') {
          try {
            const stored = localStorage.getItem(shopLangStorageKey(shopKey));
            if (stored !== 'en' && stored !== 'fr' && stored !== 'de') setLocale(lang);
          } catch {
            setLocale(lang);
          }
        }
      } catch {
        if (!cancelled) setError(t('cmsHomeUnavailable'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, t, setLocale]);

  useEffect(() => {
    if (seoTitle) document.title = shopDocumentTitle(seoTitle);
  }, [seoTitle]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.classList.add('shop-shell');
    return () => document.documentElement.classList.remove('shop-shell');
  }, [locale]);

  const showReservationsNav = Boolean(merchant?.reservationsEnabled);

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: 'var(--shop-bg, #fafaf9)', color: 'var(--shop-text-muted, #78716c)' }}
      >
        {t('loading')}
      </div>
    );
  }

  if (error || !editorState) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-50 px-4 text-center">
        <p className="text-stone-700">{error || t('cmsHomeUnavailable')}</p>
        <Link to={`${base}/menu`} className="text-sm underline">
          {t('shopOrderNow')}
        </Link>
      </div>
    );
  }

  return (
    <ShopThemeShell theme={theme} className="min-h-dvh" style={{ background: 'var(--color-bg-0)' }}>
      <ShopVacationPopup shopKey={shopKey} />
      <div className="cms-homepage pb-24">
        <ChaslayHomepageRenderer editorState={editorState} shopKey={shopKey!} basePath={base} />
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end">
        <div
          className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-md"
          style={{
            borderColor: 'var(--color-border-default)',
            background: 'color-mix(in srgb, var(--color-bg-0) 88%, transparent)',
          }}
        >
          <ShopLangSwitcher menuPlacement="top" />
          {showReservationsNav ? (
            <Link to={`${base}/reservations`} className="shop-btn-secondary inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold">
              <CalendarDays size={14} />
              {t('shopReservations')}
            </Link>
          ) : null}
          <Link to={`${base}/menu`} className="shop-btn-primary inline-flex items-center gap-1 px-3 py-2 text-xs font-bold">
            <ShoppingBag size={14} />
            {t('shopOrderNow')}
          </Link>
        </div>
      </div>
    </ShopThemeShell>
  );
}
