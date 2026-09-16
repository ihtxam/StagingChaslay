export type ShopSeoLocale = 'en' | 'fr' | 'de' | 'it';
export type ShopLocalizedCopy = Partial<Record<ShopSeoLocale, string>>;

export type ShopSiteSettings = {
  brandColor: string | null;
  metaTitle: ShopLocalizedCopy;
  metaDescription: ShopLocalizedCopy;
  gaMeasurementId: string | null;
  faviconUrl: string | null;
};

export const SHOP_SEO_LOCALES: ShopSeoLocale[] = ['en', 'fr', 'de', 'it'];

export const DEFAULT_SHOP_FAVICON = '/favicon.png';

export function emptyShopSiteSettings(): ShopSiteSettings {
  return {
    brandColor: null,
    metaTitle: {},
    metaDescription: {},
    gaMeasurementId: null,
    faviconUrl: null,
  };
}

function expandHex(color: string): string {
  const hex = color.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`.toLowerCase();
  }
  return hex.toLowerCase();
}

export function normalizeGaMeasurementId(raw: unknown): string | null {
  const id = String(raw || '')
    .trim()
    .toUpperCase();
  if (!id) return null;
  if (!/^G-[A-Z0-9]{4,20}$/.test(id)) return null;
  return id;
}

export function normalizeShopSiteSettings(raw: unknown): ShopSiteSettings {
  if (!raw || typeof raw !== 'object') return emptyShopSiteSettings();
  const src = raw as Record<string, unknown>;
  const copy = (field: unknown, max: number): ShopLocalizedCopy => {
    if (!field || typeof field !== 'object') return {};
    const obj = field as Record<string, unknown>;
    const out: ShopLocalizedCopy = {};
    for (const loc of SHOP_SEO_LOCALES) {
      const v = typeof obj[loc] === 'string' ? obj[loc].trim() : '';
      if (v) out[loc] = v.slice(0, max);
    }
    return out;
  };
  const color = typeof src.brandColor === 'string' ? src.brandColor.trim() : '';
  const ga = String(src.gaMeasurementId || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 24);
  return {
    brandColor: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color) ? expandHex(color) : null,
    metaTitle: copy(src.metaTitle, 60),
    metaDescription: copy(src.metaDescription, 160),
    gaMeasurementId: ga || null,
    faviconUrl:
      typeof src.faviconUrl === 'string' && src.faviconUrl.trim()
        ? src.faviconUrl.trim()
        : null,
  };
}

export function localizedShopCopy(
  copy: ShopLocalizedCopy | undefined,
  locale: string,
  fallbackLocale = 'en'
): string {
  const loc = String(locale || fallbackLocale)
    .toLowerCase()
    .slice(0, 2) as ShopSeoLocale;
  const fallback = String(fallbackLocale || 'en')
    .toLowerCase()
    .slice(0, 2) as ShopSeoLocale;
  return (
    (copy?.[loc] || '').trim() ||
    (copy?.[fallback] || '').trim() ||
    (copy?.en || '').trim() ||
    ''
  );
}

/** Prefer Online Shop SEO settings; page/builder copy is fallback only. */
export function resolveShopDocumentSeo(
  site: ShopSiteSettings | null | undefined,
  locale: string,
  fallbacks?: { title?: string | null; description?: string | null }
): { title: string; description: string; faviconUrl: string | null } {
  return {
    title: localizedShopCopy(site?.metaTitle, locale) || String(fallbacks?.title || '').trim(),
    description:
      localizedShopCopy(site?.metaDescription, locale) || String(fallbacks?.description || '').trim(),
    faviconUrl: site?.faviconUrl || null,
  };
}

/** Override shop/CMS accent tokens with the merchant primary brand color. */
export function shopBrandCssVars(brandColor: string | null | undefined): Record<string, string> {
  if (!brandColor) return {};
  return {
    '--color-primary': brandColor,
    '--shop-accent': brandColor,
    '--shop-accent-dim': brandColor,
    '--color-green': brandColor,
    '--color-accent': brandColor,
  };
}

export function faviconTypeFromUrl(url: string): string {
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.ico')) return 'image/x-icon';
  return 'image/png';
}
