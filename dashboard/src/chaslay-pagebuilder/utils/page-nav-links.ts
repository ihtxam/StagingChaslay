import type { HomepageBuilderPage } from '../types/homepage-builder';

export type NavMenuItem = { label: string; link: string };

/** Storefront path for a builder page (homepage uses `/`). */
export function pageNavLink(page: Pick<HomepageBuilderPage, 'title' | 'slug' | 'is_homepage'>): NavMenuItem {
  const link = page.is_homepage ? '/' : `/pages/${page.slug}`;
  return { label: page.title, link };
}

/** Normalize a nav link for comparison (strip base path, trailing slash). */
export function normalizeNavLinkForMatch(link: string): string {
  const raw = String(link || '').trim();
  if (!raw || raw === '#') return raw;
  let path = raw;
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      return raw;
    }
  }
  path = path.replace(/\/+$/, '') || '/';
  if (path !== '/' && !path.startsWith('/')) path = `/${path}`;
  return path;
}

/** Whether a menu item points at the given builder page. */
export function menuItemMatchesPage(
  item: NavMenuItem,
  page: Pick<HomepageBuilderPage, 'slug' | 'is_homepage'>
): boolean {
  const link = normalizeNavLinkForMatch(item.link);
  if (page.is_homepage) return link === '/' || link === '/home' || link.endsWith('/home');
  const slugPath = `/pages/${page.slug}`;
  return link === slugPath || link.endsWith(slugPath);
}

/** Collect links already represented in menu items (for deduping page picker). */
export function existingPageSlugsInMenu(
  items: NavMenuItem[],
  pages: HomepageBuilderPage[]
): Set<string> {
  const used = new Set<string>();
  for (const page of pages) {
    if (items.some((item) => menuItemMatchesPage(item, page))) {
      used.add(page.slug);
    }
  }
  return used;
}
