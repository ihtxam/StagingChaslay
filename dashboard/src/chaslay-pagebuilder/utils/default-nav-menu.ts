export type NavbarMenuItem = { label: string; link: string };

/** Default single-page smooth-scroll nav — links must match SECTION_ANCHORS on sections. */
export const DEFAULT_SMOOTH_SCROLL_MENU: NavbarMenuItem[] = [
  { label: 'Home', link: '#home' },
  { label: 'Menu', link: '#menu' },
  { label: 'About Us', link: '#about' },
  { label: 'Gallery', link: '#gallery' },
  { label: 'Testimonials', link: '#testimonials' },
  { label: 'Opening Hours', link: '#opening-hours' },
  { label: 'Contact', link: '#contact' },
];

/** Full anchor map for builder docs / manual nav setup. */
export const SECTION_NAV_LINKS: NavbarMenuItem[] = [
  { label: 'Home', link: '#home' },
  { label: 'Menu', link: '#menu' },
  { label: 'About Us', link: '#about' },
  { label: 'Gallery', link: '#gallery' },
  { label: 'Testimonials', link: '#testimonials' },
  { label: 'Opening Hours', link: '#opening-hours' },
  { label: 'Contact', link: '#contact' },
  { label: 'Featured', link: '#featured' },
  { label: 'Promotions', link: '#promotions' },
  { label: 'Team', link: '#team' },
  { label: 'Blog', link: '#blog' },
  { label: 'Reservations', link: '#reservations' },
  { label: 'Map', link: '#map' },
  { label: 'Footer', link: '#footer' },
];
