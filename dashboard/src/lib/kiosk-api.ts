import axios from 'axios';

export type KioskPromoSlide = {
  imageUrl?: string;
  title?: string;
  subtitle?: string;
};

export type KioskConfig = {
  merchant: { id: string; name: string; slug: string };
  settings: {
    name: string;
    promoSlides: KioskPromoSlide[];
    enabledLanguages: string[];
    defaultLanguage: string;
    tableMode: 'table' | 'badge' | 'both';
    membershipScanEnabled: boolean;
    idleTimeoutSeconds: number;
    locationSlug?: string | null;
  };
  tables: Array<{ id: string; label: string }>;
};

export type KioskMenuCategory = {
  id: string;
  name: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    description?: string;
    image?: string;
    modifierGroups?: unknown[];
  }>;
};

export type KioskCartLine = {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  selectedExtras?: Array<{ id: string; name: string; price: number }>;
};

export async function fetchKioskConfig(token: string): Promise<KioskConfig> {
  const res = await axios.get(`/api/kiosk/${token}/config`);
  return res.data as KioskConfig;
}

export async function fetchKioskMenu(token: string): Promise<KioskMenuCategory[]> {
  const res = await axios.get(`/api/kiosk/${token}/menu`);
  return res.data.data || [];
}

export async function lookupKioskMembership(token: string, code: string) {
  const res = await axios.post(`/api/kiosk/${token}/membership/lookup`, { code });
  return res.data.card;
}

export async function createKioskOrder(
  slug: string,
  payload: {
    kioskToken: string;
    items: Array<{
      productId: string;
      quantity: number;
      selectedExtras?: Array<{ id: string }>;
    }>;
    paymentMethod: 'cash' | 'card';
    tableId?: string;
    badgeNumber?: string;
    locationSlug?: string;
    customerName?: string;
    membershipCardId?: string;
  }
) {
  const res = await axios.post(`/api/shop/${slug}/orders`, {
    ...payload,
    orderSource: 'kiosk',
    fulfillmentChannel: 'dine_in',
    guestCheckout: true,
    customerPhone: 'KIOSK',
  });
  return res.data.order as { id: string; orderNumber?: string };
}

export async function payKioskOrderAtTerminal(token: string, orderId: string) {
  const res = await axios.post(`/api/kiosk/${token}/orders/${orderId}/terminal-pay`);
  return res.data;
}

export function kioskPublicUrl(accessToken: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/kiosk/${accessToken}`;
}
