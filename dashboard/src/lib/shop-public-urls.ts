/** Demo / legacy shop URLs that must not appear in merchant settings. */
const HIDDEN_MERCHANT_SHOP_URL_PATTERNS: RegExp[] = [
  /^https?:\/\/demo\.chaslay\.com(?:\/|$)/i,
  /^https?:\/\/shop\.app\.chaslay\.com\/demo(?:\/|$)/i,
];

export function isHiddenMerchantShopUrl(url: string | null | undefined): boolean {
  const value = String(url || '').trim();
  if (!value) return false;
  return HIDDEN_MERCHANT_SHOP_URL_PATTERNS.some((pattern) => pattern.test(value));
}

/** Returns null when the URL should be hidden from merchants. */
export function filterMerchantShopUrl(url: string | null | undefined): string | null {
  const value = String(url || '').trim();
  if (!value || isHiddenMerchantShopUrl(value)) return null;
  return value;
}
