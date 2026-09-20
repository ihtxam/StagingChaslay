import { Link } from 'react-router-dom';
import ShopMobileNavMenu from '@/components/shop/ShopMobileNavMenu';
import { useShopLoggedIn } from '@/hooks/useShopLoggedIn';
import { useShopNavFlags } from '@/hooks/useShopNavFlags';
import { useI18n } from '@/lib/i18n';
import { buildShopTopbarNav } from '@/lib/shop-topbar-nav';

/** OpenPage CMS home top strip: logo left, menu next to language/account. */
export default function ShopOpenPageHeader({
  basePath,
  merchantName,
  logoUrl,
  shopKey,
  showGiftCards,
  showReservations,
}: {
  basePath: string;
  merchantName?: string | null;
  logoUrl?: string | null;
  shopKey?: string | null;
  showGiftCards?: boolean;
  showReservations?: boolean;
}) {
  const { t } = useI18n();
  const loggedIn = useShopLoggedIn(shopKey);
  const home = basePath || '/';
  const accountPath = `${home}/account`.replace(/\/+/g, '/');
  const navFlags = useShopNavFlags(shopKey, { showGiftCards, showReservations });
  const { topbarLinks, drawerLinks } = buildShopTopbarNav({
    basePath: home,
    showGiftCards: navFlags.showGiftCards,
    showReservations: navFlags.showReservations,
    labels: {
      home: t('shopHome'),
      menu: t('shopMenu'),
      giftCard: t('shopGiftCardNav'),
      reservations: t('shopReservations'),
      contact: t('shopContact'),
    },
  });

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="shop-page-content shop-navbar-mobile-row flex h-14 items-center justify-between gap-3">
        <Link
          to={home}
          className="shop-navbar-logo-row flex min-w-0 flex-1 items-center gap-2"
          aria-label={merchantName || 'Home'}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="shop-navbar-logo-image h-9 w-auto max-w-[4.5rem] shrink-0 object-contain"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-stone-900 text-xs font-bold text-white">
              {(merchantName || 'M').slice(0, 2).toUpperCase()}
            </div>
          )}
          {merchantName ? (
            <span className="shop-navbar-store-name min-w-0 truncate text-sm font-bold tracking-tight text-stone-900">
              {merchantName}
            </span>
          ) : null}
        </Link>
        <div className="flex min-w-0 shrink-0 items-center gap-3 sm:gap-4">
          <nav className="hidden sm:flex min-w-0 items-center gap-4 text-sm font-medium text-stone-800">
            {topbarLinks.map((link) => (
              <Link key={link.to} to={link.to}>
                {link.label}
              </Link>
            ))}
          </nav>
          <ShopMobileNavMenu accountPath={accountPath} loggedIn={loggedIn} links={drawerLinks} />
        </div>
      </div>
    </header>
  );
}
