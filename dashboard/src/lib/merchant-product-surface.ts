/** Keep in sync with backend/src/lib/merchant-product-surface.ts */

export type MerchantProductSurface =
  | 'pos_only'
  | 'shop_only'
  | 'website_only'
  | 'shop_website'
  | 'full_pos';

export const MERCHANT_PRODUCT_SURFACES: MerchantProductSurface[] = [
  'pos_only',
  'shop_only',
  'website_only',
  'shop_website',
  'full_pos',
];

export type ProductSurfacePreset = {
  label: string;
  description: string;
  editionName: string;
  shopEnabled: boolean;
  cmsHomepageEnabled: boolean;
  maxPosPosts: number;
};

export const PRODUCT_SURFACE_PRESETS: Record<MerchantProductSurface, ProductSurfacePreset> = {
  pos_only: {
    label: 'POS only',
    description: 'WebPOS till only — no online shop or website.',
    editionName: 'POS only',
    shopEnabled: false,
    cmsHomepageEnabled: false,
    maxPosPosts: 1,
  },
  shop_only: {
    label: 'Shop only',
    description: 'Online orders via Order Center — no POS till.',
    editionName: 'Shop only (no POS)',
    shopEnabled: true,
    cmsHomepageEnabled: false,
    maxPosPosts: 0,
  },
  website_only: {
    label: 'Website / CMS only',
    description: 'Homepage and content pages.',
    editionName: 'Website CMS only',
    shopEnabled: true,
    cmsHomepageEnabled: true,
    maxPosPosts: 0,
  },
  shop_website: {
    label: 'Shop + Website',
    description: 'Online shop plus CMS homepage — Order Center, no POS.',
    editionName: 'Shop + Website (no POS)',
    shopEnabled: true,
    cmsHomepageEnabled: true,
    maxPosPosts: 0,
  },
  full_pos: {
    label: 'Shop + Website + POS',
    description: 'WebPOS till, online shop, and website.',
    editionName: 'Full POS + Shop',
    shopEnabled: true,
    cmsHomepageEnabled: true,
    maxPosPosts: 1,
  },
};

export function isMerchantProductSurface(raw: unknown): raw is MerchantProductSurface {
  return typeof raw === 'string' && MERCHANT_PRODUCT_SURFACES.includes(raw as MerchantProductSurface);
}

export function productSurfaceNeedsPosEdition(surface: MerchantProductSurface): boolean {
  return surface === 'full_pos' || surface === 'pos_only';
}

export function productSurfacePackagingEditionNames(): string[] {
  return MERCHANT_PRODUCT_SURFACES.map((s) => PRODUCT_SURFACE_PRESETS[s].editionName);
}

export function isProductSurfacePackagingEditionName(name: string): boolean {
  return productSurfacePackagingEditionNames().includes(name);
}

export function inferProductSurface(input: {
  shopEnabled?: boolean | null;
  cmsHomepageEnabled?: boolean | null;
  maxPosPosts?: number | null;
  hasPosEdition?: boolean;
}): MerchantProductSurface | null {
  const hasPos = Math.max(0, Number(input.maxPosPosts) || 0) > 0 || !!input.hasPosEdition;
  const shop = !!input.shopEnabled;
  const cms = !!input.cmsHomepageEnabled;
  if (hasPos && !shop && !cms) return 'pos_only';
  if (hasPos) return 'full_pos';
  if (shop && cms) return 'shop_website';
  if (cms) return 'website_only';
  if (shop) return 'shop_only';
  return null;
}

export function filterEditionsForProductSurface<
  T extends { id: string; name: string; businessCategory: string },
>(editions: T[], surface: MerchantProductSurface, businessCategory: string): T[] {
  const byCategory = editions.filter(
    (ed) => ed.businessCategory === 'both' || ed.businessCategory === businessCategory
  );
  if (productSurfaceNeedsPosEdition(surface)) {
    return byCategory.filter((ed) => !isProductSurfacePackagingEditionName(ed.name));
  }
  const targetName = PRODUCT_SURFACE_PRESETS[surface].editionName;
  const match = byCategory.find((ed) => ed.name === targetName);
  return match ? [match] : byCategory.filter((ed) => isProductSurfacePackagingEditionName(ed.name));
}
