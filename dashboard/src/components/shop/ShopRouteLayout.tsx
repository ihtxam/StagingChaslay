import { useEffect, useMemo, type ReactNode } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { resolveShopKey, resolveShopLocationSlug, shopBasePath } from '@/lib/shop-cart';
import ShopStorefrontFooter from '@/components/shop/ShopStorefrontFooter';
import ShopReservationFab from '@/components/shop/ShopReservationFab';
import { scrollToAnchorWhenReady } from '@/chaslay-pagebuilder/utils/anchor-scroll';
import { useShopNavFlags } from '@/hooks/useShopNavFlags';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';

/** Shared shop shell: page content grows; footer stays full-width at the bottom. */
export default function ShopRouteLayout({ children }: { children: ReactNode }) {
  const { merchantSlug, locationSlug } = useParams<{ merchantSlug?: string; locationSlug?: string }>();
  const { pathname, hash } = useLocation();
  const shopKey = resolveShopKey(merchantSlug);
  const basePath = shopBasePath(shopKey, resolveShopLocationSlug({ locationSlug }));
  const navFlags = useShopNavFlags(shopKey);
  const { theme: cmsTheme } = useShopCmsTheme(shopKey);
  const hideReservationFab = useMemo(() => {
    const path = pathname.replace(/\/+$/, '') || '/';
    return /\/reservations$/.test(path);
  }, [pathname]);

  useEffect(() => {
    if (!hash) return;
    const t = window.setTimeout(() => scrollToAnchorWhenReady(hash), 150);
    const onHashChange = () => scrollToAnchorWhenReady(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [pathname, hash]);

  return (
    <div className="shop-route-layout flex min-h-dvh flex-col">
      <div className="shop-route-layout__main flex flex-1 flex-col min-h-0">{children}</div>
      <ShopStorefrontFooter basePath={basePath} className="shop-route-layout__footer mt-auto w-full shrink-0" />
      {shopKey && navFlags.showReservations && !hideReservationFab ? (
        <ShopReservationFab shopKey={shopKey} accent={cmsTheme?.accent} />
      ) : null}
    </div>
  );
}
