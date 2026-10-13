import api from '@/lib/api';
import axios from 'axios';

export type ComoPublicSettings = {
  enabled: boolean;
  environment: 'live';
  apiKeyMasked: string | null;
  apiKeySet: boolean;
  branchId: string | null;
  posId: string | null;
  allowQuickRegistration: boolean;
  configured: boolean;
  lastTestOkAt?: string | null;
};

export type ComoAsset = {
  key: string;
  name?: string;
  type?: string;
  status?: string;
  redeemable?: boolean;
  description?: string;
  punches?: number | null;
  punchesRequired?: number | null;
  itemsSelection?: unknown;
};

export type ComoMember = {
  membershipKey?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  pointsBalance?: number | null;
  creditBalance?: number | null;
  notFound?: boolean;
  assets: ComoAsset[];
};

export type ComoCartItem = {
  lineId?: string;
  itemCode?: string;
  sku?: string;
  barcode?: string;
  productId?: string;
  quantity?: number;
  unitPrice?: number;
};

export type ComoSession = {
  transactionId: string;
  identifier?: string;
  phone?: string;
  email?: string;
  membershipKey?: string;
  assetKeys: string[];
  discountMajor: number;
  member: ComoMember | null;
};

export function emptyComoSession(): ComoSession {
  return {
    transactionId: '',
    assetKeys: [],
    discountMajor: 0,
    member: null,
  };
}

export function comoMemberLabel(member: ComoMember | null | undefined): string {
  if (!member) return '';
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  return name || member.phoneNumber || member.email || member.membershipKey || '';
}

export async function saveComoSettings(patch: Record<string, unknown>) {
  const res = await api.put('/merchant/settings', { comoSettings: patch });
  return res.data?.comoSettings as ComoPublicSettings | undefined;
}

export async function testComoConnection() {
  const res = await api.post('/merchant/como/test-connection');
  return res.data as { ok: boolean; configured?: boolean; error?: string };
}

export async function identifyComoMember(body: {
  identifier?: string;
  phone?: string;
  email?: string;
  membershipKey?: string;
  transactionId?: string;
  orderType?: string;
  items?: ComoCartItem[];
  totalMajor?: number;
}) {
  const res = await api.post('/merchant/como/identify', body);
  return res.data as { transactionId: string; member: ComoMember };
}

export async function fetchComoBenefits(body: {
  identifier?: string;
  phone?: string;
  email?: string;
  membershipKey?: string;
  transactionId?: string;
  orderType?: string;
  items?: ComoCartItem[];
  totalMajor?: number;
  assetKeys?: string[];
}) {
  const res = await api.post('/merchant/como/benefits', body);
  return res.data as {
    transactionId: string;
    totalDiscountMinor: number;
    discounts: Array<{ amountMinor: number; name?: string }>;
  };
}

export async function submitComoPurchase(body: {
  identifier?: string;
  phone?: string;
  email?: string;
  membershipKey?: string;
  transactionId?: string;
  orderType?: string;
  items?: ComoCartItem[];
  totalMajor?: number;
  assetKeys?: string[];
  orderId?: string;
}) {
  const res = await api.post('/merchant/como/submit', body);
  return res.data as { transactionId: string; confirmation?: string | null };
}

export async function voidComoPurchase(body: {
  transactionId?: string;
  orderId?: string;
  membershipKey?: string;
  identifier?: string;
}) {
  const res = await api.post('/merchant/como/void', body);
  return res.data as { ok: boolean; transactionId?: string };
}

export async function identifyKioskComo(token: string, body: Record<string, unknown>) {
  const res = await axios.post(`/api/kiosk/${token}/como/identify`, body);
  return res.data as { transactionId: string; member: ComoMember };
}

export async function fetchKioskComoBenefits(token: string, body: Record<string, unknown>) {
  const res = await axios.post(`/api/kiosk/${token}/como/benefits`, body);
  return res.data as { transactionId: string; totalDiscountMinor: number };
}

export async function submitKioskComo(token: string, body: Record<string, unknown>) {
  const res = await axios.post(`/api/kiosk/${token}/como/submit`, body);
  return res.data as { transactionId: string; confirmation?: string | null };
}
