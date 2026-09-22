import { useEffect, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { resolveShopKey, resolveShopLocationSlug, shopBasePath } from '@/lib/shop-cart';
import ShopStorefrontFooter from '@/components/shop/ShopStorefrontFooter';
import { scrollToAnchorWhenReady } from '@/chaslay-pagebuilder/utils/anchor-scroll';

/** Shared shop shell: page content grows; footer stays full-width at the bottom. */
export default function ShopRouteLayout({ children }: { children: ReactNode }) {
  const { merchantSlug, locationSlug } = useParams<{ merchantSlug?: string; locationSlug?: string }>();
  const shopKey = resolveShopKey(merchantSlug);
  const basePath = shopBasePath(shopKey, resolveShopLocationSlug({ locationSlug }));

  useEffect(() => {
    if (!window.location.hash) return;
    const t = window.setTimeout(() => scrollToAnchorWhenReady(window.location.hash), 150);
    const onHashChange = () => scrollToAnchorWhenReady(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  return (
    <div className="shop-route-layout flex min-h-dvh flex-col">
      <div className="shop-route-layout__main flex flex-1 flex-col min-h-0">{children}</div>
      <ShopStorefrontFooter basePath={basePath} className="shop-route-layout__footer mt-auto w-full shrink-0" />
    </div>
  );
}
