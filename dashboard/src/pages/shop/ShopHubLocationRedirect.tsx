import { useEffect } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import {
  isShopPathHubRouting,
  resolveShopKey,
  shopCateringHomePath,
  shopCateringMenuPath,
  shopMenuLandingPath,
} from '@/lib/shop-cart';
import {
  loadShopLocationSession,
  saveShopLocationSession,
  type ShopChannel,
} from '@/lib/shop-location-session';

/**
 * Legacy /{slug}/l/{location}/menu URLs on path-based shop hubs → /{slug}/menu
 * with location stored in session (order.rebornsense.com, shop.chaslay.com).
 */
export default function ShopHubLocationRedirect() {
  const { merchantSlug, locationSlug } = useParams<{
    merchantSlug?: string;
    locationSlug?: string;
  }>();
  const location = useLocation();
  const shopKey = resolveShopKey(merchantSlug);
  const loc = String(locationSlug || '').trim();
  const wantsCheckout = location.pathname.includes('/checkout');
  const wantsCateringMenu = location.pathname.includes('/catering/menu');
  const wantsCateringHome = /\/catering\/?$/.test(location.pathname.replace(/\/+$/, ''));

  useEffect(() => {
    if (!shopKey || !loc) return;
    const existing = loadShopLocationSession(shopKey);
    if (existing?.locationSlug === loc && existing.fulfillmentConfirmed) return;
    const channel: ShopChannel =
      existing?.channel && existing.channel !== 'dine_in' ? existing.channel : 'takeaway';
    saveShopLocationSession(shopKey, {
      locationSlug: loc,
      locationName: existing?.locationName,
      channel,
      orderMode: existing?.orderMode || 'menu',
      fulfillmentConfirmed: true,
      address: existing?.address,
      zipCode: existing?.zipCode,
      city: existing?.city,
      lat: existing?.lat,
      lng: existing?.lng,
      deliveryInfo: existing?.deliveryInfo,
    });
  }, [shopKey, loc]);

  if (!shopKey || !loc) {
    return <Navigate to="/" replace />;
  }

  const menuTarget = shopMenuLandingPath(shopKey, loc);
  const target = wantsCheckout
    ? menuTarget.replace(/\/menu$/, '/checkout')
    : wantsCateringMenu
      ? shopCateringMenuPath(shopKey, loc)
      : wantsCateringHome
        ? shopCateringHomePath(shopKey, loc)
        : menuTarget;

  return <Navigate to={target} replace />;
}
