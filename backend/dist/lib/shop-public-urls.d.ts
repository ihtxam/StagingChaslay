export type MerchantShopLinkKey = "shopWebsiteLink" | "shopCustomDomainLink";
export declare function isHiddenMerchantShopUrl(url: string | null | undefined): boolean;
/** Returns null when the URL should be hidden from merchants. */
export declare function filterMerchantShopUrl(url: string | null | undefined): string | null;
/** One customer-facing shop URL for CMS/settings (custom domain wins over shop hub). */
export declare function primaryMerchantShopPublicUrl(input: {
    shopPathUrl?: string | null;
    shopCustomDomainUrl?: string | null;
}): string | null;
/** Public shop links shown to merchants — single canonical URL, no panel/subdomain duplicates. */
export declare function listMerchantShopPublicLinks(input: {
    shopPathUrl?: string | null;
    shopMenuUrl?: string | null;
    shopPanelPathUrl?: string | null;
    shopSubdomainUrl?: string | null;
    shopCustomDomainUrl?: string | null;
}): Array<{
    key: MerchantShopLinkKey;
    url: string;
}>;
//# sourceMappingURL=shop-public-urls.d.ts.map