export type ShopNavLink = { label: string; to: string; onClick?: () => void };

export type ShopTopbarNavLabels = {
  home: string;
  menu: string;
  giftCard: string;
  reservations: string;
  contact: string;
  storeInfo?: string;
};

export type ShopTopbarNavOptions = {
  basePath: string;
  showGiftCards?: boolean;
  showReservations?: boolean;
  onStoreInfo?: () => void;
  labels: ShopTopbarNavLabels;
};

function joinPath(base: string, segment: string): string {
  const home = base || '/';
  if (segment.startsWith('#')) return `${home}${segment}`;
  return `${home}/${segment}`.replace(/\/+/g, '/');
}

/** Primary shop topbar links plus hamburger-only extras (contact, store info, …). */
export function buildShopTopbarNav(opts: ShopTopbarNavOptions): {
  topbarLinks: ShopNavLink[];
  drawerLinks: ShopNavLink[];
} {
  const home = opts.basePath || '/';
  const topbarLinks: ShopNavLink[] = [
    { label: opts.labels.home, to: home },
    { label: opts.labels.menu, to: joinPath(home, 'menu') },
  ];
  if (opts.showGiftCards) {
    topbarLinks.push({ label: opts.labels.giftCard, to: joinPath(home, 'gift-cards') });
  }
  if (opts.showReservations) {
    topbarLinks.push({ label: opts.labels.reservations, to: joinPath(home, 'reservations') });
  }

  /** Hamburger-only on desktop (topbar already shows Home/Menu/Gift card). Mobile shows both lists. */
  const drawerLinks: ShopNavLink[] = [];
  if (opts.onStoreInfo && opts.labels.storeInfo) {
    drawerLinks.push({ label: opts.labels.storeInfo, onClick: opts.onStoreInfo });
  }
  drawerLinks.push({ label: opts.labels.contact, to: joinPath(home, '#contact') });

  return { topbarLinks, drawerLinks };
}
