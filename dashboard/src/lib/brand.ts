/** Public product name (PWA, Windows app, panel, shop chrome). */
export const APP_NAME = 'Reborn';

/** White Reborn logo (icon + wordmark) for dark backgrounds — login, merchant sidebar. */
export const REBORN_LOGO_WHITE = '/brand/reborn-logo-white.png';

export const APP_PANEL_TITLE = `${APP_NAME} Admin`;

/** Superadmin sidebar footer label above Sign out (not a personal name). */
export const APP_ADMIN_LABEL = 'Reborn Admin';

export const APP_TAGLINE = 'Restaurant POS & online ordering';

/** Apex marketing domain. */
export const BRAND_DOMAIN = 'rebornsense.com';

/** Merchant panel + login + same-origin API (`/api`, `/v1`). */
export const APP_HOST = `app.${BRAND_DOMAIN}`;
export const APP_ORIGIN = `https://${APP_HOST}`;

/** Android / POS API alias (same backend as APP_ORIGIN). */
export const API_HOST = APP_HOST;
export const API_ORIGIN = APP_ORIGIN;

export const SHOP_HOST = `shop.${BRAND_DOMAIN}`;
export const SHOP_ORIGIN = `https://${SHOP_HOST}`;

export const PAY_HOST = `pay.${BRAND_DOMAIN}`;
export const PAY_ORIGIN = `https://${PAY_HOST}`;

export const STATUS_HOST = `status.${BRAND_DOMAIN}`;
export const STATUS_ORIGIN = `https://${STATUS_HOST}`;

export const MARKETING_ORIGIN = `https://${BRAND_DOMAIN}`;

/** Legacy hosts still accepted during DNS cutover. */
export const LEGACY_BRAND_DOMAINS = ['chaslay.com', 'chasly.com'] as const;

export function rewriteLegacyHost(host: string): string {
  return String(host || '')
    .toLowerCase()
    .replace(/chasly\.com/gi, BRAND_DOMAIN)
    .replace(/chaslay\.com/gi, BRAND_DOMAIN);
}

/** Replace leftover ManuPOS / Chaslay admin account names in the sidebar. */
export function displaySidebarAccountName(name?: string | null): string {
  const n = name?.trim() || '';
  if (/manupos|chaslayreborn\s+admin|reborn\s+admin/i.test(n)) return APP_ADMIN_LABEL;
  return n;
}

/** Merchant shop name for the panel sidebar header — no platform branding prefix. */
export function displaySidebarShopName(name?: string | null): string {
  const n = name?.trim() || '';
  if (!n) return 'Shop';
  if (/^(chaslay(reborn)?|reborn)(\s+admin)?$/i.test(n)) return 'Shop';
  if (/^(chaslay|reborn)\s+shop$/i.test(n)) return 'Shop';
  const stripped = n.replace(/^(chaslay|reborn)\s+/i, '').trim();
  return stripped || 'Shop';
}

/** Browser tab title for online shop pages (merchant site + platform). */
export function shopDocumentTitle(pageOrMerchantName?: string | null): string {
  const label = pageOrMerchantName?.trim();
  return label ? `${label} · ${APP_NAME}` : APP_NAME;
}
