import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n';
import {
  normalizeShopTheme,
  shopThemeCssVars,
  shopThemeGoogleFontsUrl,
  type ShopThemeConfig,
} from '@/lib/shop-theme';
import {
  DEFAULT_SHOP_FAVICON,
  faviconTypeFromUrl,
  resolveShopDocumentSeo,
  shopBrandCssVars,
  type ShopSiteSettings,
} from '@/lib/shop-site-settings';

type Props = {
  theme?: ShopThemeConfig | Record<string, unknown> | null;
  /** Alias used by table-order (same as theme). */
  cmsTheme?: ShopThemeConfig | Record<string, unknown> | null;
  site?: ShopSiteSettings | null;
  /** Page/builder SEO used only when Online Shop meta is empty. */
  pageTitle?: string | null;
  pageDescription?: string | null;
  /** Override shop UI language (Chaslay builder locale). */
  language?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

function applyFavicon(url: string) {
  const href = url || DEFAULT_SHOP_FAVICON;
  const type = faviconTypeFromUrl(href);
  const rels = ['icon', 'shortcut icon'] as const;
  for (const rel of rels) {
    let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.type = type;
    link.href = href;
  }
  let apple = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
  if (!apple) {
    apple = document.createElement('link');
    apple.rel = 'apple-touch-icon';
    document.head.appendChild(apple);
  }
  apple.href = href;
}

function applyNamedMeta(name: string, content: string | null) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  el.content = content;
}

function applyPropertyMeta(property: string, content: string | null) {
  if (!content) return;
  let el = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.content = content;
}

function applyGtag(measurementId: string | null) {
  const jsId = 'shop-gtag-js';
  const inlineId = 'shop-gtag-inline';
  document.getElementById(jsId)?.remove();
  document.getElementById(inlineId)?.remove();
  if (!measurementId) return;

  const js = document.createElement('script');
  js.id = jsId;
  js.async = true;
  js.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(js);

  const inline = document.createElement('script');
  inline.id = inlineId;
  inline.textContent = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(measurementId)});`;
  document.head.appendChild(inline);
}

/** Applies CMS homepage theme tokens to shop surfaces (menu, reservations, CMS blocks). */
export default function ShopThemeShell({
  theme,
  cmsTheme,
  site,
  pageTitle,
  pageDescription,
  language,
  className = '',
  style,
  children,
}: Props) {
  const { locale } = useI18n();
  const resolved = normalizeShopTheme((theme || cmsTheme) as Record<string, unknown> | null);
  const vars = shopThemeCssVars(resolved) as CSSProperties;
  const brandVars = shopBrandCssVars(site?.brandColor) as CSSProperties;
  const fontUrl = shopThemeGoogleFontsUrl(resolved);
  const lang = language || locale;

  useEffect(() => {
    if (!fontUrl) return;
    const id = 'shop-theme-fonts';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    if (link.href !== fontUrl) link.href = fontUrl;
  }, [fontUrl]);

  useEffect(() => {
    if (!site && !pageTitle && !pageDescription) return;
    const seo = resolveShopDocumentSeo(site, lang, {
      title: pageTitle,
      description: pageDescription,
    });
    if (seo.title) document.title = seo.title;
    applyNamedMeta('description', seo.description || null);
    applyNamedMeta('twitter:card', seo.title || seo.description ? 'summary' : null);
    applyNamedMeta('twitter:title', seo.title || null);
    applyNamedMeta('twitter:description', seo.description || null);
    applyPropertyMeta('og:title', seo.title || null);
    applyPropertyMeta('og:description', seo.description || null);
    applyPropertyMeta('og:type', seo.title || seo.description ? 'website' : null);
    if (site) {
      applyFavicon(seo.faviconUrl || DEFAULT_SHOP_FAVICON);
      applyGtag(site.gaMeasurementId);
    }
  }, [site, lang, pageTitle, pageDescription]);

  const primary = site?.brandColor;
  useEffect(() => {
    if (!primary) return;
    const root = document.documentElement;
    root.style.setProperty('--color-primary', primary);
    root.style.setProperty('--shop-accent', primary);
    return () => {
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--shop-accent');
    };
  }, [primary]);

  return (
    <div
      className={`shop-themed ${className}`.trim()}
      style={{ ...vars, ...brandVars, fontFamily: 'var(--shop-font)', ...style }}
    >
      {children}
    </div>
  );
}
