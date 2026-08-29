// @ts-nocheck
/**
 * Normalize a link value entered by a user in the homepage builder.
 *
 * - Absolute URLs (http, https, mailto, tel, etc.) are preserved verbatim.
 *   This lets users link to external sites or other stores' subdomains
 *   without losing the host.
 * - Anchor links (`#section`) are preserved.
 * - Bare paths or slugs ("menu", "/menu") get a leading slash so they
 *   resolve as same-origin paths on the storefront.
 */
export function normalizeLink(input: string): string {
  const val = input.trim();
  if (!val) return '';
  // Absolute URL with any scheme (http://, https://, mailto:, tel:, etc.)
  if (/^[a-z][a-z0-9+.-]*:/i.test(val)) return val;
  // Anchor link
  if (val.startsWith('#')) return val;
  // Already a path
  if (val.startsWith('/')) return val;
  // Bare slug — make it a path
  return '/' + val;
}
