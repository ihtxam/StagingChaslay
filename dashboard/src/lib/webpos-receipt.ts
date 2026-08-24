import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, formatTimeHHMM, ymdZurich } from '@/lib/date-format';
import {
  channelTaxRateFromMerchant,
  roundMoney2,
  splitVatIncludedGross,
  type MerchantChannelTaxSettings,
} from '@/lib/money';
import { guestOrderNumber } from '@/lib/order-number';
import { APP_NAME } from '@/lib/brand';
import {
  buildReceiptUrl,
  buildGiftCardBarcodePayload,
  buildDeliverySlipQrRasterEscPos,
  buildLabeledReceiptQrRasterEscPos,
  concatBytes,
  escposCode128,
  generateReceiptQrRasterEscPos,
  escposQrCode,
} from '@/lib/qr';
import { escposCp850Encode, ESC_CODEPAGE_CP850 } from '@/lib/escpos-encode';
import { localDateTimeToIso } from '@/lib/shop-hours';
import { resolveOrderItemName } from '@/lib/order-item-name';
import {
  channelLabel,
  formatPayLaterPaymentLabel,
  lineWidthForPaper,
  payLaterCollectedTender,
  paymentLabel,
  receiptLabels,
  type ReceiptLang,
} from '@/lib/receipt-labels';
import { parsePaymentBreakdown } from '@/lib/payment-breakdown';
import {
  appendAdyenReceiptBlock,
  resolveOrderAdyenReceipts,
  type AdyenTerminalReceipt,
} from '@/lib/adyen-receipt';
import { adjustReceiptVatForDiscount } from '@/lib/tax-discount';

/** Where the kitchen ticket was printed from */
export type KitchenOrderSource = 'WEBPOS' | 'ONLINE' | 'POSAPP' | 'WAITERAPP';

/** Web shop or delivery-aggregator order (not in-store POS). */
export function isExternalOnlineOrder(
  order: { orderSource?: string | null; orderType?: string | null }
): boolean {
  const src = String(order.orderSource || '').toLowerCase();
  const t = String(order.orderType || '').toLowerCase();
  return (
    t === 'web_shop' ||
    src === 'online_shop' ||
    src === 'justeat' ||
    src === 'ubereats'
  );
}

/**
 * Arbitrary kitchen / takeaway shout number + receipt record id.
 * Numbers are random (not sequential) so deleted orders cannot be inferred from gaps.
 */
export function nextWebPosTicketNumber(_merchantId?: string | null): {
  display: string;
  orderNumber: string;
} {
  // Customer-facing shout / takeaway number (4 digits, non-sequential).
  const shout = 1000 + Math.floor(Math.random() * 9000);
  const display = `#${shout}`;
  // Opaque receipt / backend record id — no daily counter, no sortable series.
  const a = Math.random().toString(36).slice(2, 8).toUpperCase();
  const b = Math.random().toString(36).slice(2, 6).toUpperCase();
  const orderNumber = `WP-${a}${b}`.slice(0, 20);
  return { display, orderNumber };
}

/** Opaque backend id when the customer-facing shout # already exists. */
export function webPosBackendOrderId(_merchantId?: string | null): string {
  const a = Math.random().toString(36).slice(2, 8).toUpperCase();
  const b = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `WP-${a}${b}`.slice(0, 20);
}

const DINE_IN_COUNTER_STORAGE_KEY = 'webpos_dine_in_counter_v1';

/**
 * Sequential counter-style dine-in ticket (e.g. D-001) per merchant + shift/session.
 * Resets when shift id changes; falls back to session scope when shifts are off.
 */
export function nextDineInCounterNumber(
  merchantId?: string | null,
  shiftId?: string | null
): { display: string; orderNumber: string } {
  const scope = `${merchantId || 'default'}:${shiftId || 'session'}`;
  let next = 1;
  try {
    const raw = sessionStorage.getItem(DINE_IN_COUNTER_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    next = (Number(map[scope]) || 0) + 1;
    map[scope] = next;
    sessionStorage.setItem(DINE_IN_COUNTER_STORAGE_KEY, JSON.stringify(map));
  } catch {
    next = 1 + Math.floor(Math.random() * 999);
  }
  const display = `D-${String(next).padStart(3, '0')}`;
  const stamp = Date.now().toString(36).toUpperCase();
  const orderNumber = `DI-${stamp}-${String(next).padStart(4, '0')}`.slice(0, 20);
  return { display, orderNumber };
}

/** Machine markers stored in order.notes so UI/receipts can recover tab + ticket. */
const TICKET_NOTE_RE = /\[ticket:([^\]]+)\]/i;
const TAB_NOTE_RE = /\[tab:([^\]]+)\]/i;
const MEMBER_NOTE_RE = /\[member:([^\]]+)\]/i;
const PTS_EARN_NOTE_RE = /\[pts_earn:(\d+)\]/i;
const PTS_BAL_NOTE_RE = /\[pts_bal:(\d+)\]/i;
const GIFT_CARD_REMAINING_NOTE_RE = /Gift card remaining:\s*([\d.]+)/i;

export function parseGiftCardRemainingFromNotes(notes?: string | null): number | null {
  const match = String(notes || '').match(GIFT_CARD_REMAINING_NOTE_RE);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? roundMoney2(value) : null;
}

export function encodeOrderMetaNotes(opts: {
  existing?: string | null;
  ticketDisplay?: string | null;
  tabNumber?: string | null;
  memberName?: string | null;
  pointsEarned?: number | null;
  pointsBalance?: number | null;
}): string | undefined {
  let base = String(opts.existing || '')
    .replace(TICKET_NOTE_RE, '')
    .replace(TAB_NOTE_RE, '')
    .replace(MEMBER_NOTE_RE, '')
    .replace(PTS_EARN_NOTE_RE, '')
    .replace(PTS_BAL_NOTE_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[·\s]+|[·\s]+$/g, '')
    .trim();
  const tags: string[] = [];
  const ticket = opts.ticketDisplay?.trim();
  const tab = opts.tabNumber != null ? String(opts.tabNumber).trim() : '';
  const member = opts.memberName?.trim();
  if (ticket) tags.push(`[ticket:${ticket.replace(/[\[\]]/g, '')}]`);
  if (tab) tags.push(`[tab:${tab.replace(/[\[\]]/g, '')}]`);
  if (member) tags.push(`[member:${member.replace(/[\[\]]/g, '').slice(0, 80)}]`);
  if (opts.pointsEarned != null && Number(opts.pointsEarned) > 0) {
    tags.push(`[pts_earn:${Math.floor(Number(opts.pointsEarned))}]`);
  }
  if (opts.pointsBalance != null && Number.isFinite(Number(opts.pointsBalance))) {
    tags.push(`[pts_bal:${Math.max(0, Math.floor(Number(opts.pointsBalance)))}]`);
  }
  const joined = [...tags, base].filter(Boolean).join(' ').trim();
  return joined || undefined;
}

export function parseOrderMetaNotes(notes?: string | null): {
  ticketDisplay?: string;
  tabNumber?: string;
  memberName?: string;
  pointsEarned?: number;
  pointsBalance?: number;
  cleanNotes: string;
} {
  const raw = String(notes || '');
  const ticketMatch = raw.match(TICKET_NOTE_RE);
  const tabMatch = raw.match(TAB_NOTE_RE);
  const memberMatch = raw.match(MEMBER_NOTE_RE);
  const earnMatch = raw.match(PTS_EARN_NOTE_RE);
  const balMatch = raw.match(PTS_BAL_NOTE_RE);
  const cleanNotes = raw
    .replace(TICKET_NOTE_RE, '')
    .replace(TAB_NOTE_RE, '')
    .replace(MEMBER_NOTE_RE, '')
    .replace(PTS_EARN_NOTE_RE, '')
    .replace(PTS_BAL_NOTE_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[·\s]+|[·\s]+$/g, '')
    .trim();
  let ticketDisplay = ticketMatch?.[1]?.trim() || undefined;
  if (ticketDisplay && !ticketDisplay.startsWith('#')) {
    ticketDisplay = `#${ticketDisplay.replace(/^#/, '')}`;
  }
  const pointsEarned = earnMatch?.[1] != null ? Number(earnMatch[1]) : undefined;
  const pointsBalance = balMatch?.[1] != null ? Number(balMatch[1]) : undefined;
  return {
    ticketDisplay,
    tabNumber: tabMatch?.[1]?.trim() || undefined,
    memberName: memberMatch?.[1]?.trim() || undefined,
    pointsEarned: Number.isFinite(pointsEarned) ? pointsEarned : undefined,
    pointsBalance: Number.isFinite(pointsBalance) ? pointsBalance : undefined,
    cleanNotes,
  };
}

export function googleMapsNavigationUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`;
}

export function deliveryDirectionsUrlForReceipt(tx: {
  channel?: string;
  shippingAddress?: string | null;
  deliveryDirectionsQr?: boolean;
}): string | undefined {
  if (tx.deliveryDirectionsQr === false) return undefined;
  if (tx.channel !== 'delivery') return undefined;
  const address = tx.shippingAddress?.trim();
  if (!address) return undefined;
  return googleMapsNavigationUrl(address);
}

export type KitchenComboLine = {
  slotName?: string;
  productName: string;
  modifierLines?: string[];
};

export type WebPosReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  weightKg?: number | null;
  seatNumber?: number | null;
  productId?: string | null;
  categoryId?: string | null;
  courseNumber?: number | null;
  /** One line per modifier/extra (not mashed into the article name). */
  modifierLines?: string[];
  comboLines?: KitchenComboLine[];
};

export type PosPrintSettingsClient = {
  receiptHeader?: string;
  receiptFooter?: string;
  kitchenTicketHeader?: string;
  kitchenTicketFooter?: string;
  kitchenItemTextScale?: 1 | 2 | 3;
  kitchenHeaderTextScale?: 1 | 2 | 3;
  kitchenBoldText?: boolean;
  receiptShowVatTable?: boolean;
  receiptShowStaffLine?: boolean;
  receiptShowQrCode?: boolean;
  /** When true, delivery order receipts include a Google Maps navigation QR at the bottom. */
  receiptDeliveryDirectionsQr?: boolean;
  /** When true, Adyen card payment receipt is QR-only (not printed on thermal). */
  adyenReceiptDigitalOnly?: boolean;
  paperWidthMm?: 58 | 80;
  receiptLanguage?: 'en' | 'fr' | 'de' | 'panel';
  receiptLogoUrl?: string | null;
  /** Printed logo width in pixels (48–200, default 200). */
  receiptLogoWidthPx?: number;
  autoPrintReceipt?: boolean;
  autoPrintKitchen?: boolean;
  /** Play a bell on the main till when a waiter/mobile kitchen order arrives. */
  waiterTillBellEnabled?: boolean;
  /** Auto-retry failed kitchen prints before surfacing an error. */
  kitchenPrintRetryEnabled?: boolean;
  /** Total print attempts before marking kitchen job failed (default 5). */
  kitchenPrintRetryAttempts?: number;
  /** Seconds between kitchen print retries (default 5). */
  kitchenPrintRetryIntervalSec?: number;
  /** Print Agent USB scale COM port (WebPOS). */
  scaleComPort?: string | null;
  /** Android USB scale address synced from panel. */
  scaleUsbAddress?: string | null;
    scaleEnabled?: boolean;
    labelWidthMm?: 40 | 58;
    labelHeightMm?: 20 | 25 | 30 | 40;
    labelShowStoreName?: boolean;
    labelShowProductName?: boolean;
    labelShowBarcodeNumber?: boolean;
    labelShowPrice?: boolean;
    labelShowSku?: boolean;
    printers?: Array<{
    id: string;
    name: string;
    enabled?: boolean;
    paperWidthMm?: 58 | 80;
    printReceipts?: boolean;
    printKitchenTickets?: boolean;
    printEndOfDayReports?: boolean;
    printLabels?: boolean;
    printAllProducts?: boolean;
    linkedCategoryIds?: string[];
    linkedProductIds?: string[];
  }>;
  /** @deprecated Migrated to printer-level linkedCategoryIds */
  kitchenPrintRouting?: Record<string, KitchenPrintDestination>;
  /** Categories excluded from all kitchen printers (legacy migration from routing "none"). */
  kitchenExcludedCategoryIds?: string[];
};

export type KitchenPrintDestination = 'kitchen1' | 'kitchen2' | 'receipt' | 'none';

export const KITCHEN_PRINT_DESTINATIONS: KitchenPrintDestination[] = [
  'kitchen1',
  'kitchen2',
  'receipt',
  'none',
];

export type WebPosReceipt = {
  businessName: string;
  address?: string;
  phone?: string;
  vatNumber?: string;
  id: string;
  /** Short ticket number shown on kitchen/receipt, e.g. #47 */
  orderDisplay?: string | null;
  /** Full order number stored in backend */
  orderNumber?: string | null;
  /** Takeaway / delivery tab label used as guest order # */
  tabNumber?: string | null;
  completedAt: number;
  channel?: string;
  paymentMethod: string;
  /** Split tenders printed as separate lines (cash + card, etc.). */
  paymentLines?: Array<{ method: string; amount: number }>;
  /** Pay Later collected tender: cash | card | terminal. */
  payLaterTender?: 'cash' | 'card' | 'terminal' | null;
  /** True when this receipt is the collect-payment copy (show Paid). */
  payLaterCollected?: boolean;
  amountTendered?: number | null;
  changeDue?: number | null;
  /** Delivery / online customer (printed on delivery & online receipts) */
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  orderSource?: string | null;
  orderType?: string | null;
  items: WebPosReceiptItem[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  taxRate: number;
  rounding: number;
  tipAmount?: number;
  total: number;
  tableLabel?: string | null;
  guestCount?: number | null;
  vatIncludedInPrice?: boolean;
  /** When true (default), receipt VAT table uses post-remise base. */
  vatAfterDiscount?: boolean;
  splitLabel?: string | null;
  notes?: string;
  receiptUrl?: string;
  includeQr?: boolean;
  /** When false, skip delivery directions QR even for delivery channel. */
  deliveryDirectionsQr?: boolean;
  staffName?: string | null;
  language?: ReceiptLang | string;
  paperWidthMm?: 58 | 80;
  header?: string;
  footer?: string;
  showVat?: boolean;
  showStaff?: boolean;
  /** Adyen terminal customer receipt appended below order receipt */
  adyenCustomerReceipt?: AdyenTerminalReceipt | null;
  /** @deprecated Merchant/cashier copy is never printed on thermal. */
  adyenCashierReceipt?: AdyenTerminalReceipt | null;
  /** When false, skip Adyen customer receipt block on thermal (digital-only mode). */
  printAdyenReceiptOnTicket?: boolean;
  /** Remaining stored-value balance after gift card redemption on this sale. */
  giftCardRemainingBalance?: number | null;
  /** Loyalty member printed on the customer receipt. */
  memberName?: string | null;
  /** Points earned on this sale. */
  loyaltyPointsEarned?: number | null;
  /** Running / lifetime points after this sale. */
  loyaltyPointsBalance?: number | null;
  /** Provisional / preview receipt — no payment block. */
  /** Cumulative refunded amount on this order (for reprint receipts). */
  refundAmount?: number;
  refundReason?: string | null;
  isProvisional?: boolean;
};

export type GiftCardSaleReceipt = {
  businessName: string;
  address?: string;
  phone?: string;
  vatNumber?: string;
  /** Dashed display + barcode payload, e.g. EC-9E1E09C */
  code: string;
  balance: number;
  subtotal?: number;
  taxAmount?: number;
  taxRate?: number;
  total?: number;
  vatIncludedInPrice?: boolean;
  showVat?: boolean;
  recipientEmail?: string | null;
  holderName?: string | null;
  language?: ReceiptLang | string;
  paperWidthMm?: 58 | 80;
  header?: string;
  footer?: string;
};

/** VAT breakdown for a gift-card sale amount. */
export function computeGiftCardSaleVat(
  balance: number,
  taxRate: number,
  vatIncludedInPrice: boolean
): { subtotal: number; taxAmount: number; total: number } {
  const gross = roundMoney2(balance);
  const rate = Number(taxRate) || 0;
  if (rate <= 0) {
    return { subtotal: gross, taxAmount: 0, total: gross };
  }
  if (vatIncludedInPrice !== false) {
    const split = splitVatIncludedGross(gross, rate);
    return { subtotal: split.net, taxAmount: split.tax, total: split.gross };
  }
  const subtotal = gross;
  const taxAmount = roundMoney2(subtotal * (rate / 100));
  return { subtotal, taxAmount, total: roundMoney2(subtotal + taxAmount) };
}

function formatGiftCardVatSection(
  tx: GiftCardSaleReceipt,
  L: ReturnType<typeof receiptLabels>,
  width: number
): string | null {
  const rate = Number(tx.taxRate) || 0;
  const taxAmount = roundMoney2(tx.taxAmount || 0);
  if (tx.showVat === false || rate <= 0 || taxAmount <= 0) return null;
  const net = roundMoney2(tx.subtotal ?? tx.balance);
  const tva = taxAmount;
  const brut = roundMoney2(tx.total ?? tx.balance);
  const pseudo: WebPosReceipt = {
    businessName: tx.businessName,
    id: '',
    completedAt: Date.now(),
    paymentMethod: 'cash',
    items: [],
    subtotal: net,
    discount: 0,
    taxAmount: tva,
    taxRate: rate,
    rounding: 0,
    total: brut,
    vatIncludedInPrice: tx.vatIncludedInPrice !== false,
    showVat: true,
  };
  return formatVatSection(pseudo, L, width);
}

/** Thermal receipt for a newly sold e-gift card (Code128 barcode + code text). */
export function generateGiftCardSaleReceiptText(
  tx: GiftCardSaleReceipt,
  panelLang?: string
): string {
  const width = lineWidthForPaper(tx.paperWidthMm);
  const lang = resolveLang({ language: tx.language } as WebPosReceipt, panelLang);
  const L = receiptLabels(lang);
  const sep = '='.repeat(width);
  const thin = '-'.repeat(width);
  const total = roundMoney2(tx.total ?? tx.balance);

  let r = '';
  r += sep + '\n';
  if (tx.header?.trim()) {
    for (const line of tx.header.trim().split(/\r?\n/)) r += line.slice(0, width) + '\n';
  } else {
    r += (tx.businessName || APP_NAME).toUpperCase().slice(0, width) + '\n';
    if (tx.address) r += tx.address.slice(0, width) + '\n';
    if (tx.phone) r += `Tel: ${tx.phone}`.slice(0, width) + '\n';
    if (tx.vatNumber) r += `VAT: ${tx.vatNumber}`.slice(0, width) + '\n';
  }
  r += sep + '\n';
  r += centerLine(L.giftCardTitle, width) + '\n';
  r += thin + '\n';
  if (tx.holderName?.trim()) {
    r += `${L.customer}: ${tx.holderName.trim().slice(0, width - 12)}\n`;
  }
  if (tx.recipientEmail?.trim()) {
    r += `Email: ${tx.recipientEmail.trim().slice(0, width - 7)}\n`;
  }
  r += padLine(`${L.giftCardBalance}:`, `CHF ${Number(tx.balance || 0).toFixed(2)}`, width) + '\n';
  if (Math.abs(total - Number(tx.balance || 0)) > 0.001) {
    r += padLine(`${L.total}:`, `CHF ${total.toFixed(2)}`, width) + '\n';
  }
  const vatSection = formatGiftCardVatSection(tx, L, width);
  if (vatSection) {
    r += thin + '\n';
    r += vatSection + '\n';
  }
  r += thin + '\n';
  r += centerLine(L.giftCardScanRedeem, width) + '\n';
  r += sep + '\n';
  r += guestReceiptFooterLines(tx.footer, tx.businessName, L.thankYou).trim() + '\n\n\n';
  return r;
}

/** Code128 payload — dashed redeem code only, e.g. EC-9E1E09C. */
export function giftCardSaleBarcodePayload(code: string): string {
  return buildGiftCardBarcodePayload(code);
}

/** @deprecated use giftCardSaleBarcodePayload */
export function giftCardSaleReceiptQrPayload(code: string): string {
  return giftCardSaleBarcodePayload(code);
}

/** ESC/POS bytes for e-gift sale receipt (Code128 only, code printed below). */
export function giftCardSaleReceiptEscPos(
  text: string,
  code: string,
  logoBytes?: Uint8Array | null
): Uint8Array {
  const payload = giftCardSaleBarcodePayload(code);
  const label = buildGiftCardBarcodePayload(code);
  return textToEscPos(text, undefined, logoBytes, payload, label);
}

/** Prefer merchant print settings; kitchen defaults to full 80mm width. */
export function resolveKitchenPaperWidthMm(
  printSettings?: PosPrintSettingsClient | null,
  printerWidthMm?: 58 | 80 | null
): 58 | 80 {
  if (printSettings?.paperWidthMm === 58 || printSettings?.paperWidthMm === 80) {
    return printSettings.paperWidthMm;
  }
  if (printerWidthMm === 58) return 58;
  return 80;
}

/** Whether to append Adyen customer receipt on the order thermal ticket. */
export function shouldPrintAdyenReceiptOnTicket(
  settings?: PosPrintSettingsClient | null
): boolean {
  return settings?.adyenReceiptDigitalOnly !== true;
}

function padLine(left: string, right: string, width: number): string {
  const gap = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(gap) + right;
}

/** Name left, quantity right-aligned in a fixed column (thermal EOD product rows). */
export function reportNameQtyRow(name: string, qty: string | number, width: number): string {
  const qtyWidth = width <= 32 ? 5 : 6;
  const qtyStr = String(qty);
  const value =
    qtyStr.length > qtyWidth ? qtyStr.slice(-qtyWidth) : qtyStr.padStart(qtyWidth);
  const nameWidth = Math.max(1, width - qtyWidth);
  return name.slice(0, nameWidth).padEnd(nameWidth) + value;
}

function formatLoyaltyReceiptLines(
  tx: Pick<WebPosReceipt, 'loyaltyPointsEarned' | 'loyaltyPointsBalance'>,
  L: ReturnType<typeof receiptLabels>,
  width: number
): string {
  const earned = tx.loyaltyPointsEarned != null ? Math.floor(Number(tx.loyaltyPointsEarned)) : 0;
  const hasBalance = tx.loyaltyPointsBalance != null && Number.isFinite(Number(tx.loyaltyPointsBalance));
  if (earned <= 0 && !hasBalance) return '';
  let r = '-'.repeat(width) + '\n';
  if (earned > 0) {
    r += String(L.orderGaveYouPoints || '').replace('{n}', String(earned)) + '\n';
  }
  if (hasBalance) {
    r += padLine(`${L.pointsBalance}:`, `${Math.max(0, Math.floor(Number(tx.loyaltyPointsBalance)))}`, width) + '\n';
  }
  return r;
}

function centerLine(text: string, width: number): string {
  const t = text.slice(0, width);
  const pad = Math.max(0, Math.floor((width - t.length) / 2));
  return ' '.repeat(pad) + t;
}

/** Centered course banner: >> COURSE 1 << */
export function formatCourseBanner(course: number, courseLabel = 'COURSE'): string {
  const n = Math.max(1, Math.floor(Number(course) || 1));
  return `>> ${String(courseLabel || 'COURSE').trim() || 'COURSE'} ${n} <<`;
}

export function formatQtyArticlePrefix(item: {
  quantity?: number | string | null;
  weightKg?: number | null;
}): string {
  const weightKg = item.weightKg;
  if (weightKg != null && Number(weightKg) > 0) {
    return `${Number(weightKg).toFixed(3)} kg `;
  }
  return `${Number(item.quantity) || 0} x `;
}

function stripLeadingDash(text: string): string {
  return String(text || '')
    .replace(/^[-–—•]\s*/, '')
    .trim();
}

/** Split mashed `Name (extra, extra)` when structured extras are missing. */
export function splitReceiptArticle(
  name: string,
  modifierLines?: string[] | null
): { product: string; modifiers: string[] } {
  const existing = (modifierLines || []).map((m) => stripLeadingDash(m)).filter(Boolean);
  const clean = String(name || '').replace(/\s+/g, ' ').trim();
  if (existing.length) {
    const paren = clean.match(/^(.*?)\s*\((.*)\)\s*$/);
    return { product: paren ? paren[1].trim() : clean, modifiers: existing };
  }
  const paren = clean.match(/^(.*?)\s*\((.*)\)\s*$/);
  if (paren) {
    return {
      product: paren[1].trim(),
      modifiers: paren[2]
        .split(/,\s*/)
        .map((m) => stripLeadingDash(m))
        .filter(Boolean),
    };
  }
  return { product: clean, modifiers: [] };
}

function extraIndent(prefix: string): string {
  return ' '.repeat(Math.max(0, prefix.length));
}

function formatReceiptExtraLine(prefix: string, extra: string): string {
  return `${extraIndent(prefix)}- ${stripLeadingDash(extra)}`;
}

function groupReceiptItemsByCourse<T extends { courseNumber?: number | null }>(
  items: T[]
): Array<{ course: number | null; items: T[] }> {
  const hasCourses = items.some((i) => i.courseNumber != null && Number(i.courseNumber) > 0);
  if (!hasCourses) return [{ course: null, items }];
  const courses = Array.from(
    new Set(items.map((i) => Number(i.courseNumber) || 1).filter((n) => n > 0))
  ).sort((a, b) => a - b);
  return courses.map((course) => ({
    course,
    items: items.filter((i) => (Number(i.courseNumber) || 1) === course),
  }));
}

function formatCustomerReceiptItemLines(
  item: WebPosReceiptItem,
  width: number
): string[] {
  const qtyPrefix = formatQtyArticlePrefix(item);
  const { product, modifiers } = splitReceiptArticle(item.name, item.modifierLines);
  const comboLines = (item.comboLines || []).filter((c) => c.productName?.trim());
  const article = product || item.name || 'Item';
  const left = `${qtyPrefix}${article}`.trim();
  const right = Number(item.lineTotal).toFixed(2);
  const out: string[] = [];
  if (left.length + 1 + right.length <= width) {
    out.push(padLine(left, right, width));
  } else {
    const maxLeft = Math.max(8, width - right.length - 1);
    out.push(padLine(left.slice(0, maxLeft), right, width));
  }
  for (const combo of comboLines) {
    const slotLabel = combo.slotName?.trim();
    const pickName = combo.productName.trim();
    const head = slotLabel ? `${slotLabel}: ${pickName}` : pickName;
    out.push(formatReceiptExtraLine(qtyPrefix, head).slice(0, width));
    for (const mod of combo.modifierLines || []) {
      const text = stripLeadingDash(mod);
      if (!text) continue;
      out.push(formatReceiptExtraLine(qtyPrefix, text).slice(0, width));
    }
  }
  for (const mod of modifiers) {
    out.push(formatReceiptExtraLine(qtyPrefix, mod).slice(0, width));
  }
  return out;
}

function resolveScheduledDate(scheduledFor?: string | number | null): Date | null {
  if (scheduledFor == null || scheduledFor === '') return null;
  if (typeof scheduledFor === 'number') {
    const d = new Date(scheduledFor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const raw = String(scheduledFor).trim();
  const iso = localDateTimeToIso(raw);
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatKitchenWhen(scheduledFor?: string | number | null): string | null {
  const d = resolveScheduledDate(scheduledFor);
  if (!d) return null;
  const time = formatTimeHHMM(d);
  const todayKey = ymdZurich();
  const dayKey = ymdZurich(d);
  if (dayKey === todayKey) return time;
  return `${formatDateDDMMYYYY(d)} ${time}`;
}

function resolveLang(tx: WebPosReceipt, panelLang?: string): ReceiptLang {
  const code = String(tx.language || panelLang || 'en').toLowerCase().slice(0, 2);
  if (code === 'fr' || code === 'de') return code;
  return 'en';
}

function vatTableRow(type: string, net: string, tva: string, brut: string, width: number): string {
  const typeWidth = width <= 32 ? 10 : 14;
  const numWidth = width <= 32 ? 5 : 6;
  return (
    type.slice(0, typeWidth).padEnd(typeWidth) +
    net.padStart(numWidth) +
    tva.padStart(numWidth) +
    brut.padStart(numWidth)
  );
}

function formatVatSection(
  tx: WebPosReceipt,
  L: ReturnType<typeof receiptLabels>,
  width: number
): string | null {
  if (tx.showVat === false || tx.taxAmount <= 0 || tx.taxRate <= 0) return null;

  const rateLabel = `${L.tva}: ${tx.taxRate}%`;
  const net = roundMoney2(tx.subtotal);
  const tva = roundMoney2(tx.taxAmount);
  const brut = roundMoney2(net + tva);

  if (tx.vatIncludedInPrice !== false) {
    let r = vatTableRow(L.type, L.net, L.tva, L.brut, width) + '\n';
    r += vatTableRow(rateLabel, net.toFixed(2), tva.toFixed(2), brut.toFixed(2), width);
    return r;
  }

  const text = `${L.tva} ${tx.taxRate}% ${L.net} ${net.toFixed(2)} ${L.tva} ${tva.toFixed(2)} ${L.total} ${brut.toFixed(2)}`;
  return text.slice(0, width);
}

/** Skip footer lines that repeat the store name already printed in the header. */
function guestReceiptFooterLines(
  footer: string | undefined,
  businessName: string | undefined,
  thankYou: string
): string {
  const biz = String(businessName || '')
    .trim()
    .toLowerCase();
  const lines = String(footer || thankYou)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      return !biz || line.toLowerCase() !== biz;
    });
  return lines.join('\n') || thankYou;
}

/**
 * Merchandise TTC after order-level remise (excl. tips & cash rounding).
 * Matches Android ReceiptVatCalculator discount factor + WebPOS cart gross.
 */
function merchandiseBrutAfterDiscount(tx: WebPosReceipt): number {
  if (!tx.items?.length) return 0;
  const gross = roundMoney2(
    tx.items.reduce((sum, item) => sum + roundMoney2(item.lineTotal), 0)
  );
  if (gross <= 0) return 0;
  const disc = roundMoney2(Math.max(0, tx.discount || 0));
  const vatIncluded = tx.vatIncludedInPrice !== false;
  const vatAfterDiscount = tx.vatAfterDiscount !== false;
  if (disc <= 0 || (!vatIncluded && !vatAfterDiscount)) return gross;
  return roundMoney2(Math.max(0, gross - Math.min(disc, gross)));
}

/** Bill merchandise TTC from payable total (order 1-6610 class: TTC = total − tip − rounding). */
function billMerchandiseTtc(tx: WebPosReceipt): number {
  const tip = roundMoney2(tx.tipAmount || 0);
  const rounding = roundMoney2(tx.rounding || 0);
  return roundMoney2(tx.total - tip - rounding);
}

/**
 * Guest receipt bottom number = kitchen shout / tab # / public TX (never opaque WP-/DI- id).
 */
export function guestReceiptBottomNumber(tx: {
  orderDisplay?: string | null;
  orderNumber?: string | null;
  tabNumber?: string | null;
}): string {
  return guestOrderNumber({
    orderNumber: tx.orderNumber,
    orderDisplay: tx.orderDisplay,
    tabNumber: tx.tabNumber,
  });
}

function formatReceiptMetaFooter(
  tx: WebPosReceipt,
  L: ReturnType<typeof receiptLabels>,
  locale: string,
  width: number
): string {
  const dateStr = formatDateTimeDDMMYYYY(tx.completedAt);
  const orderRef = guestReceiptBottomNumber(tx);
  const channel = tx.channel ? channelLabel(L, tx.channel) : '';
  const user = tx.showStaff !== false && tx.staffName?.trim() ? tx.staffName.trim() : '';
  const metaParts = [dateStr, channel, user].filter(Boolean);
  let r = '';
  if (orderRef) r += centerLine(orderRef, width) + '\n';
  if (metaParts.length) r += centerLine(metaParts.join(' | '), width);
  return r.trimEnd();
}

function hasGiftCardPayment(tx: WebPosReceipt): boolean {
  const method = String(tx.paymentMethod || '').toLowerCase().replace(/-/g, '_');
  if (method === 'gift_card' || method === 'mixed') return true;
  return (tx.paymentLines || []).some(
    (p) => String(p.method || '').toLowerCase().replace(/-/g, '_') === 'gift_card'
  );
}

/** Gift-card sell/reload cart lines on order receipts (not the barcode sale ticket). */
function isGiftCardMerchandiseItem(item: WebPosReceiptItem): boolean {
  const pid = String(item.productId || '');
  if (pid.startsWith('__gift_card_')) return true;
  const name = String(item.name || '').toLowerCase();
  return (
    name.includes('gift card') ||
    name.includes('e-gift') ||
    name.includes('carte cadeau')
  );
}

/**
 * Order/payment receipt VAT — merchandise tax for thermal / digital receipts.
 * VAT-included (CH/EU): TTC = bill total excl. tips & rounding; NET = TTC/(1+rate); TVA = TTC−NET.
 */
/** Totals block for the public digital receipt page (pay.chaslay.com/receipt/…). */
export function buildDigitalReceiptTotals(order: {
  items: Array<{
    name?: string | null;
    quantity?: number | string;
    unitPrice?: number | string;
    lineTotal: number | string;
  }>;
  subtotal: number | string;
  taxAmount: number | string;
  discountAmount?: number | string | null;
  tipAmount?: number | string | null;
  roundingAmount?: number | string | null;
  total: number | string;
  taxRate?: number;
  vatIncludedInPrice?: boolean;
  vatAfterDiscount?: boolean;
}): {
  net: number;
  tax: number;
  taxRate: number;
  discount: number;
  tip: number;
  rounding: number;
  total: number;
  grossMerchandise: number;
  vatIncluded: boolean;
  showVatBreakdown: boolean;
} {
  const subtotal = Number(order.subtotal) || 0;
  const taxAmount = Number(order.taxAmount) || 0;
  let taxRate = Number(order.taxRate) || 0;
  if (taxRate <= 0 && subtotal > 0 && taxAmount > 0) {
    taxRate = roundMoney2((taxAmount / subtotal) * 100);
  }
  const tx: WebPosReceipt = {
    businessName: '',
    id: '',
    completedAt: Date.now(),
    paymentMethod: 'cash',
    items: (order.items || []).map((i) => ({
      name: String(i.name || 'Item'),
      quantity: Number(i.quantity) || 1,
      unitPrice: Number(i.unitPrice) || 0,
      lineTotal: Number(i.lineTotal) || 0,
    })),
    subtotal,
    discount: Number(order.discountAmount) || 0,
    taxAmount,
    taxRate,
    rounding: Number(order.roundingAmount) || 0,
    tipAmount: Number(order.tipAmount) || 0,
    total: Number(order.total) || 0,
    vatIncludedInPrice: order.vatIncludedInPrice !== false,
    vatAfterDiscount: order.vatAfterDiscount !== false,
    showVat: true,
  };
  const vat = resolveOrderReceiptVat(tx);
  const vatIncluded = tx.vatIncludedInPrice !== false;
  const grossMerchandise = vatIncluded
    ? roundMoney2(vat.subtotal + vat.taxAmount)
    : roundMoney2(vat.subtotal);
  return {
    net: vat.subtotal,
    tax: vat.taxAmount,
    taxRate: vat.taxRate,
    discount: roundMoney2(tx.discount),
    tip: roundMoney2(tx.tipAmount || 0),
    rounding: roundMoney2(tx.rounding || 0),
    total: roundMoney2(tx.total),
    grossMerchandise,
    vatIncluded,
    showVatBreakdown: vat.taxRate > 0 && vat.taxAmount > 0,
  };
}

export function resolveOrderReceiptVat(tx: WebPosReceipt): {
  subtotal: number;
  taxAmount: number;
  taxRate: number;
} {
  const rate = Number(tx.taxRate) || 0;
  const vatIncluded = tx.vatIncludedInPrice !== false;

  if (rate <= 0) {
    return { subtotal: roundMoney2(tx.subtotal), taxAmount: 0, taxRate: rate };
  }

  if (vatIncluded) {
    const fromItems = merchandiseBrutAfterDiscount(tx);
    const fromBill = billMerchandiseTtc(tx);
    // Payable merchandise TTC is authoritative for guest receipts (remise, splits, sync).
    let brut = fromBill > 0 ? fromBill : fromItems;
    if (fromBill > 0 && fromItems > 0 && Math.abs(fromItems - fromBill) > 0.02) {
      brut = fromBill;
    }
    if (brut <= 0) {
      const adjusted = adjustReceiptVatForDiscount(tx.subtotal, tx.taxAmount, tx.discount || 0, {
        vatIncludedInPrice: true,
        vatAfterDiscount: tx.vatAfterDiscount,
      });
      brut = roundMoney2(adjusted.subtotal + adjusted.taxAmount);
    }
    const split = splitVatIncludedGross(brut, rate);
    return { subtotal: split.net, taxAmount: split.tax, taxRate: rate };
  }

  const adjusted = adjustReceiptVatForDiscount(tx.subtotal, tx.taxAmount, tx.discount || 0, {
    vatIncludedInPrice: false,
    vatAfterDiscount: tx.vatAfterDiscount,
  });
  return { subtotal: adjusted.subtotal, taxAmount: adjusted.taxAmount, taxRate: rate };
}

export function generateWebPosReceiptText(tx: WebPosReceipt, panelLang?: string): string {
  const width = lineWidthForPaper(tx.paperWidthMm);
  const lang = resolveLang(tx, panelLang);
  const L = receiptLabels(lang);
  const locale = lang === 'fr' ? 'fr-CH' : lang === 'de' ? 'de-CH' : 'en-CH';
  const sep = '='.repeat(width);
  const thin = '-'.repeat(width);

  let r = '';
  if (tx.isProvisional) {
    r += centerLine('PROVISIONAL', width) + '\n';
  }
  r += sep + '\n';
  if (tx.header?.trim()) {
    for (const line of tx.header.trim().split(/\r?\n/)) r += line.slice(0, width) + '\n';
  } else {
    r += (tx.businessName || APP_NAME).toUpperCase().slice(0, width) + '\n';
    if (tx.address) r += tx.address.slice(0, width) + '\n';
    if (tx.phone) r += `Tel: ${tx.phone}`.slice(0, width) + '\n';
    if (tx.vatNumber) r += `VAT: ${tx.vatNumber}`.slice(0, width) + '\n';
  }
  r += sep + '\n';
  if (tx.tableLabel) {
    r += `${L.table} ${tx.tableLabel}`;
    if (tx.guestCount) r += ` · ${tx.guestCount} ${L.pax}`;
    r += '\n';
  }
  const isDelivery = tx.channel === 'delivery';
  const isOnline = isExternalOnlineOrder(tx);
  const memberName = tx.memberName?.trim() || '';
  if (memberName) {
    r += `${L.member}: ${memberName}\n`;
  } else if ((isDelivery || isOnline) && tx.customerName?.trim()) {
    r += `${L.customer}: ${tx.customerName.trim()}\n`;
  }
  if (isDelivery || isOnline) {
    if (tx.customerPhone?.trim()) r += `Tel: ${tx.customerPhone.trim()}\n`;
  }
  if (isDelivery && tx.shippingAddress?.trim()) {
    r += `${L.deliveryAddress}:\n`;
    for (const line of tx.shippingAddress.trim().split(/\r?\n/)) {
      const chunk = line.trim();
      if (!chunk) continue;
      for (let i = 0; i < chunk.length; i += width) {
        r += chunk.slice(i, i + width) + '\n';
      }
    }
  }
  if (tx.splitLabel) r += `${tx.splitLabel}\n`;
  r += thin + '\n';

  // Guest receipt: no COURSE banners (those stay on kitchen tickets only).
  for (const item of tx.items) {
    for (const line of formatCustomerReceiptItemLines(item, width)) {
      r += line + '\n';
    }
  }

  r += thin + '\n';
  if (tx.discount > 0) {
    r += padLine(`${L.discount}:`, `-CHF ${tx.discount.toFixed(2)}`, width) + '\n';
  }
  const tip = roundMoney2(tx.tipAmount || 0);
  if (tip > 0) {
    r += padLine(`${L.tip}:`, `CHF ${tip.toFixed(2)}`, width) + '\n';
  }
  if (tx.rounding) {
    r +=
      padLine(
        `${L.rounding}:`,
        `${tx.rounding > 0 ? '+' : ''}CHF ${roundMoney2(tx.rounding).toFixed(2)}`,
        width
      ) + '\n';
  }
  r += sep + '\n';
  r += padLine(`${L.total}:`, `CHF ${tx.total.toFixed(2)}`, width) + '\n';
  const refundTotal = Number(tx.refundAmount || 0);
  const netPaid = Math.max(0, Number(tx.total || 0) - refundTotal);
  if (refundTotal > 0.001) {
    r += padLine('Refunded:', `-CHF ${refundTotal.toFixed(2)}`, width) + '\n';
    r += padLine('Net paid:', `CHF ${netPaid.toFixed(2)}`, width) + '\n';
    if (tx.refundReason?.trim()) {
      r += `${L.note} ${tx.refundReason.trim().slice(0, width)}\n`;
    }
  }
  r += sep + '\n';
  if (!tx.isProvisional) {
    const payMethodRaw = String(tx.paymentMethod || '');
    const isPayLater = /^pay[_-]?later/i.test(payMethodRaw);
    const tenders =
      tx.paymentLines && tx.paymentLines.length > 0
        ? tx.paymentLines
        : [{ method: tx.paymentMethod, amount: tx.total }];
    if (isPayLater) {
      r += `${L.payment}: ${formatPayLaterPaymentLabel(L, tx.payLaterTender || payMethodRaw)}\n`;
    } else if (tenders.length === 1) {
      r += `${L.payment}: ${paymentLabel(L, tenders[0]!.method)}\n`;
    } else {
      r += `${L.payment}:\n`;
      for (const p of tenders) {
        r +=
          padLine(
            `  ${paymentLabel(L, p.method)}`,
            `CHF ${roundMoney2(p.amount).toFixed(2)}`,
            width
          ) + '\n';
      }
    }
    const payLaterCollected =
      tx.payLaterCollected === true ||
      /pay[_-]?later[:_\s]+(cash|card|terminal)/i.test(payMethodRaw);
    if (!isPayLater || payLaterCollected) {
      r += padLine(`${L.paid}:`, `CHF ${netPaid.toFixed(2)}`, width) + '\n';
    }
    if (
      (!isPayLater || payLaterCollected) &&
      tx.amountTendered != null &&
      tx.amountTendered > 0 &&
      roundMoney2(tx.amountTendered) !== roundMoney2(tx.total)
    ) {
      r +=
        padLine(
          `${L.tendered}:`,
          `CHF ${roundMoney2(tx.amountTendered).toFixed(2)}`,
          width
        ) + '\n';
    }
    if (tx.changeDue != null && tx.changeDue > 0) {
      r +=
        padLine(`${L.change}:`, `CHF ${roundMoney2(tx.changeDue).toFixed(2)}`, width) + '\n';
    }
    if (
      hasGiftCardPayment(tx) &&
      tx.giftCardRemainingBalance != null &&
      Number.isFinite(tx.giftCardRemainingBalance)
    ) {
      r +=
        padLine(
          `${L.giftCardRemainingBalance}:`,
          `CHF ${roundMoney2(tx.giftCardRemainingBalance).toFixed(2)}`,
          width
        ) + '\n';
    }
    const loyaltyBlock = formatLoyaltyReceiptLines(tx, L, width);
    if (loyaltyBlock) r += loyaltyBlock;
  }
  // VAT calculations below payment section (includes gift-card sell/reload lines)
  const vatTotals = resolveOrderReceiptVat(tx);
  const vatSection = formatVatSection({ ...tx, ...vatTotals }, L, width);
  if (vatSection) {
    r += vatSection + '\n';
  }
  if (tx.notes) r += `${L.note} ${tx.notes}\n`;

  // QR label + graphic embedded by buildReceiptEscPos (digital receipt only).
  const hasDigitalQr = tx.includeQr !== false && !!(tx.receiptUrl || tx.id);
  if (hasDigitalQr) {
    r += thin + '\n';
  }

  r += formatReceiptMetaFooter(tx, L, locale, width) + '\n';
  r += guestReceiptFooterLines(tx.footer, tx.businessName, L.thankYou).trim() + '\n';
  if (tx.printAdyenReceiptOnTicket !== false) {
    r = appendAdyenReceiptBlock(r, tx.adyenCustomerReceipt, width);
  }
  r += '\n\n';
  return r;
}

export type RefundReceiptPrint = {
  businessName: string;
  address?: string;
  phone?: string;
  orderNumber?: string | null;
  orderDisplay?: string | null;
  refundedAt: number;
  refundAmount: number;
  refundTotal: number;
  reason: string;
  allocation?: {
    giftCard?: number;
    cash?: number;
    terminal?: number;
    other?: number;
  };
  language?: ReceiptLang | string;
  paperWidthMm?: 58 | 80;
  header?: string;
  footer?: string;
  staffName?: string | null;
};

/** Proof-of-refund thermal receipt for the customer after a refund. */
export function generateRefundReceiptText(tx: RefundReceiptPrint, panelLang?: string): string {
  const width = lineWidthForPaper(tx.paperWidthMm);
  const code = String(tx.language || panelLang || 'en').toLowerCase().slice(0, 2);
  const lang: ReceiptLang = code === 'fr' || code === 'de' ? code : 'en';
  const L = receiptLabels(lang);
  const sep = '='.repeat(width);
  const thin = '-'.repeat(width);

  let r = '';
  r += sep + '\n';
  r += centerLine('REFUND', width) + '\n';
  r += centerLine((tx.businessName || APP_NAME).toUpperCase().slice(0, width), width) + '\n';
  if (tx.address) r += tx.address.slice(0, width) + '\n';
  r += sep + '\n';
  const ref = guestReceiptBottomNumber(tx);
  if (ref) r += padLine('Order:', ref.slice(0, width - 8), width) + '\n';
  r += padLine('Date:', formatDateTimeDDMMYYYY(tx.refundedAt).slice(0, width - 8), width) + '\n';
  r += thin + '\n';
  r += padLine('Refunded:', `CHF ${Number(tx.refundAmount || 0).toFixed(2)}`, width) + '\n';
  if (tx.refundTotal > tx.refundAmount + 0.001) {
    r += padLine('Total refunded:', `CHF ${Number(tx.refundTotal || 0).toFixed(2)}`, width) + '\n';
  }
  const alloc = tx.allocation;
  if (alloc && (alloc.giftCard || alloc.cash || alloc.terminal || alloc.other)) {
    r += thin + '\n';
    if ((alloc.giftCard || 0) > 0.001) {
      r += padLine('  Gift card:', `CHF ${Number(alloc.giftCard).toFixed(2)}`, width) + '\n';
    }
    if ((alloc.cash || 0) > 0.001) {
      r += padLine('  Cash:', `CHF ${Number(alloc.cash).toFixed(2)}`, width) + '\n';
    }
    if ((alloc.terminal || 0) > 0.001) {
      r += padLine('  Terminal:', `CHF ${Number(alloc.terminal).toFixed(2)}`, width) + '\n';
    }
  }
  r += thin + '\n';
  r += `${L.note} ${tx.reason.slice(0, width)}\n`;
  if (tx.staffName?.trim()) {
    r += padLine(L.staff, tx.staffName.trim().slice(0, width - 8), width) + '\n';
  }
  r += sep + '\n';
  r += guestReceiptFooterLines(tx.footer, tx.businessName, L.thankYou).trim() + '\n\n\n';
  return r;
}

export type KitchenTicketItem = WebPosReceiptItem & {
  courseNumber?: number | null;
  /** One indented line per modifier/extra (non-combo or combo-level extras). */
  modifierLines?: string[];
  /** Combo slot picks printed under the parent product name. */
  comboLines?: KitchenComboLine[];
  /** Per-line kitchen note from modifier modal. */
  lineNote?: string;
};

/** Build structured kitchen ticket line from cart / order data. */
export function buildKitchenTicketItemFromLine(input: {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  weightKg?: number | null;
  productId?: string | null;
  categoryId?: string | null;
  courseNumber?: number | null;
  selectedExtras?: Array<{ name?: string | null }>;
  comboSelections?: Array<{
    slotName?: string | null;
    productName?: string | null;
    selectedExtras?: Array<{ name?: string | null }>;
  }>;
  lineNote?: string | null;
}): KitchenTicketItem {
  const comboLines: KitchenComboLine[] = (input.comboSelections || []).map((c) => ({
    slotName: c.slotName?.trim() || undefined,
    productName: String(c.productName || '').trim(),
    modifierLines: (c.selectedExtras || [])
      .map((e) => String(e.name || '').trim())
      .filter(Boolean),
  }));
  const comboLevelExtras =
    comboLines.length > 0
      ? (input.selectedExtras || [])
          .map((e) => String(e.name || '').trim())
          .filter(Boolean)
      : (input.selectedExtras || [])
          .map((e) => String(e.name || '').trim())
          .filter(Boolean);
  return {
    name: String(input.name || '').trim(),
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    lineTotal: input.lineTotal,
    weightKg: input.weightKg,
    productId: input.productId,
    categoryId: input.categoryId,
    courseNumber: input.courseNumber,
    modifierLines: comboLevelExtras.length ? comboLevelExtras : undefined,
    comboLines: comboLines.length ? comboLines : undefined,
    lineNote: input.lineNote?.trim() || undefined,
  };
}

export type KitchenTicketOpts = {
  channel?: string;
  items: KitchenTicketItem[];
  language?: string;
  paperWidthMm?: 58 | 80;
  /** Short shout number printed under KITCHEN, e.g. #47 */
  orderNumber?: string | null;
  /** When the order was placed */
  orderedAt?: number;
  /** Pickup / delivery scheduled time (ISO, datetime-local, or epoch). Null/omit = ASAP */
  scheduledFor?: string | number | null;
  /** Delivery address (online shop / delivery orders) */
  shippingAddress?: string | null;
  /** Customer phone for delivery tickets */
  customerPhone?: string | null;
  /** Staff or customer name at footer */
  userName?: string | null;
  /** Origin of the order / print */
  orderSource?: KitchenOrderSource | string | null;
  itemTextScale?: 1 | 2 | 3;
  headerTextScale?: 1 | 2 | 3;
  boldText?: boolean;
  /** Print COURSE N headers when items have courseNumber and multiple services are active */
  groupByCourse?: boolean;
  /** Highest opened course (1 = single service — no course banners on ticket) */
  maxCourse?: number;
  tableLabel?: string | null;
  /** Bar tab number (shown on ticket after tab is assigned). */
  tabNumber?: string | null;
  /** Void ticket: title CANCELLED + strikethrough item lines */
  cancelled?: boolean;
  cancelReason?: string | null;
  /** Items routed to another kitchen printer (cross-station footer). */
  otherStationItems?: KitchenTicketItem[];
  otherStationLabel?: string | null;
};

export type KitchenMessageTicketOpts = {
  message: string;
  language?: string;
  paperWidthMm?: 58 | 80;
  orderNumber?: string | null;
  tableLabel?: string | null;
  tabNumber?: string | null;
  userName?: string | null;
  orderedAt?: number;
  orderSource?: KitchenOrderSource | string | null;
};

/** Unicode combining long stroke for text/preview strikethrough. */
export function strikethroughText(text: string): string {
  return [...text].map((ch) => (ch === '\n' ? ch : `${ch}\u0336`)).join('');
}

/** CP850-safe visual strikethrough for thermal printers. */
export function strikethroughEscPosLabel(text: string): string {
  const trimmed = text.trim();
  return trimmed ? `- ${trimmed} -` : trimmed;
}

/** e.g. "TAKEAWAY : ASAP" or "TAKEAWAY : 17:00" */
function formatChannelWhen(
  L: ReturnType<typeof receiptLabels>,
  channel: string | undefined,
  scheduledFor?: string | number | null
): string {
  const ch = channelLabel(L, channel);
  const when = formatKitchenWhen(scheduledFor);
  return `${ch} : ${when || L.asap}`;
}

function kitchenItemCount(items: WebPosReceiptItem[]): number {
  return items.reduce((s, i) => {
    if (i.weightKg != null && i.weightKg > 0) return s + 1;
    return s + (Number(i.quantity) || 0);
  }, 0);
}

function formatKitchenChannelWhenLines(
  L: ReturnType<typeof receiptLabels>,
  channel: string | undefined,
  scheduledFor: string | number | null | undefined,
  tableLabel: string | null | undefined,
  width: number
): string[] {
  const channelWhen = formatChannelWhen(L, channel, scheduledFor);
  const table = String(tableLabel || '').trim();
  if (table) {
    return [padLine(channelWhen, table, width)];
  }
  return wrapKitchenWords(channelWhen, width);
}

type KitchenLine = {
  kind: 'center' | 'header' | 'item' | 'extra' | 'note' | 'normal' | 'strike';
  /** Line body without trailing newlines (ESC/POS adds LF bytes explicitly). */
  text: string;
  /** Extra blank lines after this row (kitchen readability). */
  blankAfter?: number;
};

/** Columns available when GS ! enlarges text (scale 3 = double width). */
function kitchenColsForScale(paperWidthMm: number | undefined, scale: 1 | 2 | 3): number {
  const base = lineWidthForPaper(paperWidthMm ?? 80);
  return scale === 3 ? Math.max(16, Math.floor(base / 2)) : base;
}

function wrapKitchenWords(text: string, width: number): string[] {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= width) return [clean];
  const words = clean.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const word of words) {
    if (!word) continue;
    if (word.length > width) {
      if (cur) {
        out.push(cur);
        cur = '';
      }
      for (let i = 0; i < word.length; i += width) {
        out.push(word.slice(i, i + width));
      }
      continue;
    }
    const next = cur ? `${cur} ${word}` : word;
    if (next.length <= width) {
      cur = next;
    } else {
      if (cur) out.push(cur);
      cur = word;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function formatKitchenItemLines(
  item: KitchenTicketItem,
  width: number,
  cancelled: boolean,
  forEscPos: boolean
): KitchenLine[] {
  const qtyPrefix = formatQtyArticlePrefix(item);
  const { product, modifiers: modifierLines } = splitReceiptArticle(
    item.name,
    item.modifierLines
  );
  const comboLines = (item.comboLines || []).filter((c) => c.productName?.trim());
  const lineNote = String(item.lineNote || '').trim();
  const extraWidth = Math.max(8, width - qtyPrefix.length);
  const qty = qtyPrefix.trimEnd();
  const primary = `${qtyPrefix}${product}`.trim();
  const wrappedPrimary = wrapKitchenWords(primary, width);
  const lines: KitchenLine[] = [];

  const pushLine = (kind: KitchenLine['kind'], text: string, blankAfter = 0) => {
    if (!cancelled) {
      lines.push({ kind, text, blankAfter });
      return;
    }
    if (forEscPos) {
      lines.push({
        kind: 'strike',
        text: strikethroughEscPosLabel(text).slice(0, width),
        blankAfter,
      });
    } else {
      lines.push({ kind: 'strike', text: strikethroughText(text), blankAfter });
    }
  };

  const pushExtra = (text: string, blankAfter = 0) => pushLine('extra', text, blankAfter);
  const pushItem = (text: string, blankAfter = 0) => pushLine('item', text, blankAfter);
  const pushNote = (text: string, blankAfter = 0) => pushLine('note', text, blankAfter);

  if (wrappedPrimary.length) {
    wrappedPrimary.forEach((w, i) => {
      const last =
        i === wrappedPrimary.length - 1 &&
        !comboLines.length &&
        !modifierLines.length &&
        !lineNote;
      pushItem(w, last ? 1 : 0);
    });
  } else {
    pushItem(qty, comboLines.length || modifierLines.length || lineNote ? 0 : 1);
  }

  const pushDashed = (text: string, blankAfter = 0) => {
    const line = formatReceiptExtraLine(qtyPrefix, text);
    if (line.length <= width) {
      pushExtra(line, blankAfter);
      return;
    }
    const dashPrefix = `${extraIndent(qtyPrefix)}- `;
    const wrapped = wrapKitchenWords(stripLeadingDash(text), Math.max(8, width - dashPrefix.length));
    wrapped.forEach((w, i) => {
      const row = i === 0 ? `${dashPrefix}${w}` : `${extraIndent(qtyPrefix)}  ${w}`;
      pushExtra(row, i === wrapped.length - 1 ? blankAfter : 0);
    });
  };

  for (const combo of comboLines) {
    const slotLabel = combo.slotName?.trim();
    const pickName = combo.productName.trim();
    const head = slotLabel ? `${slotLabel}: ${pickName}` : pickName;
    pushDashed(head);
    for (const mod of combo.modifierLines || []) {
      const text = stripLeadingDash(mod);
      if (text) pushDashed(text);
    }
  }

  if (modifierLines.length) {
    modifierLines.forEach((mod) => pushDashed(mod));
  }

  if (lineNote) {
    const noteText = forEscPos ? `*${lineNote}*` : `_${lineNote}_`;
    const notePrefix = extraIndent(qtyPrefix);
    for (const w of wrapKitchenWords(noteText, extraWidth)) {
      pushNote(`${notePrefix}${w}`, 1);
    }
  } else if (lines.length && (lines[lines.length - 1]?.blankAfter || 0) === 0) {
    lines[lines.length - 1] = { ...lines[lines.length - 1]!, blankAfter: 1 };
  }

  return lines;
}

function kitchenTextScaleOrDefault(scale: 1 | 2 | 3 | undefined): 1 | 2 | 3 {
  return scale === 1 || scale === 2 || scale === 3 ? scale : 1;
}

function buildKitchenTicketLines(
  opts: KitchenTicketOpts,
  forEscPos = false
): {
  width: number;
  L: ReturnType<typeof receiptLabels>;
  lines: KitchenLine[];
} {
  const headerScale = kitchenTextScaleOrDefault(opts.headerTextScale);
  const itemScale = kitchenTextScaleOrDefault(opts.itemTextScale);
  const headerWidth = kitchenColsForScale(opts.paperWidthMm, headerScale);
  const itemWidth = kitchenColsForScale(opts.paperWidthMm, itemScale);
  const footWidth = lineWidthForPaper(opts.paperWidthMm ?? 80);
  const L = receiptLabels(opts.language);
  const thin = '-'.repeat(footWidth);
  const orderedAt = new Date(opts.orderedAt || Date.now());
  const timeStr = orderedAt.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich',
  });
  const totalQty = kitchenItemCount(opts.items);
  const user = (opts.userName || '').trim() || '-';
  const source = String(opts.orderSource || 'WEBPOS').trim().toUpperCase() || 'WEBPOS';
  const ticketNo = (opts.orderNumber || '-').trim();
  const cancelled = !!opts.cancelled;
  const title = cancelled ? L.cancelledTicket : L.kitchen;

  // Center via ESC a — do not space-pad (padding + large font caused smashed headers).
  const lines: KitchenLine[] = [
    { kind: 'center', text: title },
    { kind: 'center', text: ticketNo },
  ];
  for (const w of formatKitchenChannelWhenLines(
    L,
    opts.channel,
    opts.scheduledFor,
    opts.tableLabel,
    headerWidth
  )) {
    lines.push({ kind: 'header', text: w });
  }
  if (opts.channel === 'delivery' && opts.shippingAddress?.trim()) {
    for (const w of wrapKitchenWords(
      `${L.deliveryAddress}: ${opts.shippingAddress.trim()}`,
      headerWidth
    )) {
      lines.push({ kind: 'header', text: w });
    }
  }
  if (opts.customerPhone?.trim()) {
    for (const w of wrapKitchenWords(`Tel: ${opts.customerPhone.trim()}`, footWidth)) {
      lines.push({ kind: 'normal', text: w });
    }
  }
  lines.push({ kind: 'normal', text: thin });

  if (cancelled && opts.cancelReason) {
    for (const w of wrapKitchenWords(String(opts.cancelReason), footWidth)) {
      lines.push({ kind: 'normal', text: w });
    }
    lines.push({ kind: 'normal', text: thin });
  }

  const items = opts.items;
  const maxCourse = Math.max(1, Number(opts.maxCourse) || 1);
  const hasCourses =
    !cancelled &&
    !!opts.groupByCourse &&
    maxCourse > 1 &&
    items.some((i) => i.courseNumber != null && Number(i.courseNumber) > 0);

  if (hasCourses) {
    for (const group of groupReceiptItemsByCourse(items)) {
      if (group.course != null) {
        lines.push({
          kind: 'center',
          text: formatCourseBanner(group.course, L.courseLabel),
          blankAfter: 0,
        });
      }
      for (const item of group.items) {
        lines.push(...formatKitchenItemLines(item, itemWidth, cancelled, forEscPos));
      }
    }
  } else {
    for (const item of items) {
      lines.push(...formatKitchenItemLines(item, itemWidth, cancelled, forEscPos));
    }
  }

  if (opts.otherStationItems?.length) {
    lines.push({ kind: 'normal', text: thin });
    lines.push({
      kind: 'center',
      text: (opts.otherStationLabel || '>>> OTHER STATION <<<').slice(0, footWidth),
    });
    for (const item of opts.otherStationItems) {
      lines.push(...formatKitchenItemLines(item, itemWidth, false, forEscPos));
    }
  }

  lines.push({ kind: 'normal', text: thin });
  lines.push({ kind: 'normal', text: `${L.totalItems}: ${totalQty}` });
  lines.push({ kind: 'normal', text: thin });
  lines.push({ kind: 'normal', text: `${user}, ${timeStr} | ${source}`, blankAfter: 3 });

  return { width: footWidth, L, lines };
}

/** Plain-text kitchen ticket (fallback / preview). */
export function generateKitchenTicketText(opts: KitchenTicketOpts): string {
  const { width, lines } = buildKitchenTicketLines(opts, false);
  return lines
    .map((l) => {
      const text = l.kind === 'center' ? centerLine(l.text.trim(), width) : l.text;
      return `${text}\n${'\n'.repeat(l.blankAfter || 0)}`;
    })
    .join('');
}

function escKitchenSize(scale: 1 | 2 | 3): Uint8Array {
  // GS ! n - 0 normal, 0x01 double height, 0x11 double width+height
  const n = scale === 3 ? 0x11 : scale === 2 ? 0x01 : 0x00;
  return new Uint8Array([0x1d, 0x21, n]);
}

function escBold(on: boolean): Uint8Array {
  return new Uint8Array([0x1b, 0x45, on ? 1 : 0]);
}

function escAlign(mode: 0 | 1 | 2): Uint8Array {
  return new Uint8Array([0x1b, 0x61, mode]);
}

/** ESC/POS underline (closest hardware strikethrough on most thermal printers). */
function escUnderline(on: boolean): Uint8Array {
  return new Uint8Array([0x1b, 0x2d, on ? 1 : 0]);
}

/** Kitchen ticket as ESC/POS (default scale 1 = plain normal-height text). */
export function generateKitchenTicketEscPos(opts: KitchenTicketOpts): Uint8Array {
  const { lines } = buildKitchenTicketLines(opts, true);
  const headerScale = kitchenTextScaleOrDefault(opts.headerTextScale);
  const itemScale = kitchenTextScaleOrDefault(opts.itemTextScale);
  const bold = opts.boldText === true;
  const parts: Uint8Array[] = [new Uint8Array([0x1b, 0x40]), ESC_CODEPAGE_CP850];
  const lf = new Uint8Array([0x0a]);
  const feedLine = (blankAfter = 0) => {
    parts.push(lf);
    for (let i = 0; i < blankAfter; i++) parts.push(lf);
  };
  const resetSize = () => {
    parts.push(escKitchenSize(1), escBold(false), escUnderline(false), escAlign(0));
  };
  const body = (text: string) =>
    escposCp850Encode(String(text || '').replace(/[\r\n]+/g, ' ').trimEnd());

  for (const line of lines) {
    if (line.kind === 'center') {
      parts.push(
        escAlign(1),
        escKitchenSize(headerScale),
        escBold(bold || headerScale > 1),
        escUnderline(false),
        body(line.text)
      );
      feedLine(line.blankAfter);
      resetSize();
    } else if (line.kind === 'header') {
      parts.push(
        escAlign(0),
        escKitchenSize(headerScale),
        escBold(bold || headerScale > 1),
        escUnderline(false),
        body(line.text)
      );
      feedLine(line.blankAfter);
      resetSize();
    } else if (line.kind === 'strike') {
      parts.push(
        escAlign(0),
        escKitchenSize(itemScale),
        escBold(true),
        escUnderline(true),
        body(line.text),
        escUnderline(false)
      );
      feedLine(line.blankAfter);
      resetSize();
    } else if (line.kind === 'item') {
      parts.push(
        escAlign(0),
        escKitchenSize(itemScale),
        escBold(bold || itemScale > 1),
        escUnderline(false),
        body(line.text)
      );
      feedLine(line.blankAfter);
      resetSize();
    } else if (line.kind === 'extra') {
      parts.push(
        escAlign(0),
        escKitchenSize(1),
        escBold(false),
        escUnderline(false),
        body(line.text)
      );
      feedLine(line.blankAfter);
      resetSize();
    } else if (line.kind === 'note') {
      parts.push(
        escAlign(0),
        escKitchenSize(1),
        escBold(false),
        escUnderline(true),
        body(line.text),
        escUnderline(false)
      );
      feedLine(line.blankAfter);
      resetSize();
    } else {
      parts.push(
        escAlign(0),
        escKitchenSize(1),
        escBold(false),
        escUnderline(false),
        body(line.text)
      );
      feedLine(line.blankAfter);
    }
  }

  parts.push(
    escAlign(0),
    escKitchenSize(1),
    escBold(false),
    escUnderline(false),
    new Uint8Array([0x1b, 0x64, 0x04]),
    new Uint8Array([0x1d, 0x56, 0x41, 0x10])
  );
  return concatBytes(...parts);
}

function buildKitchenMessageTicketLines(
  opts: KitchenMessageTicketOpts
): { width: number; L: ReturnType<typeof receiptLabels>; lines: KitchenLine[] } {
  const paperWidthMm = opts.paperWidthMm ?? 80;
  const width = lineWidthForPaper(paperWidthMm ?? 80);
  const L = receiptLabels(opts.language);
  const thin = '-'.repeat(width);
  const orderedAt = new Date(opts.orderedAt || Date.now());
  const timeStr = orderedAt.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich',
  });
  const user = (opts.userName || '').trim() || '-';
  const source = String(opts.orderSource || 'WEBPOS').trim().toUpperCase() || 'WEBPOS';
  const ticketNo = (opts.orderNumber || '-').trim();

  const lines: KitchenLine[] = [
    { kind: 'center', text: 'KITCHEN MESSAGE' },
  ];
  if (ticketNo && ticketNo !== '-') {
    lines.push({ kind: 'center', text: ticketNo });
  }
  lines.push({ kind: 'normal', text: thin });
  if (opts.tableLabel) {
    for (const w of wrapKitchenWords(`TABLE ${opts.tableLabel}`, width)) {
      lines.push({ kind: 'header', text: w });
    }
  }
  const msg = String(opts.message || '').replace(/\s+/g, ' ').trim();
  for (const w of wrapKitchenWords(msg, width)) {
    lines.push({ kind: 'item', text: w, blankAfter: 0 });
  }
  lines.push({ kind: 'normal', text: thin });
  lines.push({
    kind: 'normal',
    text: `${user}, ${timeStr} | ${source}`,
    blankAfter: 3,
  });
  return { width, L, lines };
}

/** Plain-text kitchen message ticket (no qty prefix). */
export function generateKitchenMessageTicketText(opts: KitchenMessageTicketOpts): string {
  return buildKitchenMessageTicketLines(opts)
    .lines.map((l) => `${l.text}\n${'\n'.repeat(l.blankAfter || 0)}`)
    .join('');
}

/** ESC/POS kitchen message ticket — message body only, no "1x" prefix. */
export function generateKitchenMessageTicketEscPos(opts: KitchenMessageTicketOpts): Uint8Array {
  const headerScale = 2 as 1 | 2 | 3;
  const itemScale = 2 as 1 | 2 | 3;
  const { lines } = buildKitchenMessageTicketLines(opts);
  const parts: Uint8Array[] = [new Uint8Array([0x1b, 0x40]), ESC_CODEPAGE_CP850];
  const lf = new Uint8Array([0x0a]);
  const feedLine = (blankAfter = 0) => {
    parts.push(lf);
    for (let i = 0; i < blankAfter; i++) parts.push(lf);
  };
  const resetSize = () => {
    parts.push(escKitchenSize(1), escBold(false), escUnderline(false), escAlign(0));
  };
  const body = (text: string) =>
    escposCp850Encode(String(text || '').replace(/[\r\n]+/g, ' ').trimEnd());

  for (const line of lines) {
    if (line.kind === 'center') {
      parts.push(
        escAlign(1),
        escKitchenSize(headerScale),
        escBold(true),
        escUnderline(false),
        body(line.text)
      );
      feedLine(line.blankAfter);
      resetSize();
    } else if (line.kind === 'header' || line.kind === 'item') {
      parts.push(
        escAlign(0),
        escKitchenSize(itemScale),
        escBold(true),
        escUnderline(false),
        body(line.text)
      );
      feedLine(line.blankAfter);
      resetSize();
    } else {
      parts.push(escAlign(0), escKitchenSize(1), escBold(false), escUnderline(false), body(line.text));
      feedLine(line.blankAfter);
    }
  }

  parts.push(
    escAlign(0),
    escKitchenSize(1),
    escBold(false),
    escUnderline(false),
    new Uint8Array([0x1b, 0x64, 0x04]),
    new Uint8Array([0x1d, 0x56, 0x41, 0x10])
  );
  return concatBytes(...parts);
}

export type EodVatRow = {
  label: string;
  net: number;
  tva: number;
  brut: number;
};

export type EodCashMovement = {
  type: 'in' | 'out' | string;
  amount: number;
  reason?: string | null;
  staffName?: string | null;
  createdAt?: string | null;
};

/** Cash drawer reconciliation for a closed (or closing) shift. */
export type EodShiftCash = {
  openingFloat: number;
  cashSales: number;
  cashIn?: number;
  cashOut?: number;
  cashRefunds?: number;
  movements?: EodCashMovement[];
  expectedCash: number;
  closingCashCounted?: number | null;
  variance?: number | null;
  staffName?: string | null;
};

const EOD_INCLUDE_PRODUCTS_KEY = 'chaslay_eod_include_products_sold';

/** Persisted preference: include product breakdown on EOD thermal print (default OFF — short report). */
export function readEodIncludeProductsSold(): boolean {
  try {
    const v = localStorage.getItem(EOD_INCLUDE_PRODUCTS_KEY);
    if (v === '1' || v === 'true') return true;
    return false;
  } catch {
    return false;
  }
}

export function writeEodIncludeProductsSold(include: boolean): void {
  try {
    localStorage.setItem(EOD_INCLUDE_PRODUCTS_KEY, include ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export type EodReportPrint = {
  label: string;
  periodFrom?: string;
  periodTo?: string;
  /** When set, print shows this is one employee's sales (not company totals). */
  scopeStaffName?: string | null;
  /** Thermal title: whole-day EOD vs single shift. Default 'eod'. */
  reportKind?: 'eod' | 'shift';
  salesCount: number;
  revenue: number;
  subtotal?: number;
  taxTotal: number;
  netTotal?: number;
  tipsTotal?: number;
  grandTotal?: number;
  refundTotal: number;
  refundCount?: number;
  refundedOrders?: Array<{
    orderNumber: string;
    refundAmount: number;
    refundReason?: string | null;
  }>;
  refundRows?: Array<{ method: string; total: number }>;
  cancelledCount: number;
  cancelledTotal: number;
  cashTotal: number;
  cardTotal: number;
  terminalTotal: number;
  coversServed?: number | null;
  vatRows?: EodVatRow[];
  productsSold: Array<{ name: string; quantity: number; total: number }>;
  /** When false, omit products-sold section from thermal print (totals unchanged). Default true. */
  includeProductsSold?: boolean;
  paymentRows: Array<{ method: string; count: number; total: number; percent?: number }>;
  orderTypeRows?: Array<{ label: string; count: number; total: number; percent?: number }>;
  channelRows?: Array<{ channel: string; count: number; total: number }>;
  /** Opening float / fond de base + drawer reconciliation (one or more shifts). */
  shiftCash?: EodShiftCash | EodShiftCash[];
  businessName?: string;
  language?: string;
  /** Default 80mm to match Android LINE_WIDTH_80 */
  paperWidthMm?: 58 | 80;
  header?: string;
  footer?: string;
};

function vatCols(
  type: string,
  net: string,
  tva: string,
  brut: string,
  width: number
): string {
  const compact = width <= 32;
  if (compact) {
    const t = type.slice(0, 8).padEnd(8);
    return `${t}${net.padStart(7)}${tva.padStart(7)}${brut.padStart(7)}`.slice(0, width);
  }
  const t = type.slice(0, 14).padEnd(14);
  const n = net.padStart(10);
  const v = tva.padStart(10);
  const b = brut.padStart(10);
  return `${t}${n}${v}${b}`.slice(0, width);
}

/** Android-parity 80mm EOD layout. Plain text only (no ESC/POS bold). */
export function generateEodReportText(report: EodReportPrint): string {
  const width = lineWidthForPaper(report.paperWidthMm ?? 80);
  const L = receiptLabels(report.language);
  const sep = '='.repeat(width);
  const thin = '-'.repeat(width);
  const money = (n: number) => `CHF ${Number(n || 0).toFixed(2)}`;
  const debitMoney = (n: number) =>
    Number(n) > 0.001 ? `-${money(n)}` : money(n);
  const two = (n: number) => Number(n || 0).toFixed(2);
  const tips = Number(report.tipsTotal || 0);
  const brut = Number(report.revenue || 0);
  const grand = Number(report.grandTotal != null ? report.grandTotal : brut + tips);
  const period = report.label?.trim()
    ? report.label
    : report.periodFrom && report.periodTo
      ? `${report.periodFrom} to ${report.periodTo}`
      : report.label || '';

  let r = '';
  r += sep + '\n';
  if (report.businessName) {
    r += centerLine(report.businessName.toUpperCase().slice(0, width), width) + '\n';
  }
  r += sep + '\n';
  r += '\n';
  const reportTitle = report.reportKind === 'shift' ? L.endOfShift : L.endOfDay;
  r += centerLine(reportTitle, width) + '\n';
  if (report.scopeStaffName?.trim()) {
    r +=
      centerLine(
        `${L.mySales || 'My sales'}: ${report.scopeStaffName.trim()}`.slice(0, width),
        width
      ) + '\n';
  }
  r += '\n';
  r += centerLine(L.reportPeriod, width) + '\n';
  r += centerLine(period.slice(0, width), width) + '\n';
  r += '\n';
  r += thin + '\n';
  r += centerLine(L.salesSummary, width) + '\n';
  r += thin + '\n';
  r += padLine(L.subtotal, money(report.subtotal ?? brut), width) + '\n';
  r += '\n';
  r += centerLine(L.tva, width) + '\n';
  r += vatCols(L.type, L.net, L.tva, L.brut, width) + '\n';
  const vatRows = report.vatRows?.length
    ? report.vatRows
    : [
        {
          label: 'Total',
          net: Number(report.netTotal ?? brut - report.taxTotal),
          tva: report.taxTotal,
          brut,
        },
      ];
  for (const row of vatRows) {
    r += vatCols(row.label, two(row.net), two(row.tva), two(row.brut), width) + '\n';
  }
  if (report.vatRows?.length) {
    r +=
      vatCols(
        'Total',
        two(report.netTotal ?? brut - report.taxTotal),
        two(report.taxTotal),
        two(brut),
        width
      ) + '\n';
  }
  r += thin + '\n';
  // Taxable net sales never include tips (tips are not taxable).
  r += padLine(L.netSalesExclTips, money(brut), width) + '\n';
  r += padLine(L.tipsNotTaxable, money(tips), width) + '\n';
  r += padLine(L.grandTotal, money(grand), width) + '\n';
  r += padLine(L.orders, String(report.salesCount), width) + '\n';
  if (report.coversServed) {
    r += padLine(L.guestsServed, String(report.coversServed), width) + '\n';
  }
  if (report.cancelledCount > 0 || report.cancelledTotal > 0) {
    r +=
      padLine(
        `${L.cancelled} (${report.cancelledCount})`,
        debitMoney(report.cancelledTotal),
        width
      ) + '\n';
  }
  if (report.refundTotal > 0.001 || (report.refundCount ?? 0) > 0) {
    const refundLabel =
      (report.refundCount ?? 0) > 0
        ? `${L.refunds} (${report.refundCount})`
        : L.refunds;
    r += padLine(refundLabel, debitMoney(report.refundTotal), width) + '\n';
  }
  r += '\n';
  r += thin + '\n';
  r += centerLine(L.paymentMethods, width) + '\n';
  r += thin + '\n';
  for (const p of report.paymentRows) {
    const pct =
      p.percent != null ? `${p.percent.toFixed(1)}%` : `${p.count}`;
    r +=
      padLine(
        `${paymentLabel(L, p.method)} ${pct}`,
        money(p.total),
        width
      ) + '\n';
  }
  r += thin + '\n';
  r +=
    padLine(
      L.total,
      money(report.paymentRows.reduce((s, p) => s + p.total, 0)),
      width
    ) + '\n';
  r += '\n';

  const orderTypes =
    report.orderTypeRows ||
    (report.channelRows || []).map((c) => ({
      label: channelLabel(L, c.channel),
      count: c.count,
      total: c.total,
      percent: undefined as number | undefined,
    }));
  if (orderTypes.length) {
    r += thin + '\n';
    r += centerLine(L.orderTypes, width) + '\n';
    r += thin + '\n';
    for (const o of orderTypes) {
      const meta = o.percent != null ? `${o.percent.toFixed(1)}%` : String(o.count);
      r += padLine(`${o.label} ${o.count} ${meta}`, money(o.total), width) + '\n';
    }
    r += thin + '\n';
    r +=
      padLine(
        L.total,
        money(orderTypes.reduce((s, o) => s + o.total, 0)),
        width
      ) + '\n';
  }

  const includeProductsSold = report.includeProductsSold !== false;
  if (includeProductsSold && report.productsSold.length) {
    r += '\n';
    r += thin + '\n';
    r += centerLine(L.productsSold, width) + '\n';
    r += thin + '\n';
    const qtySum = report.productsSold.reduce((s, p) => s + p.quantity, 0);
    r += padLine(L.totalQty, String(Math.round(qtySum * 1000) / 1000), width) + '\n';
    for (const p of report.productsSold.slice(0, 60)) {
      r += reportNameQtyRow(p.name, p.quantity, width) + '\n';
    }
  }

  const shiftRows =
    report.reportKind === 'shift' && report.shiftCash
      ? Array.isArray(report.shiftCash)
        ? report.shiftCash
        : [report.shiftCash]
      : [];
  if (shiftRows.length) {
    r += '\n';
    r += thin + '\n';
    r += centerLine(L.cashDrawer, width) + '\n';
    r += thin + '\n';
    const movementTime = (iso?: string | null) => {
      if (!iso) return '';
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return '';
      try {
        return d.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: 'Europe/Zurich',
        });
      } catch {
        return '';
      }
    };
    const movementLeft = (m: EodCashMovement) => {
      const time = movementTime(m.createdAt);
      const reason = (m.reason || m.staffName || '').trim();
      const label = [time, reason].filter(Boolean).join(' ') || '—';
      return `  ${label}`.slice(0, Math.max(8, width - 10));
    };

    for (let i = 0; i < shiftRows.length; i++) {
      const s = shiftRows[i]!;
      if (shiftRows.length > 1) {
        const label = s.staffName
          ? `${i + 1}. ${s.staffName}`
          : `${i + 1}`;
        r += centerLine(label.slice(0, width), width) + '\n';
      }
      const opening = Number(s.openingFloat || 0);
      const cashRefunds = Number(s.cashRefunds || 0);
      const cashSalesNet = Number(s.cashSales || 0);
      const cashSalesGross = Math.round((cashSalesNet + cashRefunds) * 100) / 100;
      const cashIn = Number(s.cashIn || 0);
      const cashOut = Number(s.cashOut || 0);
      const ins = (s.movements || []).filter((m) => String(m.type).toLowerCase() !== 'out');
      const outs = (s.movements || []).filter((m) => String(m.type).toLowerCase() === 'out');

      if (opening > 0) {
        r += padLine(L.openingFloat, money(opening), width) + '\n';
        r += centerLine(`(${L.floatCarriesForward})`, width) + '\n';
      }
      r += padLine(L.cashSalesDuringShift, money(cashSalesGross), width) + '\n';
      r += padLine(L.cashInDuringShift, money(cashIn), width) + '\n';
      for (const m of ins) {
        r += padLine(movementLeft(m), money(m.amount), width) + '\n';
      }
      r += padLine(L.cashOutDuringShift, cashOut > 0 ? money(-cashOut) : money(0), width) + '\n';
      for (const m of outs) {
        r += padLine(movementLeft(m), money(-Math.abs(m.amount)), width) + '\n';
      }
      if (cashRefunds > 0) {
        r += padLine(L.cashRefundsDuringShift, money(-cashRefunds), width) + '\n';
      }
      r += padLine(L.expectedInDrawer, money(s.expectedCash), width) + '\n';
      r += centerLine(L.expectedDrawerFormula, width) + '\n';
      if (s.closingCashCounted != null) {
        r += padLine(L.countedClosingCash, money(s.closingCashCounted), width) + '\n';
      }
      if (s.variance != null) {
        r += padLine(L.cashVariance, money(s.variance), width) + '\n';
      }
      if (i < shiftRows.length - 1) r += thin + '\n';
    }
    r += thin + '\n';
    // Wrap carry-forward note to paper width
    const note = L.floatCarriesForwardNote;
    const words = note.split(/\s+/);
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (next.length > width && line) {
        r += line + '\n';
        line = w;
      } else {
        line = next;
      }
    }
    if (line) r += line + '\n';
  }

  if (report.footer?.trim()) {
    r += thin + '\n';
    r += report.footer.trim() + '\n';
  }
  r += '\n\n\n';
  return r;
}

/** Shift-scoped thermal report (same layout as EOD, different title and period). */
export function generateShiftReportText(report: EodReportPrint): string {
  return generateEodReportText({ ...report, reportKind: 'shift' });
}

export type RevenuePeriodSummaryPrint = {
  title: string;
  periodLabel: string;
  revenue: number;
  tipsTotal: number;
  taxTotal: number;
  refundTotal: number;
  grandTotal: number;
  paymentRows: Array<{ method: string; count: number; total: number }>;
  userPerformance?: Array<{ name: string; total: number }>;
  businessName?: string;
  language?: string;
  paperWidthMm?: 58 | 80;
  header?: string;
  footer?: string;
  /** Localized labels (from i18n). */
  labels: {
    netSalesExclTips: string;
    tips: string;
    tax: string;
    refunds: string;
    grandTotal: string;
    byPayment: string;
    userPerformance: string;
    qty: string;
  };
  paymentMethodLabel: (method: string) => string;
  staffNameLabel: (name: string) => string;
};

/** Compact revenue-period summary for thermal receipt / EOD printers. */
export function generateRevenuePeriodSummaryText(report: RevenuePeriodSummaryPrint): string {
  const width = lineWidthForPaper(report.paperWidthMm ?? 80);
  const L = receiptLabels(report.language);
  const sep = '='.repeat(width);
  const thin = '-'.repeat(width);
  const money = (n: number) => `CHF ${Number(n || 0).toFixed(2)}`;
  const debit = (n: number) => (Number(n) > 0.001 ? `-${money(n)}` : money(n));

  let r = '';
  r += sep + '\n';
  if (report.header?.trim()) {
    for (const line of report.header.trim().split(/\r?\n/)) r += line.slice(0, width) + '\n';
  } else if (report.businessName) {
    r += centerLine(report.businessName.toUpperCase().slice(0, width), width) + '\n';
  }
  r += sep + '\n';
  r += centerLine(report.title.slice(0, width), width) + '\n';
  r += centerLine(report.periodLabel.slice(0, width), width) + '\n';
  r += thin + '\n';
  r += padLine(report.labels.netSalesExclTips, money(report.revenue), width) + '\n';
  r += padLine(`  ${report.labels.tips}`, money(report.tipsTotal), width) + '\n';
  r += padLine(`  ${report.labels.tax}`, money(report.taxTotal), width) + '\n';
  r += padLine(report.labels.refunds, debit(report.refundTotal), width) + '\n';
  r += thin + '\n';
  r += padLine(report.labels.grandTotal, money(report.grandTotal), width) + '\n';
  r += thin + '\n';
  r += centerLine(report.labels.byPayment, width) + '\n';
  r += thin + '\n';
  for (const row of report.paymentRows || []) {
    r +=
      padLine(
        `${report.paymentMethodLabel(row.method)} · ${report.labels.qty} ${row.count}`,
        money(row.total),
        width
      ) + '\n';
  }
  if (report.userPerformance?.length) {
    r += thin + '\n';
    r += centerLine(report.labels.userPerformance, width) + '\n';
    r += thin + '\n';
    for (const u of report.userPerformance) {
      r += padLine(report.staffNameLabel(u.name), money(u.total), width) + '\n';
    }
  }
  if (report.footer?.trim()) {
    r += thin + '\n';
    r += report.footer.trim() + '\n';
  }
  r += '\n\n\n';
  return r;
}

/** Minimal ESC/POS: init + optional logo + text + optional QR raster + optional delivery QR raster + Code128 + feed + cut */
export function textToEscPos(
  text: string,
  qrRaster?: Uint8Array | null,
  logoBytes?: Uint8Array | null,
  barcodeData?: string,
  barcodeLabel?: string,
  deliveryQrRaster?: Uint8Array | null
): Uint8Array {
  const body = escposCp850Encode(text);
  const init = new Uint8Array([0x1b, 0x40]);
  const alignCenter = new Uint8Array([0x1b, 0x61, 0x01]);
  const alignLeft = new Uint8Array([0x1b, 0x61, 0x00]);
  const feed = new Uint8Array([0x1b, 0x64, 0x04]);
  const cut = new Uint8Array([0x1d, 0x56, 0x41, 0x10]);
  const parts: Uint8Array[] = [init, ESC_CODEPAGE_CP850];
  if (logoBytes?.length) {
    parts.push(alignCenter, logoBytes, alignLeft);
  }
  parts.push(alignLeft, body);
  if (qrRaster?.length) {
    parts.push(alignCenter, qrRaster, alignLeft);
  }
  if (deliveryQrRaster?.length) {
    parts.push(alignCenter, deliveryQrRaster, alignLeft);
  }
  if (barcodeData) {
    parts.push(escposCode128(barcodeData, 72, 2));
    if (barcodeLabel?.trim()) {
      parts.push(alignCenter, escposCp850Encode(barcodeLabel.trim() + '\n'), alignLeft);
    }
  }
  parts.push(feed, cut);
  return concatBytes(...parts);
}

/** Build receipt ESC/POS with bitmap QR (web / print-agent path). Digital receipt QR only. */
export async function buildReceiptEscPos(
  text: string,
  opts: {
    qrData?: string;
    /** @deprecated Directions QR removed — kept for call-site compat, ignored. */
    deliveryQrData?: string;
    language?: ReceiptLang | string;
    logoBytes?: Uint8Array | null;
    barcodeData?: string;
    barcodeLabel?: string;
    paperWidthMm?: 58 | 80;
  } = {}
): Promise<Uint8Array> {
  const paper = opts.paperWidthMm ?? 80;
  const langCode = String(opts.language || 'en').toLowerCase().slice(0, 2);
  const lang: ReceiptLang = langCode === 'fr' || langCode === 'de' ? langCode : 'en';
  const L = receiptLabels(lang);
  const qrData = opts.qrData?.trim();

  let qrRaster: Uint8Array | null = null;

  if (qrData) {
    qrRaster =
      (await buildLabeledReceiptQrRasterEscPos({
        label: L.digitalReceiptQrTitle,
        data: qrData,
        paperWidthMm: paper,
      })) ||
      (await generateReceiptQrRasterEscPos(qrData, paper)) ||
      escposQrCode(qrData, paper === 58 ? 4 : 5);
  }

  return textToEscPos(text, qrRaster, opts.logoBytes, opts.barcodeData, opts.barcodeLabel);
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export const RECEIPT_LOGO_WIDTH_PX_MAX = 200;
export const RECEIPT_LOGO_WIDTH_PX_MIN = 48;
export const RECEIPT_LOGO_WIDTH_PX_DEFAULT = 200;

const RECEIPT_LOGO_PAPER_MAX: Record<58 | 80, number> = { 58: 240, 80: 384 };

/** Resolve configured receipt logo print width (capped at 200px and paper limits). */
export function resolveReceiptLogoWidthPx(
  settings?: Pick<PosPrintSettingsClient, 'receiptLogoWidthPx' | 'paperWidthMm'> | null,
  paperWidthMm?: 58 | 80
): number {
  const paper = paperWidthMm === 58 || settings?.paperWidthMm === 58 ? 58 : 80;
  const paperMax = RECEIPT_LOGO_PAPER_MAX[paper];
  const configured = Number(settings?.receiptLogoWidthPx);
  const width =
    Number.isFinite(configured) && configured > 0
      ? Math.round(configured)
      : RECEIPT_LOGO_WIDTH_PX_DEFAULT;
  return Math.min(RECEIPT_LOGO_WIDTH_PX_MAX, paperMax, Math.max(RECEIPT_LOGO_WIDTH_PX_MIN, width));
}

/** Resize an uploaded logo so stored/printed width never exceeds maxPx (default 200). */
export async function resizeImageFileForReceiptLogo(
  file: File,
  maxPx = RECEIPT_LOGO_WIDTH_PX_MAX
): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  const objectUrl = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('logo load failed'));
      el.src = objectUrl;
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  try {
    if (img.width <= maxPx && img.height <= maxPx) return file;
    const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, mime, mime === 'image/jpeg' ? 0.92 : undefined)
    );
    if (!blob) return file;
    const ext = mime === 'image/png' ? '.png' : '.jpg';
    const base = file.name.replace(/\.[^.]+$/, '') || 'receipt-logo';
    return new File([blob], `${base}${ext}`, { type: mime });
  } catch {
    return file;
  }
}

/** Load image URL → ESC/POS GS v 0 raster (monochrome). */
export async function logoUrlToEscPos(
  url: string,
  maxWidthPx = RECEIPT_LOGO_WIDTH_PX_DEFAULT
): Promise<Uint8Array | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('logo load failed'));
      el.src = url;
    });
    const scale = Math.min(1, maxWidthPx / img.width);
    const w = Math.max(8, Math.floor(img.width * scale));
    const h = Math.max(8, Math.floor(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    const bytesPerRow = Math.ceil(w / 8);
    const raster = new Uint8Array(bytesPerRow * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
        if (lum < 160) {
          raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
        }
      }
    }
    const header = new Uint8Array([
      0x1d,
      0x76,
      0x30,
      0x00,
      bytesPerRow & 0xff,
      (bytesPerRow >> 8) & 0xff,
      h & 0xff,
      (h >> 8) & 0xff,
    ]);
    return concatBytes(header, raster);
  } catch {
    return null;
  }
}

export function printersForRole(
  settings: PosPrintSettingsClient | null | undefined,
  role: 'receipt' | 'kitchen' | 'eod' | 'labels'
): Array<{ name: string; paperWidthMm: 58 | 80 }> {
  const globalPaper: 58 | 80 = settings?.paperWidthMm === 58 ? 58 : 80;
  const list = (settings?.printers || []).filter((p) => p.enabled !== false && p.name);
  const matched = list.filter((p) => {
    if (role === 'receipt') return !!p.printReceipts;
    if (role === 'kitchen') return !!p.printKitchenTickets;
    if (role === 'labels') return !!(p as { printLabels?: boolean }).printLabels;
    return !!p.printEndOfDayReports;
  });
  if (matched.length) {
    return matched.map((p) => ({
      name: p.name,
      paperWidthMm: (p.paperWidthMm === 58 ? 58 : globalPaper) as 58 | 80,
    }));
  }
  // Fallback: default paper width, caller supplies Windows printer name from localStorage
  return [];
}

export function filterKitchenItems(
  items: KitchenTicketItem[],
  printer: NonNullable<PosPrintSettingsClient['printers']>[number],
  ctx?: {
    otherKitchenPrinters?: NonNullable<PosPrintSettingsClient['printers']>;
    excludedCategoryIds?: Set<string>;
  }
): KitchenTicketItem[] {
  const linkedCats = printer.linkedCategoryIds || [];
  const linkedProds = new Set(printer.linkedProductIds || []);
  const excluded = ctx?.excludedCategoryIds || new Set<string>();

  if (linkedCats.length > 0) {
    const catSet = new Set(linkedCats);
    return items.filter((i) => {
      if (i.productId && linkedProds.has(i.productId)) return true;
      if (i.categoryId && catSet.has(i.categoryId)) return true;
      return false;
    });
  }

  if (printer.printAllProducts === false) {
    if (linkedProds.size) {
      return items.filter((i) => i.productId && linkedProds.has(i.productId));
    }
    return [];
  }

  const claimedByOthers = new Set<string>();
  for (const other of ctx?.otherKitchenPrinters || []) {
    if (other.id === printer.id) continue;
    for (const cid of other.linkedCategoryIds || []) claimedByOthers.add(cid);
  }

  return items.filter((i) => {
    if (i.productId && linkedProds.has(i.productId)) return true;
    if (!i.categoryId) return true;
    if (excluded.has(i.categoryId)) return false;
    if (claimedByOthers.has(i.categoryId)) return false;
    return true;
  });
}

export type KitchenPrintJob = {
  printerName: string;
  paperWidthMm: 58 | 80;
  items: KitchenTicketItem[];
};

/**
 * Build per-printer kitchen print jobs from cart/order lines.
 * Each enabled kitchen printer receives lines whose categoryId is in linkedCategoryIds,
 * or all categories when linkedCategoryIds is empty (legacy default).
 */
export function buildKitchenPrintJobs(
  items: KitchenTicketItem[],
  settings: PosPrintSettingsClient | null | undefined
): KitchenPrintJob[] {
  if (!items.length) return [];

  const globalPaper: 58 | 80 = settings?.paperWidthMm === 58 ? 58 : 80;
  const allPrinters = (settings?.printers || []).filter((p) => p.enabled !== false && p.name);
  const kitchenPrinters = allPrinters.filter((p) => p.printKitchenTickets);
  const excluded = new Set(settings?.kitchenExcludedCategoryIds || []);

  if (!kitchenPrinters.length) {
    return [{ printerName: '', paperWidthMm: globalPaper, items }];
  }

  const jobs: KitchenPrintJob[] = [];
  for (const kp of kitchenPrinters) {
    const filtered = filterKitchenItems(items, kp, {
      otherKitchenPrinters: kitchenPrinters,
      excludedCategoryIds: excluded,
    });
    if (!filtered.length) continue;
    jobs.push({
      printerName: kp.name,
      paperWidthMm: resolveKitchenPaperWidthMm(settings, kp.paperWidthMm),
      items: filtered,
    });
  }

  if (!jobs.length) {
    return [{ printerName: '', paperWidthMm: globalPaper, items }];
  }

  return jobs;
}

/** When multiple kitchen printers share one order, map printer name → items on other stations. */
export function buildKitchenCrossStationFooters(
  jobs: KitchenPrintJob[]
): Map<string, KitchenTicketItem[]> {
  const map = new Map<string, KitchenTicketItem[]>();
  if (jobs.length < 2) return map;
  for (const job of jobs) {
    const key = (job.printerName || '').trim();
    const others: KitchenTicketItem[] = [];
    for (const other of jobs) {
      if ((other.printerName || '').trim() === key) continue;
      others.push(...other.items);
    }
    if (others.length) map.set(key, others);
  }
  return map;
}

/**
 * Kitchen jobs that will not reprint on a guest-receipt printer.
 * Kitchen only goes to dedicated kitchen printers (not the guest-receipt printer).
 */
export function kitchenJobsExcludingReceiptPrinters(
  items: KitchenTicketItem[],
  settings: PosPrintSettingsClient | null | undefined
): KitchenPrintJob[] {
  const jobs = buildKitchenPrintJobs(items, settings);
  const receiptNames = new Set(
    (settings?.printers || [])
      .filter((p) => p.enabled !== false && p.printReceipts && p.name)
      .map((p) => p.name)
  );
  return jobs.filter((j) => {
    const name = (j.printerName || '').trim();
    if (!name) return false;
    if (receiptNames.has(name)) return false;
    return true;
  });
}

/** Prefer dedicated kitchen printers; never route to receipt printer when a kitchen-only printer exists. */
export function resolveKitchenPrintJobs(
  items: KitchenTicketItem[],
  settings: PosPrintSettingsClient | null | undefined
): KitchenPrintJob[] {
  const dedicated = kitchenJobsExcludingReceiptPrinters(items, settings);
  if (dedicated.length) return dedicated;

  const allPrinters = (settings?.printers || []).filter((p) => p.enabled !== false && p.name);
  const kitchenOnly = allPrinters.filter((p) => p.printKitchenTickets && !p.printReceipts);
  if (kitchenOnly.length) {
    const globalPaper: 58 | 80 = settings?.paperWidthMm === 58 ? 58 : 80;
    const excluded = new Set(settings?.kitchenExcludedCategoryIds || []);
    for (const kp of kitchenOnly) {
      const filtered = filterKitchenItems(items, kp, {
        otherKitchenPrinters: kitchenOnly,
        excludedCategoryIds: excluded,
      });
      if (!filtered.length) continue;
      return [
        {
          printerName: kp.name,
          paperWidthMm: resolveKitchenPaperWidthMm(settings, kp.paperWidthMm),
          items: filtered,
        },
      ];
    }
  }

  return buildKitchenPrintJobs(items, settings);
}

export function resolveReceiptLanguage(
  settings: PosPrintSettingsClient | null | undefined,
  panelLanguage?: string | null
): ReceiptLang {
  const mode = settings?.receiptLanguage || 'panel';
  if (mode === 'en' || mode === 'fr' || mode === 'de') return mode;
  const p = String(panelLanguage || 'en').toLowerCase().slice(0, 2);
  if (p === 'fr' || p === 'de') return p;
  return 'en';
}

/** Minimal order shape for reprinting from POS order history */
export type PosOrderForReceipt = {
  id: string;
  orderNumber: string;
  clientId?: string | null;
  channel?: string | null;
  paymentMethod?: string | null;
  subtotal?: number;
  taxAmount?: number;
  /** Persisted VAT % when available; otherwise inferred from subtotal/tax on reprint. */
  taxRate?: number;
  discountAmount?: number;
  tipAmount?: number;
  roundingAmount?: number;
  total: number;
  tableLabel?: string | null;
  guestCount?: number | null;
  /** Parsed / persisted kitchen–takeaway shout number, e.g. #4821 */
  ticketDisplay?: string | null;
  /** Staff-assigned tab / takeaway label */
  tabNumber?: string | null;
  notes?: string | null;
  staffName?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  orderSource?: string | null;
  orderType?: string | null;
  fulfillmentChannel?: string | null;
  scheduledFor?: string | number | Date | null;
  completedAt?: string | null;
  createdAt: string;
  splitCheckNumber?: number | null;
  /** Persisted Adyen Terminal API CustomerReceipt JSON (order history reprint). */
  adyenCustomerReceiptJson?: string | null;
  /** Persisted Adyen Terminal API CashierReceipt JSON (order history reprint). */
  adyenCashierReceiptJson?: string | null;
  /** Split tenders when order was paid with multiple methods. */
  paymentBreakdown?: Array<{ method: string; amount: number }> | null;
  /** Remaining gift card balance after redemption (from notes or redeem tx). */
  giftCardRemainingBalance?: number | null;
  pointsEarned?: number | null;
  pointsRedeemed?: number | null;
  memberName?: string | null;
  loyaltyPointsBalance?: number | null;
  items: Array<{
    id?: string;
    name?: string | null;
    productName?: string | null;
    quantity: number;
    totalPrice: number;
    unitPrice?: number;
    refundedQuantity?: number;
    productId?: string | null;
    categoryId?: string | null;
    product?: { categoryId?: string | null } | null;
    weightKg?: number | null;
    courseNumber?: number | null;
    selectedExtras?: Array<{ name?: string | null }> | null;
    comboSelections?: Array<{
      slotName?: string | null;
      productName?: string | null;
      selectedExtras?: Array<{ name?: string | null }>;
    }> | null;
  }>;
  refundAmount?: number;
  refundReason?: string | null;
};

/** VAT % for receipt reprints — never use the live POS channel when order totals imply another rate. */
export function resolveReceiptTaxRateForOrder(
  order: Pick<
    PosOrderForReceipt,
    'subtotal' | 'taxAmount' | 'taxRate' | 'channel' | 'fulfillmentChannel'
  >,
  opts?: {
    fallbackRate?: number;
    merchantTax?: MerchantChannelTaxSettings;
  }
): number {
  const explicit = Number(order.taxRate);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;

  const subtotal = Number(order.subtotal ?? 0);
  const taxAmount = Number(order.taxAmount ?? 0);
  if (subtotal > 0.001 && taxAmount > 0.001) {
    return roundMoney2((taxAmount / subtotal) * 100);
  }

  if (opts?.merchantTax) {
    return channelTaxRateFromMerchant(
      opts.merchantTax,
      order.channel || order.fulfillmentChannel
    );
  }

  const fallback = Number(opts?.fallbackRate);
  if (Number.isFinite(fallback) && fallback > 0) return fallback;
  return 8.1;
}

export function posOrderToWebPosReceipt(
  order: PosOrderForReceipt,
  ctx: {
    businessName: string;
    address?: string;
    phone?: string;
    vatNumber?: string;
    taxRate?: number;
    merchantTax?: MerchantChannelTaxSettings;
    vatIncludedInPrice?: boolean;
    vatAfterDiscount?: boolean;
    printSettings?: PosPrintSettingsClient | null;
    panelLang?: string;
    splitLabel?: string | null;
  }
): WebPosReceipt {
  const subtotal = Number(order.subtotal ?? 0);
  const taxAmount = Number(order.taxAmount ?? 0);
  const taxRate = resolveReceiptTaxRateForOrder(order, {
    fallbackRate: ctx.taxRate,
    merchantTax: ctx.merchantTax,
  });
  const lang = resolveReceiptLanguage(ctx.printSettings, ctx.panelLang);
  const paperWidthMm = ctx.printSettings?.paperWidthMm || 80;
  const completedAt = order.completedAt
    ? new Date(order.completedAt).getTime()
    : new Date(order.createdAt).getTime();
  const splitLabel =
    ctx.splitLabel ??
    (order.splitCheckNumber != null
      ? `Split ${order.splitCheckNumber}`
      : null);
  const meta = parseOrderMetaNotes(order.notes);
  const ticketDisplay = order.ticketDisplay || meta.ticketDisplay || null;
  const loyaltyPointsEarned =
    order.pointsEarned != null && Number(order.pointsEarned) > 0
      ? Math.floor(Number(order.pointsEarned))
      : meta.pointsEarned != null && meta.pointsEarned > 0
        ? meta.pointsEarned
        : null;
  const loyaltyPointsBalance =
    order.loyaltyPointsBalance != null && Number.isFinite(Number(order.loyaltyPointsBalance))
      ? Math.max(0, Math.floor(Number(order.loyaltyPointsBalance)))
      : meta.pointsBalance != null
        ? meta.pointsBalance
        : null;
  const hasLoyalty =
    (loyaltyPointsEarned != null && loyaltyPointsEarned > 0) || loyaltyPointsBalance != null;
  const memberName =
    order.memberName || meta.memberName || (hasLoyalty ? order.customerName : null) || null;
  const adyen = resolveOrderAdyenReceipts(order);
  const paymentLines = (() => {
    const tenders = parsePaymentBreakdown(
      order.paymentBreakdown,
      order.paymentMethod,
      Number(order.total)
    );
    if (tenders.length) return tenders;
    return undefined;
  })();
  const giftCardRemainingBalance =
    order.giftCardRemainingBalance != null
      ? roundMoney2(Number(order.giftCardRemainingBalance))
      : parseGiftCardRemainingFromNotes(order.notes);
  return {
    businessName: ctx.businessName,
    address: ctx.address,
    phone: ctx.phone,
    vatNumber: ctx.vatNumber,
    id: order.clientId || order.id,
    orderDisplay: ticketDisplay,
    orderNumber: order.orderNumber,
    tabNumber: order.tabNumber || meta.tabNumber || null,
    completedAt,
    channel: order.channel || order.fulfillmentChannel || undefined,
    paymentMethod: order.paymentMethod || 'cash',
    payLaterTender: payLaterCollectedTender(order.paymentMethod),
    payLaterCollected: !!payLaterCollectedTender(order.paymentMethod),
    paymentLines,
    customerName: order.customerName,
    memberName,
    loyaltyPointsEarned,
    loyaltyPointsBalance,
    customerPhone: order.customerPhone,
    shippingAddress: order.shippingAddress,
    orderSource: order.orderSource,
    orderType: order.orderType,
    tableLabel: order.tableLabel,
    guestCount: order.guestCount,
    items: (order.items || []).map((i) =>
      buildKitchenTicketItemFromLine({
        name: resolveOrderItemName(i.name, i.productName),
        quantity: Number(i.quantity) || 0,
        unitPrice: Number(i.unitPrice ?? (i.quantity ? i.totalPrice / i.quantity : i.totalPrice)),
        lineTotal: Number(i.totalPrice),
        productId: i.productId ?? null,
        weightKg: i.weightKg ?? null,
        courseNumber: i.courseNumber,
        selectedExtras: i.selectedExtras || [],
        comboSelections: i.comboSelections || [],
      })
    ),
    subtotal,
    discount: Number(order.discountAmount ?? 0),
    taxAmount,
    taxRate,
    rounding: Number(order.roundingAmount ?? 0),
    tipAmount: Number(order.tipAmount ?? 0),
    total: Number(order.total),
    vatIncludedInPrice: ctx.vatIncludedInPrice === true,
    vatAfterDiscount: ctx.vatAfterDiscount !== false,
    splitLabel,
    receiptUrl: order.id || order.clientId ? buildReceiptUrl(String(order.id || order.clientId)) : undefined,
    includeQr: ctx.printSettings?.receiptShowQrCode !== false,
    deliveryDirectionsQr: ctx.printSettings?.receiptDeliveryDirectionsQr !== false,
    staffName: order.staffName,
    language: lang,
    paperWidthMm,
    header: ctx.printSettings?.receiptHeader,
    footer: ctx.printSettings?.receiptFooter,
    showVat: ctx.printSettings?.receiptShowVatTable !== false,
    showStaff: ctx.printSettings?.receiptShowStaffLine !== false,
    adyenCustomerReceipt: adyen.customer,
    printAdyenReceiptOnTicket: shouldPrintAdyenReceiptOnTicket(ctx.printSettings),
    giftCardRemainingBalance,
    refundAmount: Number(order.refundAmount ?? 0),
    refundReason: order.refundReason,
  };
}

export type ReservationTicketOpts = {
  code: string;
  guestName: string;
  guestPhone?: string | null;
  partySize: number;
  reservedAt: string | number | Date;
  status?: string | null;
  tableLabel?: string | null;
  notes?: string | null;
  language?: string;
  paperWidthMm?: 58 | 80;
  businessName?: string;
};

export type OrderNotificationTicketOpts = {
  orderNumber: string;
  orderSource: string;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  scheduledFor?: string | null;
  channel?: string | null;
  total: number;
  items: Array<{ name: string; quantity: number }>;
  orderedAt?: number;
  language?: string;
  paperWidthMm?: 58 | 80;
  businessName?: string;
};

/** Short till alert when a new online order arrives (awaiting staff accept). */
export function generateOrderNotificationTicketEscPos(opts: OrderNotificationTicketOpts): Uint8Array {
  const width = lineWidthForPaper(opts.paperWidthMm ?? 80);
  const lang = (opts.language || 'en').slice(0, 2) as ReceiptLang;
  const L = receiptLabels(lang);
  const sep = '-'.repeat(width);
  const when = opts.orderedAt ? formatDateTimeDDMMYYYY(new Date(opts.orderedAt)) : formatDateTimeDDMMYYYY(new Date());
  const channel = channelLabel(L, opts.channel || 'takeaway');
  const pickupLine = opts.scheduledFor
    ? `${L.pickupTime}: ${formatTimeHHMM(new Date(opts.scheduledFor))}`
    : L.asap;
  const lines: string[] = [
    'NEW ONLINE ORDER',
    sep,
    centerLine(opts.businessName || APP_NAME, width),
    centerLine(String(opts.orderSource || 'ONLINE').slice(0, width), width),
    centerLine(String(opts.orderNumber || '-').slice(0, width), width),
    sep,
    padLine(L.customer, String(opts.customerName || '-').slice(0, width - 10), width),
  ];
  if (opts.customerPhone?.trim()) {
    lines.push(padLine('Tel', String(opts.customerPhone).slice(0, width - 5), width));
  }
  lines.push(
    padLine(L.channel, channel.slice(0, width - 10), width),
    padLine('When', when.slice(0, width - 6), width),
    pickupLine.slice(0, width)
  );
  if (opts.shippingAddress?.trim()) {
    lines.push(padLine(L.deliveryAddress, String(opts.shippingAddress).slice(0, width - 8), width));
  }
  lines.push(sep);
  for (const item of opts.items.slice(0, 12)) {
    const qtyPrefix = formatQtyArticlePrefix({ quantity: item.quantity });
    const { product, modifiers } = splitReceiptArticle(String(item.name || 'Item'));
    lines.push(`${qtyPrefix}${product}`.slice(0, width));
    for (const mod of modifiers) {
      lines.push(formatReceiptExtraLine(qtyPrefix, mod).slice(0, width));
    }
  }
  if (opts.items.length > 12) {
    lines.push(`+${opts.items.length - 12} ${L.totalItems.toLowerCase()}`);
  }
  lines.push(
    sep,
    padLine(L.total, `CHF ${roundMoney2(Number(opts.total) || 0).toFixed(2)}`, width),
    sep,
    centerLine('>>> AWAITING ACCEPT <<<', width),
    '',
    ''
  );

  const parts: Uint8Array[] = [
    new Uint8Array([0x1b, 0x40]),
    ESC_CODEPAGE_CP850,
    escAlign(1),
    escKitchenSize(2),
    escBold(true),
    escposCp850Encode(lines[0]),
    new Uint8Array([0x0a]),
    escAlign(0),
    escKitchenSize(1),
    escBold(false),
    escposCp850Encode(lines.slice(1).join('\n')),
    new Uint8Array([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00]),
  ];
  return concatBytes(...parts);
}

/** Reservation alert ticket for kitchen/host stand. */
export function generateReservationTicketEscPos(opts: ReservationTicketOpts): Uint8Array {
  const width = lineWidthForPaper(opts.paperWidthMm ?? 80);
  const lang = (opts.language || 'en').slice(0, 2) as ReceiptLang;
  const L = receiptLabels(lang);
  const when =
    opts.reservedAt instanceof Date
      ? formatDateTimeDDMMYYYY(opts.reservedAt)
      : formatDateTimeDDMMYYYY(new Date(opts.reservedAt));
  const sep = '-'.repeat(width);
  const lines: string[] = [
    'RESERVATION',
    sep,
    centerLine(opts.businessName || APP_NAME, width),
    centerLine(opts.code, width),
    sep,
    padLine('Guest', String(opts.guestName || '-').slice(0, width - 8), width),
    padLine('Phone', String(opts.guestPhone || '-').slice(0, width - 8), width),
    padLine('Party', String(opts.partySize), width),
    padLine('When', when.slice(0, width - 6), width),
  ];
  if (opts.tableLabel) {
    lines.push(padLine('Table', String(opts.tableLabel).slice(0, width - 7), width));
  }
  if (opts.status) {
    lines.push(padLine('Status', String(opts.status).slice(0, width - 8), width));
  }
  if (opts.notes?.trim()) {
    lines.push(sep, `Note: ${opts.notes.trim().slice(0, width - 6)}`);
  }
  lines.push(sep, L.thankYou, '', '');

  const parts: Uint8Array[] = [
    new Uint8Array([0x1b, 0x40]),
    ESC_CODEPAGE_CP850,
    escAlign(1),
    escKitchenSize(2),
    escBold(true),
    escposCp850Encode(lines[0]),
    new Uint8Array([0x0a]),
    escAlign(0),
    escKitchenSize(1),
    escBold(false),
    escposCp850Encode(lines.slice(1).join('\n')),
    new Uint8Array([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00]),
  ];
  return concatBytes(...parts);
}

export type DeliverySlipOpts = {
  businessName: string;
  address?: string;
  orderNumber: string;
  orderSource?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  orderNotes?: string | null;
  scheduledFor?: string | null;
  total: number;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  items?: Array<{ name: string; quantity: number; categoryLabel?: string | null; note?: string | null }>;
  language?: string;
  paperWidthMm?: 58 | 80;
  driverClaimUrl?: string;
  /** @deprecated Directions QR removed from delivery slip — driver claim QR only. */
  directionsUrl?: string | null;
};

export type DeliveryReceiptOpts = Omit<DeliverySlipOpts, 'driverClaimUrl' | 'directionsUrl'>;

function deliveryReceiptPaymentLine(
  L: ReturnType<typeof receiptLabels>,
  paymentMethod?: string | null,
  paymentStatus?: string | null
): string {
  const paid =
    paymentStatus === 'completed' ||
    paymentStatus === 'paid' ||
    paymentMethod === 'card' ||
    paymentMethod === 'terminal' ||
    paymentMethod === 'online';
  if (paid) return L.paid;
  const method = String(paymentMethod || '').toLowerCase();
  if (method === 'cash' || method === 'cod' || !paymentMethod) return 'COD';
  return paymentLabel(L, paymentMethod) || String(paymentMethod).toUpperCase();
}

/** POS delivery receipt — customer details + items for the main till printer (no driver QR). */
export function generateDeliveryReceiptEscPos(opts: DeliveryReceiptOpts): Uint8Array {
  const width = lineWidthForPaper(opts.paperWidthMm ?? 80);
  const lang = (opts.language || 'en').slice(0, 2) as ReceiptLang;
  const L = receiptLabels(lang);
  const sep = '='.repeat(width);
  const thin = '-'.repeat(width);
  const when = formatDateTimeDDMMYYYY(new Date());
  const zip = extractPostalCode(opts.shippingAddress);
  const source = String(opts.orderSource || 'ONLINE SHOP').toUpperCase().replace(/_/g, ' ');
  const payLine = deliveryReceiptPaymentLine(L, opts.paymentMethod, opts.paymentStatus);

  const lines: string[] = [
    centerLine(`* ${(opts.businessName || APP_NAME).toUpperCase()} *`, width),
    centerLine('DELIVERY RECEIPT', width),
    centerLine(source, width),
    centerLine(when.slice(0, width), width),
    sep,
    centerLine(`#${opts.orderNumber}`, width),
  ];

  if (opts.customerName?.trim()) {
    lines.push(padLine(L.customer, String(opts.customerName).slice(0, width - 10), width));
  }
  if (opts.customerPhone?.trim()) {
    lines.push(padLine('Tel', String(opts.customerPhone).slice(0, width - 5), width));
  }
  if (opts.shippingAddress?.trim()) {
    lines.push(padLine(L.deliveryAddress, String(opts.shippingAddress).slice(0, width - 8), width));
  }
  if (zip) {
    lines.push(padLine(L.postalCode, zip, width));
  }
  lines.push(
    padLine(
      L.forWhen,
      opts.scheduledFor ? formatTimeHHMM(new Date(opts.scheduledFor)) : L.asap,
      width
    ),
    thin
  );

  for (const item of opts.items || []) {
    const qtyPrefix = formatQtyArticlePrefix({ quantity: item.quantity });
    const { product, modifiers } = splitReceiptArticle(String(item.name || 'Item'));
    lines.push(`${qtyPrefix}${product}`.slice(0, width));
    for (const mod of modifiers) {
      lines.push(formatReceiptExtraLine(qtyPrefix, mod).slice(0, width));
    }
    if (item.note?.trim()) {
      lines.push(`  * ${item.note.trim()}`.slice(0, width));
    }
  }

  if (opts.orderNotes?.trim()) {
    lines.push(thin, `${L.note}:`.slice(0, width));
    for (const w of wrapKitchenWords(opts.orderNotes.trim(), width)) {
      lines.push(w);
    }
  }

  lines.push(
    thin,
    padLine(L.total, `CHF ${roundMoney2(Number(opts.total) || 0).toFixed(2)}`, width),
    padLine(L.payment, payLine.slice(0, width - 10), width),
    sep,
    centerLine(L.nonFiscalTicket, width),
    '',
    ''
  );

  const headerText = lines.slice(0, 5).join('\n') + '\n';
  const bodyText = lines.slice(5).join('\n');

  return concatBytes(
    new Uint8Array([0x1b, 0x40]),
    ESC_CODEPAGE_CP850,
    escAlign(1),
    escKitchenSize(2),
    escBold(true),
    escposCp850Encode(headerText),
    escAlign(0),
    escKitchenSize(1),
    escBold(false),
    escposCp850Encode(bodyText),
    new Uint8Array([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00])
  );
}

function extractPostalCode(address?: string | null): string {
  if (!address) return '';
  const m = String(address).match(/\b(\d{4})\b/);
  return m?.[1] || '';
}

function wrapLeftText(text: string, width: number): string[] {
  const out: string[] = [];
  for (const para of String(text || '').split(/\r?\n/)) {
    const chunk = para.trim();
    if (!chunk) continue;
    let line = '';
    for (const word of chunk.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > width && line) {
        out.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) out.push(line.slice(0, width));
  }
  return out;
}

/** Separate delivery slip for drivers (LIVRAISON + SCAN LIVREUR QR). */
export async function generateDeliverySlipEscPos(opts: DeliverySlipOpts): Promise<Uint8Array> {
  const width = lineWidthForPaper(opts.paperWidthMm ?? 80);
  const lang = (opts.language || 'en').slice(0, 2) as ReceiptLang;
  const L = receiptLabels(lang);
  const sep = '='.repeat(width);
  const thin = '-'.repeat(width);
  const when = formatDateTimeDDMMYYYY(new Date());
  const zip = extractPostalCode(opts.shippingAddress);
  const source = String(opts.orderSource || 'DELIVERY').toUpperCase().replace(/_/g, ' ');
  const payLabel = paymentLabel(L, opts.paymentMethod) || opts.paymentMethod || '-';
  const paid =
    opts.paymentStatus === 'completed' ||
    opts.paymentStatus === 'paid' ||
    opts.paymentMethod === 'card' ||
    opts.paymentMethod === 'terminal';
  const totalStr = `CHF ${roundMoney2(Number(opts.total) || 0).toFixed(2)}`;
  const whenLabel = opts.scheduledFor ? formatTimeHHMM(new Date(opts.scheduledFor)) : L.asap;

  const parts: Uint8Array[] = [new Uint8Array([0x1b, 0x40]), ESC_CODEPAGE_CP850];
  const lf = new Uint8Array([0x0a]);
  const appendText = (text: string) => {
    parts.push(escposCp850Encode(text));
  };
  const appendLine = (text = '') => {
    appendText(text);
    parts.push(lf);
  };

  // Header — centered, bold, double height
  parts.push(escAlign(1), escKitchenSize(2), escBold(true));
  appendLine(centerLine(`* ${(opts.businessName || APP_NAME).toUpperCase()} *`, width));
  appendLine(centerLine(source, width));
  parts.push(escKitchenSize(1));
  appendLine(padLine(L.delivery.toUpperCase(), when.slice(0, width - 12), width));
  parts.push(escBold(false), escAlign(0));
  appendLine(sep);

  // Category / item summary
  const byCat = new Map<string, number>();
  for (const item of opts.items || []) {
    const cat = item.categoryLabel || 'ITEMS';
    byCat.set(cat, (byCat.get(cat) || 0) + (Number(item.quantity) || 1));
  }
  for (const [cat, qty] of byCat) {
    appendLine(padLine(`${cat}:`, String(qty), width));
  }
  if (!byCat.size && opts.items?.length) {
    for (const item of opts.items.slice(0, 8)) {
      appendLine(`${item.quantity}x ${item.name}`.slice(0, width));
    }
  }

  appendLine(thin);

  // Customer name + phone — left, bold, double width+height
  parts.push(escAlign(0), escKitchenSize(3), escBold(true));
  if (opts.customerName?.trim()) {
    appendLine(String(opts.customerName).trim().slice(0, width));
  }
  if (opts.customerPhone?.trim()) {
    appendLine(`Tel: ${String(opts.customerPhone).trim()}`.slice(0, width));
  }
  parts.push(escKitchenSize(1), escBold(false));

  // Address — left aligned, normal size
  if (opts.shippingAddress?.trim()) {
    const addrLines = wrapLeftText(opts.shippingAddress.trim(), width);
    if (addrLines.length) {
      appendLine(`${L.deliveryAddress}: ${addrLines[0]}`.slice(0, width));
      for (const ln of addrLines.slice(1)) {
        appendLine(ln);
      }
    }
  }
  if (zip) {
    appendLine(`${L.postalCode}: ${zip}`.slice(0, width));
  }
  appendLine(`${L.forWhen}: ${whenLabel}`.slice(0, width));

  appendLine(thin);
  appendLine(
    padLine(
      L.total,
      `${totalStr} ${payLabel.toUpperCase()}${paid ? ` (${L.paid})` : ''}`.slice(0, width - 8),
      width
    )
  );
  appendLine(centerLine(`#${opts.orderNumber}`, width));

  const claimUrl = opts.driverClaimUrl?.trim();
  const driverQr = claimUrl
    ? (await buildDeliverySlipQrRasterEscPos({
        label: L.scanDriver,
        data: claimUrl,
        paperWidthMm: opts.paperWidthMm ?? 80,
      })) ||
      (await generateReceiptQrRasterEscPos(claimUrl, opts.paperWidthMm ?? 80))
    : null;

  parts.push(escAlign(1));
  if (driverQr?.length) {
    parts.push(driverQr, lf);
  }
  parts.push(escAlign(0));
  appendLine(centerLine(L.nonFiscalTicket, width));
  parts.push(lf, lf, lf, new Uint8Array([0x1d, 0x56, 0x00]));

  return concatBytes(...parts);
}
