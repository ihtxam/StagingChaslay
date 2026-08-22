import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { shopLangStorageKey, useI18n } from '@/lib/i18n';
import { shopDocumentTitle } from '@/lib/brand';
import ShopLangSwitcher from '@/components/shop/ShopLangSwitcher';
import { CalendarDays, ShoppingBag } from 'lucide-react';
import {
  emptyOpenPageBlocks,
  isFullHtmlDocument,
  isOpenPageBlocks,
  resolveOpenPageHtml,
  rewriteOpenPageHtml,
} from '@/lib/cms/openpage-types';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';

/**
 * Public CMS homepage — one surface with the designed OpenPage document.
 * No second site header (avoids double chrome) and no nested page scroll
 * (iframe is viewport-locked; only the designed page scrolls).
 */
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
  const [seoDescription, setSeoDescription] = useState('');
  const [rawBlocks, setRawBlocks] = useState<unknown>(null);

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
        setSeoDescription(page.seoDescription || page.merchant?.description || '');
        setRawBlocks(page.blocks);
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

  // Resolve locale-specific HTML when language changes
  useEffect(() => {
    if (!merchant) return;
    if (isOpenPageBlocks(rawBlocks)) {
      setHtml(rewriteOpenPageHtml(resolveOpenPageHtml(rawBlocks, locale), base));
    } else {
      const fallback = emptyOpenPageBlocks(seoTitle || merchant.name || 'Welcome');
      setHtml(rewriteOpenPageHtml(fallback.html, base));
    }
  }, [rawBlocks, locale, base, merchant, seoTitle]);

  useEffect(() => {
    if (seoTitle) document.title = shopDocumentTitle(seoTitle);
  }, [seoTitle]);

  useEffect(() => {
    const desc = seoDescription.trim();
    if (!desc) return;
    let el = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.name = 'description';
      document.head.appendChild(el);
    }
    el.content = desc.slice(0, 500);
    let og = document.querySelector('meta[property="og:description"]') as HTMLMetaElement | null;
    if (!og) {
      og = document.createElement('meta');
      og.setAttribute('property', 'og:description');
      document.head.appendChild(og);
    }
    og.content = desc.slice(0, 500);
    let ogt = document.querySelector('meta[property="og:title"]') as HTMLMetaElement | null;
    if (!ogt) {
      ogt = document.createElement('meta');
      ogt.setAttribute('property', 'og:title');
      document.head.appendChild(ogt);
    }
    if (seoTitle) ogt.content = seoTitle.slice(0, 200);
  }, [seoDescription, seoTitle]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Lock outer document scroll so only the designed page scrolls (no double scrollbar).
  useEffect(() => {
    const htmlEl = document.documentElement;
    const body = document.body;
    const prevHtml = htmlEl.style.overflow;
    const prevBody = body.style.overflow;
    htmlEl.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      htmlEl.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const showReservationsNav = Boolean(merchant?.reservationsEnabled);
  const useIframe = isFullHtmlDocument(html);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 text-stone-300">
        {t('loading')}
      </div>
    );
  }

  if (error || !merchant) {
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
    <div className="fixed inset-0 overflow-hidden bg-stone-950">
      <ShopVacationPopup shopKey={shopKey} />

      {useIframe ? (
        <iframe
          key={locale}
          title={seoTitle || merchant.name || 'Homepage'}
          srcDoc={html}
          className="absolute inset-0 h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-top-navigation-by-user-activation"
        />
      ) : (
        <div
          key={locale}
          className="absolute inset-0 overflow-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}

      {/* Shop controls — bottom bar avoids overlapping the designed navbar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end">
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-stone-950/85 p-1.5 shadow-2xl backdrop-blur-md">
          <ShopLangSwitcher menuPlacement="top" />
          {showReservationsNav ? (
            <Link
              to={`${base}/reservations`}
              className="inline-flex items-center gap-1 rounded-xl bg-white/95 px-3 py-2 text-xs font-semibold text-stone-900"
            >
              <CalendarDays size={14} />
              {t('shopReservations')}
            </Link>
          ) : null}
          <Link
            to={`${base}/menu`}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-emerald-950"
          >
            <ShoppingBag size={14} />
            {t('shopOrderNow')}
          </Link>
        </div>
      </div>
    </div>
  );
}
