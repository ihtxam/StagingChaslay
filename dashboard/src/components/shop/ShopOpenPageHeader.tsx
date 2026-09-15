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
      <div className="shop-page-content flex h-14 items-center justify-between gap-3">
        <Link
          to={basePath || '/'}
          className="flex min-w-0 items-center gap-2.5"
          aria-label={merchantName || 'Home'}
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-9 w-auto max-w-[7rem] object-contain" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-stone-900 text-xs font-bold text-white">
              {(merchantName || 'M').slice(0, 2).toUpperCase()}
            </div>
          )}
          {merchantName ? (
            <span className="truncate font-bold tracking-tight text-stone-900">{merchantName}</span>
          ) : null}
        </Link>
        <ShopNavActions accountPath={accountPath} iconOnlyLogin />
      </div>
    </header>
  );
}
