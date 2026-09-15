import { Link } from 'react-router-dom';
import ShopNavActions from '@/components/shop/ShopNavActions';

/** Minimal header for OpenPage CMS home (logo, store name, login + language). */
export default function ShopOpenPageHeader({
  basePath,
  merchantName,
  logoUrl,
}: {
  basePath: string;
  merchantName?: string | null;
  logoUrl?: string | null;
}) {
  const accountPath = `${basePath}/account`.replace(/\/+/g, '/');

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="shop-page-content shop-navbar-mobile-row flex h-14 items-center justify-between gap-3">
        <Link
          to={basePath || '/'}
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
        <ShopNavActions accountPath={accountPath} iconOnlyLogin />
      </div>
    </header>
  );
}
