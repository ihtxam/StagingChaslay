import { Link } from 'react-router-dom';
import ShopNavActions from '@/components/shop/ShopNavActions';

/** PDF 1.1 global shop nav: circular logo + name | language + Login/Account. */
export default function ShopMinimalHeader({
  basePath,
  merchantName,
  logoUrl,
  loggedIn = false,
}: {
  basePath: string;
  merchantName?: string | null;
  logoUrl?: string | null;
  loggedIn?: boolean;
}) {
  const home = basePath || '/';
  const accountPath = `${home}/account`.replace(/\/+/g, '/');

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="shop-page-content flex h-14 items-center justify-between gap-3">
        <Link
          to={home}
          className="flex min-w-0 items-center gap-2"
          aria-label={merchantName || 'Home'}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white">
              {(merchantName || 'M').slice(0, 2).toUpperCase()}
            </div>
          )}
          {merchantName ? (
            <span className="min-w-0 truncate text-sm font-bold tracking-tight text-stone-900">
              {merchantName}
            </span>
          ) : null}
        </Link>
        <ShopNavActions accountPath={accountPath} loggedIn={loggedIn} />
      </div>
    </header>
  );
}
