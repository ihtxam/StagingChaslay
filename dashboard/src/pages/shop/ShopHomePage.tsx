import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import { resolveShopKey, shopBasePath } from '@/lib/shop-cart';
import { shopLangStorageKey, useI18n } from '@/lib/i18n';
import ShopOpenPageHeader from '@/components/shop/ShopOpenPageHeader';
import ShopStorefrontFooter from '@/components/shop/ShopStorefrontFooter';
import ShopFloatingActions from '@/components/shop/ShopFloatingActions';
import {
  emptyOpenPageBlocks,
  isOpenPageBlocks,
  resolveOpenPageConfig,
  resolveOpenPageHtml,
  rewriteOpenPageHtml,
} from '@/lib/cms/openpage-types';
import {
  extractOpenPageBody,
  splitOpenPageHtml,
  isDynamicCmsBlock,
} from '@/lib/cms/split-openpage-html';
import ShopVacationPopup from '@/components/shop/ShopVacationPopup';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import { CmsDynamicBlock, fetchCmsMenuCatalog } from '@/components/shop/cms/CmsDynamicBlocks';
import { useCmsTailwindCdn } from '@/hooks/useCmsTailwindCdn';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';

/**
 * Public CMS homepage — static OpenPage HTML + live menu/hours/reservation blocks.
 */
export default function ShopHomePage() {
  const { t, locale, setLocale } = useI18n();
  const { merchantSlug } = useParams<{ merchantSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const { site: shopSite } = useShopCmsTheme(shopKey);
  const base = shopBasePath(shopKey);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullHtml, setFullHtml] = useState('');
  const [merchant, setMerchant] = useState<any>(null);
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [rawBlocks, setRawBlocks] = useState<unknown>(null);
  const [menuCatalog, setMenuCatalog] = useState<Awaited<ReturnType<typeof fetchCmsMenuCatalog>>>(null);

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
        const blocks = isOpenPageBlocks(page.blocks) ? page.blocks : null;
        const config = blocks ? resolveOpenPageConfig(blocks, locale as 'en' | 'fr' | 'de') : null;
        const needsMenu =
          config?.blocks?.some(
            (b) => b.type === 'menu' || (b.type === 'featured' && isDynamicCmsBlock(b))
          ) ?? false;
        if (needsMenu) {
          const menu = await fetchCmsMenuCatalog(shopKey);
          if (!cancelled) setMenuCatalog(menu);
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
    if (!merchant) return;
    if (isOpenPageBlocks(rawBlocks)) {
      setFullHtml(rewriteOpenPageHtml(resolveOpenPageHtml(rawBlocks, locale), base));
    } else {
      const fallback = emptyOpenPageBlocks(seoTitle || merchant.name || 'Welcome');
      setFullHtml(rewriteOpenPageHtml(fallback.html, base));
    }
  }, [rawBlocks, locale, base, merchant, seoTitle]);

  const pageConfig = useMemo(() => {
    if (!isOpenPageBlocks(rawBlocks)) return null;
    return resolveOpenPageConfig(rawBlocks, locale as 'en' | 'fr' | 'de');
  }, [rawBlocks, locale]);

  const segments = useMemo(() => {
    if (!pageConfig || !fullHtml) return null;
    const body = extractOpenPageBody(fullHtml);
    return splitOpenPageHtml(body, pageConfig);
  }, [pageConfig, fullHtml]);

  const theme = pageConfig?.theme;
  useCmsTailwindCdn(Boolean(segments?.length));

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.classList.add('shop-shell');
    return () => document.documentElement.classList.remove('shop-shell');
  }, [locale]);

  const money = (n: number) =>
    new Intl.NumberFormat(locale === 'de' ? 'de-CH' : locale === 'fr' ? 'fr-CH' : 'en-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(n);

  const showReservationsNav = Boolean(merchant?.reservationsEnabled);

  if (loading) {
    return (
      <ShopThemeShell site={shopSite} pageTitle={seoTitle} pageDescription={seoDescription}>
        <div
          className="flex min-h-screen items-center justify-center"
          style={{ background: 'var(--shop-bg, #fafaf9)', color: 'var(--shop-text-muted, #78716c)' }}
        >
          {t('loading')}
        </div>
      </ShopThemeShell>
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
    <ShopThemeShell
      theme={theme}
      site={shopSite}
      pageTitle={seoTitle}
      pageDescription={seoDescription}
      className="flex flex-col"
      style={{ background: 'var(--color-bg-0)' }}
    >
      <ShopVacationPopup shopKey={shopKey} />
      <ShopOpenPageHeader
        basePath={base}
        merchantName={merchant?.name}
        logoUrl={merchant?.shopLogoUrl}
        shopKey={shopKey}
      />

      <div className="cms-homepage flex flex-col pb-6">
        {segments?.length ? (
          segments.map((seg, idx) =>
            seg.kind === 'dynamic' ? (
              <CmsDynamicBlock
                key={seg.blockId}
                blockType={seg.blockType}
                props={seg.props}
                base={base}
                menu={menuCatalog}
                storeHours={merchant.storeHours}
                reservationsEnabled={merchant.reservationsEnabled}
                money={money}
              />
            ) : (
              <div key={`static-${idx}`} dangerouslySetInnerHTML={{ __html: seg.html }} />
            )
          )
        ) : (
          <div dangerouslySetInnerHTML={{ __html: extractOpenPageBody(fullHtml) }} />
        )}
        <ShopStorefrontFooter basePath={base} merchantName={merchant?.name} />
      </div>

      <ShopFloatingActions basePath={base} showReservations={showReservationsNav} />
    </ShopThemeShell>
  );
}
