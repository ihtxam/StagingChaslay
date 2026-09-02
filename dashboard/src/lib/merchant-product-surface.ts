/** Keep in sync with backend/src/lib/merchant-product-surface.ts */

export type MerchantProductSurface =
  | 'shop_only'
  | 'website_only'
  | 'shop_website'
  | 'full_pos';

export const MERCHANT_PRODUCT_SURFACES: MerchantProductSurface[] = [
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
