export type PosChannel = 'takeaway' | 'dine_in' | 'delivery';

/** Virtual POS menu categories (not in catalog). */
export const POS_MOST_SOLD_CATEGORY = '__most_sold__';
export const POS_GIFT_CARDS_CATEGORY = '__gift_cards__';

export type PosCategoryId = string | 'all' | typeof POS_MOST_SOLD_CATEGORY | typeof POS_GIFT_CARDS_CATEGORY;

export type PosTab = 'tables' | 'register' | 'order_center' | 'orders' | 'bookings';

export type PosView = PosTab | 'checkout' | 'success';

export type KeypadMode = 'qty' | 'percent' | 'price';

export type PosPaymentMethod = 'cash' | 'card' | 'terminal' | 'pay_later' | 'gift_card';

export type GiftCardLineMeta = {
  op: 'sell' | 'reload';
  cardNumber: string;
  cardId?: string;
  mediaType: 'physical' | 'e_card';
  amount: number;
  /** Recipient email for e-gift delivery (required when deliveryMethod is email). */
  ecardEmail?: string;
  holderName?: string;
  /** print | email | both — e-gift only */
  deliveryMethod?: 'print' | 'email' | 'both';
};

export type CartLine = {
  lineId: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  taxable: boolean;
  categoryId?: string | null;
  selectedExtras: import('@/lib/shop-cart').ShopSelectedExtra[];
  comboSelections: import('@/lib/shop-cart').ShopComboSelection[];
  isOpenPrice?: boolean;
  /** Sold by weight: quantity is kg, unitPrice is CHF/kg */
  isWeighed?: boolean;
  weightKg?: number;
  courseNumber?: number;
  lineDiscountPercent?: number;
  sentToKitchen?: boolean;
  /** Epoch ms when line was sent to kitchen (Ordered tab). */
  sentToKitchenAt?: number;
  /** Gift card sell/reload  - credited after successful payment */
  giftCard?: GiftCardLineMeta;
};

export type Category = { id: string; name: string; color?: string | null };

export type Product = {
  id: string;
  name: string;
  price: number | string;
  categoryId?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  isTaxable?: boolean;
  isOpenPrice?: boolean;
  soldByWeight?: boolean;
  weightUnit?: string | null;
  stock?: number;
  productType?: string;
  sku?: string | null;
  barcode?: string | null;
  allowExtras?: boolean;
  extras?: Array<{ id: string; name: string; price: number; isDefault?: boolean }>;
  modifierGroups?: import('@/components/shop/ShopProductModifiersModal').ShopModifierGroup[];
  comboSlots?: import('@/components/shop/ShopComboWizard').ComboSlot[];
};

export type PostSuccessTarget = 'register' | 'tables';

/** Whole-bill discount: percent XOR fixed CHF amount (percent wins if both set). */
export type BillDiscount = {
  percent: number;
  amount: number;
};

/** Open cart draft for a table / tab / channel (kept in sessionStorage across refresh). */
export type OpenCartDraft = {
  cart: CartLine[];
  channel: PosChannel | null;
  tableId: string | null;
  tableLabel: string | null;
  tabNumber: string | null;
  /** Stable kitchen/takeaway shout + opaque receipt id for this open cart. */
  ticketDisplay?: string | null;
  ticketOrderNumber?: string | null;
  orderNote: string;
  activeCourse: number;
  orderSent: boolean;
  coursesBulkSent: boolean;
  selectedLineId: string | null;
  keypadBuffer: string;
  /** Order-level discount (not per-line). */
  billDiscount?: BillDiscount;
};

export function openCartDraftKey(opts: {
  tableId?: string | null;
  tabNumber?: string | null;
  channel?: PosChannel | null;
}): string {
  if (opts.tableId) return `table:${opts.tableId}`;
  if (opts.tabNumber) return `tab:${opts.tabNumber}`;
  if (opts.channel === 'delivery') return 'channel:delivery';
  return 'channel:takeaway';
}
