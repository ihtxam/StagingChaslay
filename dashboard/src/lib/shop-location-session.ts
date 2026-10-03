import type { ShopChannel, ShopCheckoutDraft } from '@/lib/shop-cart';

export type ShopOrderMode = 'menu' | 'catering';

export type ShopLocationSession = {
  locationSlug: string;
  locationName?: string;
  channel: ShopChannel;
  orderMode: ShopOrderMode;
  fulfillmentConfirmed: boolean;
  address?: string;
  zipCode?: string;
  city?: string;
  lat?: number;
  lng?: number;
  deliveryInfo?: unknown;
};

const key = (shopKey: string) => `manupos_shop_location_session:${shopKey}`;

export function loadShopLocationSession(shopKey: string): ShopLocationSession | null {
  if (!shopKey) return null;
  try {
    const raw = sessionStorage.getItem(key(shopKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShopLocationSession;
    if (!parsed?.locationSlug) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveShopLocationSession(shopKey: string, session: ShopLocationSession) {
  if (!shopKey) return;
  try {
    sessionStorage.setItem(key(shopKey), JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function clearShopLocationSession(shopKey: string) {
  try {
    sessionStorage.removeItem(key(shopKey));
  } catch {
    /* ignore */
  }
}

export function isShopLocationSessionReady(
  shopKey: string,
  locationSlug: string | null | undefined
): boolean {
  const s = loadShopLocationSession(shopKey);
  if (!s?.fulfillmentConfirmed || !s.locationSlug) return false;
  if (locationSlug && s.locationSlug !== locationSlug) return false;
  return true;
}

export function applyShopLocationSessionToDraft(
  draft: ShopCheckoutDraft,
  session: ShopLocationSession
): ShopCheckoutDraft {
  return {
    ...draft,
    channel: session.channel,
    fulfillmentConfirmed: true,
    address: session.address ?? draft.address,
    zipCode: session.zipCode ?? draft.zipCode,
    city: session.city ?? draft.city,
    lat: session.lat ?? draft.lat,
    lng: session.lng ?? draft.lng,
    deliveryInfo: (session.deliveryInfo as ShopCheckoutDraft['deliveryInfo']) ?? draft.deliveryInfo,
  };
}

export type ShopPublicLocation = {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  city?: string | null;
  isDefault?: boolean | null;
  hasCatering?: boolean;
};
