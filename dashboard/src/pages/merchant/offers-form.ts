export type OfferType =
  | 'percent_category'
  | 'percent_order'
  | 'fixed_off'
  | 'bogo'
  | 'pay_n_get_m'
  | 'nth_item_percent'
  | 'package_deal'
  | 'combo_deal'
  | 'cart_free_gift';

export const MAX_MIN_ORDER_DIGITS = 10;
export const MAX_PERCENT_OFF = 100;

export function clampMoneyDigits(raw: string, maxDigits: number) {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.');
  const intPart = (parts[0] || '').slice(0, maxDigits);
  if (parts.length <= 1) return intPart;
  return `${intPart}.${parts.slice(1).join('').slice(0, 2)}`;
}

export function clampNonNegativeIntStr(raw: string) {
  if (raw.trim() === '' || raw === '-') return raw;
  const n = Number(raw);
  if (!Number.isFinite(n)) return '0';
  return String(Math.max(0, Math.floor(n)));
}

export function endOfZurichDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export function startOfZurichDay(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function validityPreset(kind: 'today' | 'two_days' | 'week'): { validFrom: string; validTo: string } {
  const from = startOfZurichDay(new Date());
  const to = new Date(from);
  if (kind === 'two_days') {
    to.setDate(to.getDate() + 1);
  } else if (kind === 'week') {
    to.setDate(to.getDate() + 6);
  }
  return { validFrom: from.toISOString(), validTo: endOfZurichDay(to).toISOString() };
}

export function validityOnDate(ymd: string): { validFrom: string; validTo: string } {
  const from = startOfZurichDay(new Date(`${ymd}T12:00:00`));
  return { validFrom: from.toISOString(), validTo: endOfZurichDay(from).toISOString() };
}

export function ymdFromIso(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type OfferFormState = {
  name: string;
  description: string;
  offerType: OfferType;
  percentOff: string;
  fixedOff: string;
  buyQty: string;
  getQty: string;
  getDiscountPercent: string;
  payQty: string;
  receiveQty: string;
  nthItem: string;
  sameProductOnly: boolean;
  packagePrice: string;
  buyProductIds: string[];
  getProductIds: string[];
  minOrderAmount: string;
  channels: string[];
  categoryIds: string[];
  productIds: string[];
  staffIds: string[];
  scheduleMode: string;
  daysOfWeek: string[];
  timeStart: string;
  timeEnd: string;
  validFrom: string;
  validTo: string;
  validityPreset: '' | 'today' | 'two_days' | 'week' | 'date';
  featured: boolean;
  isActive: boolean;
  badgeLabel: string;
  priority: string;
  stackable: boolean;
  cartGiftTiers: Array<{
    id: string;
    minCartTotal: string;
    label: string;
    productIds: string[];
  }>;
};

export function emptyForm(): OfferFormState {
  return {
    name: '',
    description: '',
    offerType: 'percent_order',
    percentOff: '20',
    fixedOff: '5',
    buyQty: '2',
    getQty: '1',
    getDiscountPercent: '100',
    payQty: '3',
    receiveQty: '4',
    nthItem: '2',
    sameProductOnly: false,
    packagePrice: '25',
    buyProductIds: [],
    getProductIds: [],
    minOrderAmount: '',
    channels: [],
    categoryIds: [],
    productIds: [],
    staffIds: [],
    scheduleMode: 'always',
    daysOfWeek: [],
    timeStart: '',
    timeEnd: '',
    validFrom: '',
    validTo: '',
    validityPreset: '',
    featured: true,
    isActive: true,
    badgeLabel: '',
    priority: '10',
    stackable: false,
    cartGiftTiers: [],
  };
}
