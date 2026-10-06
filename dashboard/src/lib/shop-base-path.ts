/** Merchant-wide routes (CMS pages, etc.) drop the `/l/:locationSlug` branch prefix. */
export function shopMerchantWideBasePath(basePath: string): string {
  const trimmed = String(basePath || '').replace(/\/+$/, '');
  if (!trimmed) return '';
  const withoutLocation = trimmed.replace(/\/l\/[^/]+$/i, '');
  return withoutLocation || trimmed;
}
