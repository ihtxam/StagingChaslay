import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { useI18n } from '@/lib/i18n';
import { shopDocumentTitle } from '@/lib/brand';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import { CalendarDays, ShoppingBag } from 'lucide-react';
import {
  emptyOpenPageBlocks,
  isFullHtmlDocument,
  isOpenPageBlocks,
  rewriteOpenPageHtml,
} from '@/lib/cms/openpage-types';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';

export default function ShopHomePage() {
  const { t, locale, setLocale } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const base = shopBasePath(shopKey);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState('');
  const [merchant, setMerchant] = useState<any>(null);
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
        setMerchant(page.merchant);
        setSeoTitle(page.seoTitle || page.title || page.merchant?.name || '');
        if (isOpenPageBlocks(page.blocks) && page.blocks.html) {
          setHtml(rewriteOpenPageHtml(page.blocks.html, base));
        } else {
          const fallback = emptyOpenPageBlocks(page.title || page.merchant?.name || 'Welcome');
          setHtml(rewriteOpenPageHtml(fallback.html, base));
        }
        const lang = page.merchant?.language;
        if (lang === 'en' || lang === 'fr' || lang === 'de') {
          try {
            const stored = localStorage.getItem('manupos_shop_lang');
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
  }, [shopKey, t, setLocale, base]);

  useEffect(() => {
    if (seoTitle) document.title = shopDocumentTitle(seoTitle);
  }, [seoTitle]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const showReservationsNav = Boolean(merchant?.reservationsEnabled);
  const useIframe = isFullHtmlDocument(html);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 text-stone-600">
        {t('loading')}
      </div>
    );
  }

  if (error || !merchant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-stone-50 px-4 text-center">
        <p className="text-stone-700">{error || t('cmsHomeUnavailable')}</p>
        <Link to={`${base}/menu`} className="underline text-sm">
          {t('shopOrderNow')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-stone-900">
      <ShopVacationPopup shopKey={shopKey} />
      <header className="sticky top-0 z-20 shrink-0 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <p className="truncate text-sm font-semibold">{merchant.name}</p>
          <div className="flex items-center gap-2">
            <ShopLangSwitcher />
            {showReservationsNav ? (
              <Link
                to={`${base}/reservations`}
                className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs font-semibold"
              >
                <CalendarDays size={14} />
                {t('shopReservations')}
              </Link>
            ) : null}
            <Link
              to={`${base}/menu`}
              className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-2.5 py-1.5 text-xs font-semibold text-white"
            >
              <ShoppingBag size={14} />
              {t('shopOrderNow')}
            </Link>
          </div>
        </div>
      </header>

      {/*
        OpenPage exports rely on Tailwind Play CDN + theme <script> in <head>.
        Injecting only the body via dangerouslySetInnerHTML drops those scripts
        (and browsers won't run script tags from innerHTML), so the page looks
        unstyled / "mobile". Render the full document in an iframe instead.
      */}
      {useIframe ? (
        <iframe
          title={seoTitle || merchant.name || 'Homepage'}
          srcDoc={html}
          className="block w-full flex-1 border-0 bg-white"
          style={{ minHeight: 'calc(100vh - 57px)' }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"
        />
      ) : (
        <div
          className="cms-openpage-page flex-1"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
