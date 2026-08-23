/** Product name shown in panel, shop chrome, emails, and receipts. */
export const APP_NAME = 'ChaslayReborn';

export const APP_PANEL_TITLE = `${APP_NAME} Admin`;

/** Superadmin sidebar footer label above Sign out (not a personal name). */
export const APP_ADMIN_LABEL = 'Chaslay Admin';

export const APP_TAGLINE = 'Restaurant POS & online ordering';

/** Replace leftover ManuPOS / ChaslayReborn Admin account names in the sidebar. */
export function displaySidebarAccountName(name?: string | null): string {
  const n = name?.trim() || '';
  if (/manupos|chaslayreborn\s+admin/i.test(n)) return APP_ADMIN_LABEL;
  return n;
}

/** Merchant shop name for the panel sidebar header — no Chaslay branding prefix. */
export function displaySidebarShopName(name?: string | null): string {
  const n = name?.trim() || '';
  if (!n) return 'Shop';
  if (/^chaslay(reborn)?(\s+admin)?$/i.test(n)) return 'Shop';
  if (/^chaslay\s+shop$/i.test(n)) return 'Shop';
  const stripped = n.replace(/^chaslay\s+/i, '').trim();
  return stripped || 'Shop';
}

/** Browser tab title for online shop pages (merchant site + platform). */
export function shopDocumentTitle(pageOrMerchantName?: string | null): string {
  const label = pageOrMerchantName?.trim();
  return label ? `${label} · ${APP_NAME}` : APP_NAME;
}
