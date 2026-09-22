import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import DOMPurify from 'isomorphic-dompurify';
import { useI18n } from '@/lib/i18n';
import ShopVacationPopup, { type ShopVacationInfo } from '@/components/shop/ShopVacationPopup';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import ShopMinimalHeader from '@/components/shop/ShopMinimalHeader';
import ShopTopShell from '@/components/shop/ShopTopShell';
import ShopInfoSheet from '@/components/shop/ShopInfoSheet';
import ChaslayStorefrontNavbar from '@/chaslay-pagebuilder/ChaslayStorefrontNavbar';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';

type MerchantInfo = {
  name?: string;
  shopLogoUrl?: string | null;
  storeHours?: import('@/lib/shop-hours').StoreHours | null;
  reservationsEnabled?: boolean;
  giftCards?: { enabled?: boolean };
  language?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  vacation?: ShopVacationInfo | null;
};

type LegalPagePayload = {
  engine: string;
  title?: string;
  htmlContent?: string;
  seoTitle?: string;
  seoDescription?: string;
  merchant?: MerchantInfo;
};

type Props = {
  shopKey: string;
  base: string;
  pageSlug?: string;
};

export default function ShopLegalPageView({ shopKey, base, pageSlug = 'privacy-policy' }: Props) {
  const { t, locale } = useI18n();
  const { theme: cmsTheme, site: shopSite } = useShopCmsTheme(shopKey);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null);
  const [hasCmsNav, setHasCmsNav] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const apiPath = useMemo(
    () => `/api/shop/${shopKey}/pages/${pageSlug}`,
    [shopKey, pageSlug]
  );

  const sanitizedHtml = useMemo(
    () =>
      DOMPurify.sanitize(htmlContent, {
        ADD_ATTR: ['target', 'rel'],
      }),
    [htmlContent]
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
        const res = await axios.get(apiPath);
        if (cancelled) return;
        const page = res.data.data as LegalPagePayload;
        if (page.engine !== 'legal' || !page.htmlContent) {
          setError(t('cmsHomeUnavailable'));
          return;
        }
        setHtmlContent(page.htmlContent);
        setSeoTitle(page.seoTitle || page.title || page.merchant?.name || '');
        setSeoDescription(page.seoDescription || '');
        setMerchant(page.merchant || null);
      } catch {
        if (!cancelled) setError(t('cmsHomeUnavailable'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopKey, apiPath, t]);

  const chaslayLocale = locale === 'fr' || locale === 'de' ? locale : 'en';
  const defaultLanguage = String(merchant?.language || 'en').toLowerCase().slice(0, 2);

  if (loading) {
    return (
      <ShopThemeShell
        theme={cmsTheme}
        site={shopSite}
        pageTitle={seoTitle}
        pageDescription={seoDescription}
        logoUrl={merchant?.shopLogoUrl}
      >
        <div
          className="flex min-h-[50vh] items-center justify-center"
          style={{ background: 'var(--shop-bg-muted, #f6f5f2)', color: 'var(--shop-text-muted, #78716c)' }}
        >
          {t('loading')}
        </div>
      </ShopThemeShell>
    );
  }

  if (error || !sanitizedHtml) {
    return (
      <ShopThemeShell theme={cmsTheme} site={shopSite} logoUrl={merchant?.shopLogoUrl}>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-stone-700">{error || t('cmsHomeUnavailable')}</p>
          <Link to={`${base}/menu`} className="text-sm underline">
            {t('shopOrderNow')}
          </Link>
        </div>
      </ShopThemeShell>
    );
  }

  return (
    <ShopThemeShell
      theme={cmsTheme}
      site={shopSite}
      pageTitle={seoTitle}
      pageDescription={seoDescription}
      logoUrl={merchant?.shopLogoUrl}
      className="min-h-screen"
      style={{ background: 'var(--shop-bg-muted, #f6f5f2)', color: 'var(--shop-text)' }}
    >
      <div className="min-h-screen overflow-x-hidden bg-[#f6f5f2] text-stone-900">
        <ShopVacationPopup vacation={merchant?.vacation} shopKey={shopKey} />
        <ShopTopShell>
          <ChaslayStorefrontNavbar
            shopKey={shopKey}
            basePath={base}
            locale={chaslayLocale}
            defaultLanguage={defaultLanguage}
            onPresence={setHasCmsNav}
          />
          {hasCmsNav ? null : (
            <ShopMinimalHeader
              basePath={base}
              merchantName={merchant?.name}
              logoUrl={merchant?.shopLogoUrl}
              shopKey={shopKey}
              showGiftCards={!!merchant?.giftCards?.enabled}
              showReservations={!!merchant?.reservationsEnabled}
              onStoreInfo={() => setInfoOpen(true)}
            />
          )}
        </ShopTopShell>

        <main className="shop-page-content max-w-3xl py-8 min-w-0 overflow-x-hidden">
          <div
            className="shop-legal-page rounded-2xl border border-stone-200 bg-white px-6 py-8 shadow-sm sm:px-10 [&_a]:text-[var(--shop-accent,#e11d48)] [&_a]:underline [&_a]:underline-offset-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-1 [&_p]:leading-relaxed [&_section]:space-y-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          />
        </main>

        <ShopInfoSheet open={infoOpen} onClose={() => setInfoOpen(false)} merchant={merchant} zones={[]} />
      </div>
    </ShopThemeShell>
  );
}
