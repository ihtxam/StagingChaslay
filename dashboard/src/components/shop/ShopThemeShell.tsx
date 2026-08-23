import { useEffect, type CSSProperties, type ReactNode } from 'react';
import {
  normalizeShopTheme,
  shopThemeCssVars,
  shopThemeGoogleFontsUrl,
  type ShopThemeConfig,
} from '@/lib/shop-theme';

type Props = {
  theme?: ShopThemeConfig | Record<string, unknown> | null;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

/** Applies CMS homepage theme tokens to shop surfaces (menu, reservations, CMS blocks). */
export default function ShopThemeShell({ theme, className = '', style, children }: Props) {
  const resolved = normalizeShopTheme(theme as Record<string, unknown> | null);
  const vars = shopThemeCssVars(resolved) as CSSProperties;
  const fontUrl = shopThemeGoogleFontsUrl(resolved);

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

  return (
    <div
      className={`shop-themed ${className}`.trim()}
      style={{ ...vars, fontFamily: 'var(--shop-font)', ...style }}
    >
      {children}
    </div>
  );
}
