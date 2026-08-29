import axios from 'axios';

export type KioskPromoSlide = {
  imageUrl?: string;
  overlayText?: string;
  title?: string;
  subtitle?: string;
};

export type KioskFulfillmentChannel = 'takeaway' | 'delivery' | 'dine_in';

export type KioskConfig = {
  merchant: { id: string; name: string; slug: string };
  settings: {
    name: string;
    promoSlides: KioskPromoSlide[];
    slideBannerText?: string;
    enabledLanguages: string[];
    defaultLanguage: string;
    tableMode: 'table' | 'badge' | 'both';
    membershipScanEnabled: boolean;
    idleTimeoutSeconds: number;
    locationSlug?: string | null;
    cashPaymentEnabled?: boolean;
    cardPaymentEnabled?: boolean;
    takeawayEnabled?: boolean;
    deliveryEnabled?: boolean;
    dineInEnabled?: boolean;
    attractHeadline?: string;
    attractSubheadline?: string;
    brandPrimaryColor?: string;
    brandSecondaryColor?: string;
    brandButtonTextColor?: string;
    autoPrintKitchen?: boolean;
    autoPrintReceipt?: boolean;
  };
  tables: Array<{ id: string; label: string }>;
};

export type KioskDiagnostics = {
  terminalConfigured: boolean;
  terminalRegistered: boolean;
  terminalLabel?: string | null;
  adyenConfigured: boolean;
  cashPaymentEnabled?: boolean;
  cardPaymentEnabled?: boolean;
  printAgentNote?: string;
};

export type KioskAdminSettings = {
  accessToken?: string;
  name?: string;
  promoSlides?: KioskPromoSlide[];
  slideBannerText?: string;
  enabledLanguages?: string[];
  defaultLanguage?: string;
  terminalId?: string | null;
  locationSlug?: string | null;
  tableMode?: 'table' | 'badge' | 'both';
  membershipScanEnabled?: boolean;
  kioskAutoAcceptCard?: boolean;
  kioskCashNeedsApproval?: boolean;
  idleTimeoutSeconds?: number;
  adminPin?: string;
  cashPaymentEnabled?: boolean;
  cardPaymentEnabled?: boolean;
  takeawayEnabled?: boolean;
  deliveryEnabled?: boolean;
  dineInEnabled?: boolean;
  attractHeadline?: string;
  attractSubheadline?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandButtonTextColor?: string;
  autoPrintKitchen?: boolean;
  autoPrintReceipt?: boolean;
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
    fulfillmentChannel?: KioskFulfillmentChannel;
    tableId?: string;
    badgeNumber?: string;
    locationSlug?: string;
    customerName?: string;
    membershipCardId?: string;
    shippingAddress?: string;
  }
) {
  const res = await axios.post(`/api/shop/${slug}/orders`, {
    ...payload,
    orderSource: 'kiosk',
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

export async function verifyKioskAdminPin(token: string, pin: string) {
  const res = await axios.post(`/api/kiosk/${token}/verify-admin-pin`, { pin });
  return res.data as { success: boolean; adminUrl?: string };
}

export async function fetchKioskDiagnosticsByToken(token: string): Promise<KioskDiagnostics> {
  const res = await axios.get(`/api/kiosk/${token}/diagnostics`);
  return res.data.diagnostics as KioskDiagnostics;
}

export async function fetchKioskAdminSettingsByToken(
  token: string,
  pin: string
): Promise<KioskAdminSettings> {
  const res = await axios.post(`/api/kiosk/${token}/admin-settings`, { pin });
  return res.data.settings as KioskAdminSettings;
}

export async function saveKioskAdminSettingsByToken(
  token: string,
  pin: string,
  settings: KioskAdminSettings
): Promise<KioskAdminSettings> {
  const res = await axios.put(`/api/kiosk/${token}/admin-settings`, { pin, settings });
  return res.data.settings as KioskAdminSettings;
}
