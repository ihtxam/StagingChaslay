export type ShopSocialSeo = {
    title: string;
    description: string;
    url: string;
    siteName: string;
    imageUrl: string | null;
    locale: string;
};
export declare function buildShopSocialMetaTags(seo: ShopSocialSeo): string;
/** Replace default shell SEO and inject Open Graph / Twitter tags for crawlers. */
export declare function injectShopSocialSeo(html: string, seo: ShopSocialSeo): string;
//# sourceMappingURL=shop-spa-html.d.ts.map