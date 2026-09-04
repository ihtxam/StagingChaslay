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

/** Apex domain without shop./app. prefix (e.g. chaslay.com, rebornsense.com). */
function brandApexDomain(): string {
  return BRAND_DOMAIN.toLowerCase().replace(/^shop\./, "").replace(/^app\./, "");
}

/** Public shop hub hostname (path shops at https://{host}/{slug}). */
export function resolveShopPublicHost(): string {
  const explicit = process.env.SHOP_PUBLIC_HOST?.trim();
  if (explicit) return explicit;

  const domain = BRAND_DOMAIN.toLowerCase();
  const apex = brandApexDomain();

  // Chaslay staging: order.chaslay.com is unavailable — use shop.chaslay.com/{slug}.
  if (apex === "chaslay.com") {
    if (domain.startsWith("shop.")) return domain;
    return `shop.${apex}`;
  }

  // Reborn production: order.rebornsense.com/{slug} (legacy shop.app.* still redirects).
  if (apex === "rebornsense.com") {
    return "order.rebornsense.com";
  }

  const appHost = APP_ORIGIN.replace(/^https?:\/\//, "").toLowerCase();
  if (appHost.startsWith("app.")) return `shop.${appHost}`;

  if (domain.startsWith("shop.")) return domain;
  return `shop.${domain}`;
}

export const SHOP_HOST = resolveShopPublicHost();

export const FROM_EMAIL_DEFAULT = `noreply@${BRAND_DOMAIN.replace(/^app\./, "").replace(/^shop\./, "")}`;
export const FROM_NAME_DEFAULT = APP_NAME;

export const LEGACY_HOST_ALIASES = [
  "https://app.chaslay.com",
  "https://api.chaslay.com",
  "https://shop.chaslay.com",
  "https://shop.app.chaslay.com",
  "https://pay.chaslay.com",
  "https://status.chaslay.com",
  "https://admin.chaslay.com",
];

export const CURRENT_HOST_ALIASES = [
  APP_ORIGIN,
  `https://app.${BRAND_DOMAIN}`,
  `https://api.${BRAND_DOMAIN}`,
  `https://shop.${BRAND_DOMAIN}`,
  `https://${SHOP_HOST}`,
  `https://pay.${BRAND_DOMAIN}`,
  `https://status.${BRAND_DOMAIN}`,
  `https://${BRAND_DOMAIN}`,
];

export function rewriteLegacyPublicHost(value: string): string {
  return String(value || "")
    .replace(/chasly\.com/gi, BRAND_DOMAIN)
    .replace(/chaslay\.com/gi, BRAND_DOMAIN);
}
