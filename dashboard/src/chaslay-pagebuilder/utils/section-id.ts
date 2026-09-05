/** Canonical storefront section anchor ids (no leading #). */
export const SECTION_ANCHORS = {
  home: 'home',
  menu: 'menu',
  about: 'about',
  gallery: 'gallery',
  testimonials: 'testimonials',
  openingHours: 'opening-hours',
  contact: 'contact',
  featured: 'featured',
  promotions: 'promotions',
  team: 'team',
  blog: 'blog',
  reservations: 'reservations',
  map: 'map',
  footer: 'footer',
} as const;

export type SectionAnchorKey = keyof typeof SECTION_ANCHORS;

/** Normalize a section anchor id (no leading #). */
export function resolveSectionId(sectionId: string | undefined | null, fallback: string): string {
  const raw = String(sectionId || fallback).trim().replace(/^#/, '');
  return raw || fallback;
}

export function sectionAnchorId(
  sectionId: string | undefined | null,
  key: SectionAnchorKey
): string {
  return resolveSectionId(sectionId, SECTION_ANCHORS[key]);
}
