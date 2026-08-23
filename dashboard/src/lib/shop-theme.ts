/** Shared design tokens from OpenPage CMS theme → shop / reservations surfaces. */

export type ShopThemeConfig = {
  bg0?: string;
  bg1?: string;
  bg2?: string;
  text0?: string;
  text1?: string;
  text2?: string;
  accent?: string;
  accentDim?: string;
  borderDefault?: string;
  fontSans?: string;
  fontDisplay?: string;
  radius?: number;
  radiusLg?: number;
};

const DEFAULTS: Required<ShopThemeConfig> = {
  bg0: '#ffffff',
  bg1: '#f8f9fa',
  bg2: '#f1f3f5',
  text0: '#212529',
  text1: '#495057',
  text2: '#868e96',
  accent: '#0d9488',
  accentDim: '#0f766e',
  borderDefault: '#dee2e6',
  fontSans: 'DM Sans',
  fontDisplay: 'DM Sans',
  radius: 10,
  radiusLg: 16,
};

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '13, 148, 136';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function normalizeShopTheme(raw?: Record<string, unknown> | null): Required<ShopThemeConfig> {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS };
  const n = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback);
  const nr = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return {
    bg0: n(raw.bg0, DEFAULTS.bg0),
    bg1: n(raw.bg1, DEFAULTS.bg1),
    bg2: n(raw.bg2, DEFAULTS.bg2),
    text0: n(raw.text0, DEFAULTS.text0),
    text1: n(raw.text1, DEFAULTS.text1),
    text2: n(raw.text2, DEFAULTS.text2),
    accent: n(raw.accent, DEFAULTS.accent),
    accentDim: n(raw.accentDim, DEFAULTS.accentDim),
    borderDefault: n(raw.borderDefault, DEFAULTS.borderDefault),
    fontSans: n(raw.fontSans, DEFAULTS.fontSans),
    fontDisplay: n(raw.fontDisplay, DEFAULTS.fontDisplay),
    radius: nr(raw.radius, DEFAULTS.radius),
    radiusLg: nr(raw.radiusLg, DEFAULTS.radiusLg),
  };
}

/** CSS custom properties for shop shell + CMS dynamic blocks. */
export function shopThemeCssVars(theme: Required<ShopThemeConfig>): Record<string, string> {
  const rgb = hexToRgb(theme.accent);
  return {
    '--color-bg-0': theme.bg0,
    '--color-bg-1': theme.bg1,
    '--color-bg-2': theme.bg2,
    '--color-text-0': theme.text0,
    '--color-text-1': theme.text1,
    '--color-text-2': theme.text2,
    '--color-green': theme.accent,
    '--color-green-dim': theme.accentDim,
    '--color-border-default': theme.borderDefault,
    '--color-accent-rgb': rgb,
    '--font-sans': `"${theme.fontSans}", system-ui, sans-serif`,
    '--font-display': `"${theme.fontDisplay}", system-ui, sans-serif`,
    '--radius-default': `${theme.radius}px`,
    '--radius-lg': `${theme.radiusLg}px`,
    '--shop-accent': theme.accent,
    '--shop-accent-dim': theme.accentDim,
    '--shop-bg': theme.bg0,
    '--shop-bg-muted': theme.bg1,
    '--shop-text': theme.text0,
    '--shop-text-muted': theme.text1,
    '--shop-border': theme.borderDefault,
    '--shop-radius': `${theme.radius}px`,
    '--shop-radius-lg': `${theme.radiusLg}px`,
    '--shop-font': `"${theme.fontSans}", system-ui, sans-serif`,
    '--shop-content-max': '80rem',
  };
}

export function shopThemeGoogleFontsUrl(theme: Required<ShopThemeConfig>): string {
  const fonts = [...new Set([theme.fontSans, theme.fontDisplay].filter(Boolean))];
  const families = fonts.map((f) => `family=${f.replace(/ /g, '+')}:wght@400;500;600;700`);
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`;
}
