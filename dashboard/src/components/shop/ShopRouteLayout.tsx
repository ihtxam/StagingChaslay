import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { resolveShopKey, resolveShopLocationSlug, shopBasePath } from '@/lib/shop-cart';
import ShopStorefrontFooter from '@/components/shop/ShopStorefrontFooter';

/** Shared shop shell: page content grows; footer stays full-width at the bottom. */
export default function ShopRouteLayout({ children }: { children: ReactNode }) {
  const { merchantSlug, locationSlug } = useParams<{ merchantSlug?: string; locationSlug?: string }>();
  const shopKey = resolveShopKey(merchantSlug);
  const basePath = shopBasePath(shopKey, resolveShopLocationSlug({ locationSlug }));

  return (
    <div className="shop-route-layout flex min-h-dvh flex-col">
      <div className="shop-route-layout__main flex flex-1 flex-col min-h-0">{children}</div>
      <ShopStorefrontFooter basePath={basePath} className="shop-route-layout__footer mt-auto w-full shrink-0" />
    </div>
  );
}
