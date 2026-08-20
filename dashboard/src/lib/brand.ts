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

/** Browser tab title for online shop pages (merchant site + platform). */
export function shopDocumentTitle(pageOrMerchantName?: string | null): string {
  const label = pageOrMerchantName?.trim();
  return label ? `${label} · ${APP_NAME}` : APP_NAME;
}
