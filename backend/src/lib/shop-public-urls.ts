/** Demo / legacy shop URLs that must not appear in merchant settings. */
const HIDDEN_MERCHANT_SHOP_URL_PATTERNS: RegExp[] = [
  /^https?:\/\/demo\.chaslay\.com(?:\/|$)/i,
  /^https?:\/\/shop\.app\.chaslay\.com\/demo(?:\/|$)/i,
];

export type MerchantShopLinkKey = "shopWebsiteLink" | "shopCustomDomainLink";

export function isHiddenMerchantShopUrl(url: string | null | undefined): boolean {
  const value = String(url || "").trim();
  if (!value) return false;
  return HIDDEN_MERCHANT_SHOP_URL_PATTERNS.some((pattern) => pattern.test(value));
}

/** Returns null when the URL should be hidden from merchants. */
export function filterMerchantShopUrl(url: string | null | undefined): string | null {
  const value = String(url || "").trim();
  if (!value || isHiddenMerchantShopUrl(value)) return null;
  return value;
}

/** One customer-facing shop URL for CMS/settings (custom domain wins over shop hub). */
export function primaryMerchantShopPublicUrl(input: {
  shopPathUrl?: string | null;
  shopCustomDomainUrl?: string | null;
}): string | null {
  return filterMerchantShopUrl(input.shopCustomDomainUrl) || filterMerchantShopUrl(input.shopPathUrl);
}

/** Public shop links shown to merchants — single canonical URL, no panel/subdomain duplicates. */
export function listMerchantShopPublicLinks(input: {
  shopPathUrl?: string | null;
  shopMenuUrl?: string | null;
  shopPanelPathUrl?: string | null;
  shopSubdomainUrl?: string | null;
  shopCustomDomainUrl?: string | null;
}): Array<{ key: MerchantShopLinkKey; url: string }> {
  const custom = filterMerchantShopUrl(input.shopCustomDomainUrl);
  const website = filterMerchantShopUrl(input.shopPathUrl);
  if (custom) return [{ key: "shopCustomDomainLink", url: custom }];
  if (website) return [{ key: "shopWebsiteLink", url: website }];
  return [];
}
