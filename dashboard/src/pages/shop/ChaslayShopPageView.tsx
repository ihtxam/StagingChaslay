import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { shopLangStorageKey, useI18n } from '@/lib/i18n';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';
import { normalizeShopSiteSettings, type ShopSiteSettings } from '@/lib/shop-site-settings';
import ChaslayHomepageRenderer from '@/chaslay-pagebuilder/ChaslayHomepageRenderer';
import type { SitePageLink, MerchantContact } from '@/chaslay-pagebuilder/StorefrontContext';
import { BuilderLanguageProvider } from '@/chaslay-pagebuilder/BuilderLanguageContext';
import ShopFloatingActions from '@/components/shop/ShopFloatingActions';

type MerchantInfo = {
  name?: string;
  shopLogoUrl?: string | null;
  storeHours?: import('@/lib/shop-hours').StoreHours | null;
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
  seoDescription?: string;
  merchant?: MerchantInfo & { site?: ShopSiteSettings | null };
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
  const { t, setLocale, locale } = useI18n();
  const { theme, site: shopSite } = useShopCmsTheme(shopKey);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorState, setEditorState] = useState('');
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [pageSite, setPageSite] = useState<ShopSiteSettings | null>(null);
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
        setSeoDescription(page.seoDescription || '');
        setPageSite(page.merchant?.site ? normalizeShopSiteSettings(page.merchant.site) : null);
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

  const site = pageSite || shopSite;

  useEffect(() => {
    document.documentElement.lang = chaslayLocale;
    document.documentElement.classList.add('shop-shell');
    return () => document.documentElement.classList.remove('shop-shell');
  }, [chaslayLocale]);

  useEffect(() => {
    const next = normalizeChaslayLocale(locale, defaultLanguage);
    setChaslayLocale(next);
    try {
      localStorage.setItem(chaslayLangStorageKey(shopKey), next);
    } catch {
      /* ignore */
    }
  }, [locale, defaultLanguage, shopKey]);

  const showReservationsNav = Boolean(merchant?.reservationsEnabled);

  if (loading) {
    return (
      <ShopThemeShell
        theme={theme}
        site={site}
        pageTitle={seoTitle}
        pageDescription={seoDescription}
        language={chaslayLocale}
      >
        <div
          className="flex min-h-screen items-center justify-center"
          style={{ background: 'var(--shop-bg, #fafaf9)', color: 'var(--shop-text-muted, #78716c)' }}
        >
          {t('loading')}
        </div>
      </ShopThemeShell>
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
      <ShopThemeShell
        theme={theme}
        site={site}
        pageTitle={seoTitle}
        pageDescription={seoDescription}
        language={chaslayLocale}
        className="flex flex-col"
        style={{ background: 'var(--color-bg-0)' }}
      >
        <ShopVacationPopup shopKey={shopKey} />
        <div className="cms-homepage flex flex-col pb-6">
          <ChaslayHomepageRenderer
            key={`${pageSlug}-${chaslayLocale}`}
            editorState={editorState}
            shopKey={shopKey}
            basePath={base}
            locale={chaslayLocale}
            defaultLanguage={defaultLanguage}
            sitePages={sitePages}
            contact={contact}
            merchantDisplayName={merchant?.name || null}
            storeHours={merchant?.storeHours || null}
          />
        </div>
        <ShopFloatingActions basePath={base} showReservations={showReservationsNav} />
      </ShopThemeShell>
    </BuilderLanguageProvider>
  );
}
