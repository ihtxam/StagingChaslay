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
  localizedShopCopy,
  shopBrandCssVars,
  type ShopSiteSettings,
} from '@/lib/shop-site-settings';

type Props = {
  theme?: ShopThemeConfig | Record<string, unknown> | null;
  /** Alias used by table-order (same as theme). */
  cmsTheme?: ShopThemeConfig | Record<string, unknown> | null;
  site?: ShopSiteSettings | null;
  /** Override shop UI language (Chaslay builder locale). */
  language?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

function applyFavicon(url: string) {
  const href = url || DEFAULT_SHOP_FAVICON;
  const type = faviconTypeFromUrl(href);
  let link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = type;
  link.href = href;
}

function applyMetaDescription(content: string | null) {
  if (!content) return;
  let el = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.name = 'description';
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
    if (!site) return;
    const title = localizedShopCopy(site.metaTitle, lang);
    if (title) document.title = title;
    const desc = localizedShopCopy(site.metaDescription, lang);
    if (desc) applyMetaDescription(desc);
    applyFavicon(site.faviconUrl || DEFAULT_SHOP_FAVICON);
    applyGtag(site.gaMeasurementId);
  }, [site, lang]);

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
