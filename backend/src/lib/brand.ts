/** Public product + domain defaults. Override with env on the new server. */

export const APP_NAME = process.env.BRAND_NAME?.trim() || "Reborn";

export const BRAND_DOMAIN = (process.env.DOMAIN || "rebornsense.com").replace(
  /^https?:\/\//,
  ""
).replace(/\/+$/, "");

export const APP_ORIGIN = (
  process.env.PUBLIC_APP_URL || `https://app.${BRAND_DOMAIN}`
).replace(/\/+$/, "");

export const PAY_ORIGIN = (
  process.env.PUBLIC_RECEIPT_ORIGIN ||
  process.env.PUBLIC_RECEIPT_BASE_URL?.replace(/\/receipts?\/?$/i, "") ||
  `https://pay.${BRAND_DOMAIN}`
).replace(/\/+$/, "");

export const SHOP_HOST =
  process.env.SHOP_PUBLIC_HOST ||
  (BRAND_DOMAIN.startsWith("shop.") ? BRAND_DOMAIN : `shop.${BRAND_DOMAIN}`);

export const FROM_EMAIL_DEFAULT = `noreply@${BRAND_DOMAIN.replace(/^app\./, "").replace(/^shop\./, "")}`;
export const FROM_NAME_DEFAULT = APP_NAME;

export const LEGACY_HOST_ALIASES = [
  "https://app.chaslay.com",
  "https://api.chaslay.com",
  "https://shop.chaslay.com",
  "https://pay.chaslay.com",
  "https://status.chaslay.com",
  "https://admin.chaslay.com",
];

export const CURRENT_HOST_ALIASES = [
  APP_ORIGIN,
  `https://app.${BRAND_DOMAIN}`,
  `https://api.${BRAND_DOMAIN}`,
  `https://shop.${BRAND_DOMAIN}`,
  `https://pay.${BRAND_DOMAIN}`,
  `https://status.${BRAND_DOMAIN}`,
  `https://${BRAND_DOMAIN}`,
];

export function rewriteLegacyPublicHost(value: string): string {
  return String(value || "")
    .replace(/chasly\.com/gi, BRAND_DOMAIN)
    .replace(/chaslay\.com/gi, BRAND_DOMAIN);
}
