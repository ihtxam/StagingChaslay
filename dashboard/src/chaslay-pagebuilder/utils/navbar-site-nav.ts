import type { SitePageLink } from '../StorefrontContext';
import { isContactNavLink, isHomeNavLink, isShopMenuNavLink } from '../storefront-href';

export type NavbarMenuItem = { label: string; link: string };

const HOME_LABELS = new Set(['home', 'accueil', 'start', 'startseite']);
const MENU_LABELS = new Set(['menu', 'menü', 'our menu', 'notre menu', 'unsere speisekarte']);
const CONTACT_LABELS = new Set([
  'contact',
  'contact us',
  'contactez-nous',
  'kontakt',
  'contatti',
  'contattaci',
]);

function normLabel(label: string | undefined | null): string {
  return String(label || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function isStorefrontHomeNavItem(item: NavbarMenuItem): boolean {
  return isHomeNavLink(item.link) || HOME_LABELS.has(normLabel(item.label));
}

export function isStorefrontMenuNavItem(item: NavbarMenuItem): boolean {
  return isShopMenuNavLink(item.link) || MENU_LABELS.has(normLabel(item.label));
}

export function isStorefrontContactNavItem(item: NavbarMenuItem): boolean {
  return isContactNavLink(item.link) || CONTACT_LABELS.has(normLabel(item.label));
}

/**
 * Public shop top bar is logo + language + Login only (PDF 1.1).
 * Home / Menu / Cart live in the shop footer, not this strip.
 */
export function constrainStorefrontTopNav(_items?: NavbarMenuItem[] | null): NavbarMenuItem[] {
  return [];
}

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
