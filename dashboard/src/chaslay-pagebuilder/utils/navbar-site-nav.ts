import type { SitePageLink } from '../StorefrontContext';
import { isContactNavLink, isHomeNavLink, isShopMenuNavLink } from '../storefront-href';
import { DEFAULT_SMOOTH_SCROLL_MENU } from './default-nav-menu';

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
const GIFT_CARD_LABELS = new Set([
  'gift card',
  'gift cards',
  'carte cadeau',
  'cartes cadeau',
  'geschenkkarte',
  'geschenkkarten',
  'buono regalo',
]);
const RESERVATIONS_LABELS = new Set([
  'reservations',
  'reservation',
  'réservations',
  'reservierungen',
  'reservationen',
  'prenotazioni',
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

export function isStorefrontGiftCardNavItem(item: NavbarMenuItem): boolean {
  const link = String(item.link || '').toLowerCase();
  return link.includes('gift-card') || GIFT_CARD_LABELS.has(normLabel(item.label));
}

export function isStorefrontReservationsNavItem(item: NavbarMenuItem): boolean {
  const link = String(item.link || '').toLowerCase();
  return link.includes('reservation') || RESERVATIONS_LABELS.has(normLabel(item.label));
}

export type StorefrontTopNavOptions = {
  showGiftCards?: boolean;
  showReservations?: boolean;
  giftCardLabel?: string;
  reservationsLabel?: string;
};

/**
 * Public homepage + shop top bar: Home, Menu, optional Gift Card / Reservations.
 * Contact and other CMS sections belong in the mobile drawer only.
 */
export function buildStorefrontTopbarItems(
  items: NavbarMenuItem[] | undefined | null,
  opts?: StorefrontTopNavOptions
): NavbarMenuItem[] {
  const list = Array.isArray(items) ? items : [];
  const home = list.find(isStorefrontHomeNavItem) || DEFAULT_SMOOTH_SCROLL_MENU[0];
  const menu = list.find(isStorefrontMenuNavItem) || DEFAULT_SMOOTH_SCROLL_MENU[1];
  const topbar: NavbarMenuItem[] = [home, menu];
  if (opts?.showGiftCards) {
    const existing = list.find(isStorefrontGiftCardNavItem);
    topbar.push(existing || { label: opts.giftCardLabel || 'Gift Card', link: '/gift-cards' });
  }
  if (opts?.showReservations) {
    const existing = list.find(isStorefrontReservationsNavItem);
    topbar.push(existing || { label: opts.reservationsLabel || 'Reservations', link: '/reservations' });
  }
  return topbar;
}

/** Items that stay in the hamburger menu (contact, about, gallery, extra CMS pages, …). */
export function buildStorefrontDrawerExtras(
  items: NavbarMenuItem[] | undefined | null,
  topbar: NavbarMenuItem[]
): NavbarMenuItem[] {
  const list = Array.isArray(items) ? items : [];
  const topKeys = new Set(topbar.map((item) => `${item.link}::${normLabel(item.label)}`));
  const isTopbar = (item: NavbarMenuItem) =>
    topKeys.has(`${item.link}::${normLabel(item.label)}`) ||
    isStorefrontHomeNavItem(item) ||
    isStorefrontMenuNavItem(item) ||
    isStorefrontGiftCardNavItem(item) ||
    isStorefrontReservationsNavItem(item);

  const extras = list.filter((item) => !isTopbar(item));
  const contact = list.find(isStorefrontContactNavItem) || DEFAULT_SMOOTH_SCROLL_MENU[2];
  if (!extras.some(isStorefrontContactNavItem) && !isTopbar(contact)) {
    extras.unshift(contact);
  }
  return extras;
}

/** @deprecated Use buildStorefrontTopbarItems — kept for existing imports during migration. */
export function constrainStorefrontTopNav(
  items: NavbarMenuItem[] | undefined | null,
  opts?: StorefrontTopNavOptions
): NavbarMenuItem[] {
  return buildStorefrontTopbarItems(items, opts);
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
