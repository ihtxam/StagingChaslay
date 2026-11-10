/** Merchant has a public web surface (shop, reservations widget, or CMS homepage). */
export function merchantHasPublicStorefront(merchant: {
  shopEnabled?: boolean | null;
  reservationsEnabled?: boolean | null;
  cmsHomepageEnabled?: boolean | null;
}): boolean {
  return (
    merchant.shopEnabled === true ||
    merchant.reservationsEnabled === true ||
    merchant.cmsHomepageEnabled === true
  );
}
