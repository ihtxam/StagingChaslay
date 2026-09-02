/** Prefix internal shop links with the storefront base path (e.g. /shop/my-cafe). */
export function resolveStorefrontHref(
  link: string | undefined | null,
  basePath: string,
  isStorefront: boolean
): string {
  const raw = String(link || '').trim();
  if (!raw || raw === '#') return raw || '#';
  if (!isStorefront || !basePath) return raw;
  if (/^(https?:|mailto:|tel:|#)/i.test(raw)) return raw;
  if (basePath && (raw === basePath || raw.startsWith(`${basePath}/`))) return raw;
  if (raw.startsWith('/')) {
    return raw === '/' ? basePath || '/' : `${basePath}${raw}`;
  }
  return `${basePath}/${raw}`;
}
