import type { EditionFeatureKey } from "@/lib/edition-features";
/** Merchant commercial package — drives shop, website CMS, and POS surfaces. */
export type MerchantProductSurface = "shop_only" | "website_only" | "shop_website" | "full_pos";
export declare const MERCHANT_PRODUCT_SURFACES: MerchantProductSurface[];
export type ProductSurfacePreset = {
    label: string;
    description: string;
    editionName: string;
    shopEnabled: boolean;
    cmsHomepageEnabled: boolean;
    maxPosPosts: number;
    features: EditionFeatureKey[];
};
export declare const PRODUCT_SURFACE_PRESETS: Record<MerchantProductSurface, ProductSurfacePreset>;
export declare function isMerchantProductSurface(raw: unknown): raw is MerchantProductSurface;
/** Guess surface from merchant flags (for display). */
export declare function inferProductSurface(input: {
    shopEnabled?: boolean | null;
    cmsHomepageEnabled?: boolean | null;
    maxPosPosts?: number | null;
    hasPosEdition?: boolean;
}): MerchantProductSurface | null;
//# sourceMappingURL=merchant-product-surface.d.ts.map