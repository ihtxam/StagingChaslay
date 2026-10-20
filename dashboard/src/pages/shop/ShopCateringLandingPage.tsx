import { Link } from 'react-router-dom';
import { ChefHat, Users, Clock } from 'lucide-react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import ShopThemeShell from '@/components/shop/ShopThemeShell';
import ShopMinimalHeader from '@/components/shop/ShopMinimalHeader';
import { useShopCmsTheme } from '@/hooks/useShopCmsTheme';
import { useI18n } from '@/lib/i18n';
import {
  resolveShopKey,
  shopBasePath,
  shopCateringMenuPath,
  resolveShopMenuLocationSlug,
} from '@/lib/shop-cart';
import { loadShopLocationSession } from '@/lib/shop-location-session';
import { useShopNavFlags } from '@/hooks/useShopNavFlags';

/** Catering hub homepage — separate from regular shop menu; CTA opens catering-only ordering. */
export default function ShopCateringLandingPage() {
  const { t } = useI18n();
  const { merchantSlug, locationSlug } = useParams<{ merchantSlug?: string; locationSlug?: string }>();
  const shopKey = useMemo(() => resolveShopKey(merchantSlug), [merchantSlug]);
  const session = loadShopLocationSession(shopKey);
  const menuLocSlug = resolveShopMenuLocationSlug(shopKey, locationSlug, session?.locationSlug);
  const basePath = shopBasePath(shopKey, menuLocSlug);
  const { site } = useShopCmsTheme(shopKey);
  const navFlags = useShopNavFlags(shopKey);
  const orderPath = shopCateringMenuPath(shopKey, menuLocSlug);

  return (
    <ShopThemeShell site={site}>
      <div className="min-h-screen bg-stone-50">
        <ShopMinimalHeader
          basePath={basePath}
          shopKey={shopKey}
          showGiftCards={navFlags.showGiftCards}
          showReservations={navFlags.showReservations}
          showCatering
        />
        <main className="shop-page-content mx-auto max-w-3xl px-4 py-8 sm:py-12">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-800">
              <ChefHat size={26} aria-hidden />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
              {t('shopCateringLandingTitle')}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-stone-600">
              {t('shopCateringLandingIntro')}
            </p>
            <ul className="mt-8 space-y-4 text-sm text-stone-700">
              <li className="flex gap-3">
                <Users className="mt-0.5 shrink-0 text-stone-500" size={18} />
                <span>{t('shopCateringLandingBulletGuests')}</span>
              </li>
              <li className="flex gap-3">
                <Clock className="mt-0.5 shrink-0 text-stone-500" size={18} />
                <span>{t('shopCateringLandingBulletLead')}</span>
              </li>
            </ul>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to={orderPath}
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-stone-900 px-6 text-center text-sm font-semibold text-white hover:bg-stone-800"
              >
                {t('shopCateringLandingOrderCta')}
              </Link>
              <Link
                to={`${basePath}/menu`.replace(/\/+/g, '/')}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-stone-300 bg-white px-6 text-center text-sm font-semibold text-stone-800 hover:bg-stone-50"
              >
                {t('shopMenu')}
              </Link>
            </div>
          </div>
        </main>
      </div>
    </ShopThemeShell>
  );
}
