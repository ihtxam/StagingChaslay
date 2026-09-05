import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { CalendarDays, ShoppingBag } from 'lucide-react';
import { shopLangStorageKey, useI18n } from '@/lib/i18n';
import { shopDocumentTitle } from '@/lib/brand';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';
import ChaslayHomepageRenderer from '@/chaslay-pagebuilder/ChaslayHomepageRenderer';
import type { SitePageLink, MerchantContact } from '@/chaslay-pagebuilder/StorefrontContext';
import { BuilderLanguageProvider } from '@/chaslay-pagebuilder/BuilderLanguageContext';
import ChaslayLangSwitcher from '@/chaslay-pagebuilder/components/ChaslayLangSwitcher';

type MerchantInfo = {
  name?: string;
  reservationsEnabled?: boolean;
  language?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
};

type ChaslayPagePayload = {
  engine: string;
  editorState?: string;
  title?: string;
  seoTitle?: string;
  merchant?: MerchantInfo;
};

type ChaslayLocale = 'en' | 'fr' | 'de' | 'it';

function chaslayLangStorageKey(shopKey: string): string {
  return `chaslay_builder_lang:${shopKey.trim().toLowerCase()}`;
}

function normalizeChaslayLocale(raw: string | null | undefined, fallback = 'en'): ChaslayLocale {
  const code = String(raw || fallback).toLowerCase().slice(0, 2);
  if (code === 'fr' || code === 'de' || code === 'it') return code;
  return 'en';
}

type Props = {
  shopKey: string;
  base: string;
  pageSlug?: string;
};

/**
 * Shared shell for Chaslay builder pages on the public shop (home + extra pages).
 */
export default function ChaslayShopPageView({ shopKey, base, pageSlug = 'home' }: Props) {
  const { t, setLocale } = useI18n();
  const theme = useShopCmsTheme(shopKey);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorState, setEditorState] = useState('');
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
  const [seoTitle, setSeoTitle] = useState('');
  const [sitePages, setSitePages] = useState<SitePageLink[]>([]);
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [chaslayLocale, setChaslayLocale] = useState<ChaslayLocale>('en');
  const [contact, setContact] = useState<MerchantContact | null>(null);

  const apiPath = useMemo(
    () => `/api/shop/${shopKey}/pages/${pageSlug}`,
    [shopKey, pageSlug]
  );

  useEffect(() => {
    if (!shopKey) {
      setLoading(false);
      setError(t('shopNotFound'));
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [pageRes, navRes] = await Promise.all([
          axios.get(apiPath),
          axios.get(`/api/shop/${shopKey}/site-pages`).catch(() => null),
        ]);
        if (cancelled) return;
        const page = pageRes.data.data as ChaslayPagePayload;
        if (page.engine !== 'chaslay' || !page.editorState) {
          setError(t('cmsHomeUnavailable'));
          return;
        }
        setMerchant(page.merchant || null);
        setSeoTitle(page.seoTitle || page.title || page.merchant?.name || '');
        setEditorState(page.editorState);
        const m = page.merchant;
        if (m) {
          setContact({
            phone: m.phone,
            email: m.email,
            address: m.address,
            city: m.city,
            country: m.country,
          });
        }
        const lang = m?.language;
        const defaultLang = normalizeChaslayLocale(lang, 'en');
        setDefaultLanguage(defaultLang);
        let initialLocale = defaultLang;
        try {
          const storedChaslay = localStorage.getItem(chaslayLangStorageKey(shopKey));
          if (storedChaslay) initialLocale = normalizeChaslayLocale(storedChaslay, defaultLang);
          else {
            const storedShop = localStorage.getItem(shopLangStorageKey(shopKey));
            if (storedShop) initialLocale = normalizeChaslayLocale(storedShop, defaultLang);
          }
        } catch {
          /* ignore storage errors */
        }
        setChaslayLocale(initialLocale);
        if (initialLocale === 'en' || initialLocale === 'fr' || initialLocale === 'de') {
          setLocale(initialLocale);
        } else if (lang === 'en' || lang === 'fr' || lang === 'de') {
          setLocale(lang);
        }
        const navRows = navRes?.data?.data;
        if (Array.isArray(navRows)) {
          setSitePages(
            navRows.map((p: SitePageLink & { sortOrder?: number }) => ({
              title: p.title,
              slug: p.slug,
              isHomepage: p.isHomepage,
              sortOrder: p.sortOrder,
            }))
          );
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
  }, [shopKey, apiPath, t, setLocale]);

  useEffect(() => {
    if (seoTitle) document.title = shopDocumentTitle(seoTitle);
  }, [seoTitle]);

  useEffect(() => {
    document.documentElement.lang = chaslayLocale;
    document.documentElement.classList.add('shop-shell');
    return () => document.documentElement.classList.remove('shop-shell');
  }, [chaslayLocale]);

  const handleChaslayLocaleChange = (code: ChaslayLocale) => {
    setChaslayLocale(code);
    try {
      localStorage.setItem(chaslayLangStorageKey(shopKey), code);
    } catch {
      /* ignore */
    }
  };

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
    <BuilderLanguageProvider locale={chaslayLocale} defaultLanguage={defaultLanguage}>
      <ShopThemeShell theme={theme} className="min-h-dvh" style={{ background: 'var(--color-bg-0)' }}>
        <ShopVacationPopup shopKey={shopKey} />
        <div className="cms-homepage pb-24">
          <ChaslayHomepageRenderer
            key={`${pageSlug}-${chaslayLocale}`}
            editorState={editorState}
            shopKey={shopKey}
            basePath={base}
            locale={chaslayLocale}
            defaultLanguage={defaultLanguage}
            sitePages={sitePages}
            contact={contact}
          />
        </div>
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:justify-end">
          <div
            className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border p-1.5 shadow-2xl backdrop-blur-md"
            style={{
              borderColor: 'var(--color-border-default)',
              background: 'color-mix(in srgb, var(--color-bg-0) 88%, transparent)',
            }}
          >
            <ChaslayLangSwitcher
              menuPlacement="top"
              locale={chaslayLocale}
              onLocaleChange={handleChaslayLocaleChange}
            />
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
    </BuilderLanguageProvider>
  );
}
