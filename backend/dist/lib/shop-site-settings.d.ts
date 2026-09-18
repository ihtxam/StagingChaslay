export type ShopSeoLocale = "en" | "fr" | "de" | "it";
export type ShopLocalizedCopy = Partial<Record<ShopSeoLocale, string>>;
export type ShopSiteSettings = {
    brandColor: string | null;
    metaTitle: ShopLocalizedCopy;
    metaDescription: ShopLocalizedCopy;
    gaMeasurementId: string | null;
    faviconUrl: string | null;
};
export declare function normalizeGaMeasurementId(raw: unknown): string | null;
export declare function normalizeShopSiteSettings(raw: unknown): ShopSiteSettings;
export declare function localizedShopCopy(copy: ShopLocalizedCopy | undefined, locale: string, fallbackLocale?: string): string;
/** Prefer Online Shop SEO settings; page/builder copy is fallback only. */
export declare function resolveShopDocumentSeo(site: ShopSiteSettings | null | undefined, locale: string, fallbacks?: {
    title?: string | null;
    description?: string | null;
}): {
    title: string;
    description: string;
    faviconUrl: string | null;
};
//# sourceMappingURL=shop-site-settings.d.ts.map