import type { SitePageLink } from '../StorefrontContext';

export type NavbarMenuItem = { label: string; link: string };

/** Build header links from published builder pages (homepage + extra pages + menu). */
export function buildSiteNavMenuItems(
  sitePages: SitePageLink[],
  opts?: { includeMenu?: boolean }
): NavbarMenuItem[] {
  const includeMenu = opts?.includeMenu !== false;
  const items: NavbarMenuItem[] = [];
  const sorted = [...sitePages].sort((a, b) => {
    if (a.isHomepage && !b.isHomepage) return -1;
    if (!a.isHomepage && b.isHomepage) return 1;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });
  for (const page of sorted) {
    const link = page.isHomepage ? '/' : `/pages/${page.slug}`;
    items.push({ label: page.title, link });
  }
  if (includeMenu) {
    const hasMenu = items.some((item) => item.link === '/menu' || item.link.endsWith('/menu'));
    if (!hasMenu) items.push({ label: 'Menu', link: '/menu' });
  }
  return items;
}

/** Prefer builder-configured nav links; fall back to published site pages when empty. */
export function resolveNavbarMenuItems(
  configured: NavbarMenuItem[] | undefined,
  sitePages: SitePageLink[],
  useSitePagesNav: boolean,
  isStorefront: boolean
): NavbarMenuItem[] {
  if (configured?.length) {
    return configured;
  }
  if (isStorefront && useSitePagesNav && sitePages.length > 0) {
    return buildSiteNavMenuItems(sitePages);
  }
  return buildSiteNavMenuItems(sitePages);
}
