import { roundMoney2 } from '@/lib/money';
import { APP_NAME } from '@/lib/brand';
import { buildReceiptUrl, concatBytes, escposQrCode } from '@/lib/qr';
import { escposCp850Encode, ESC_CODEPAGE_CP850 } from '@/lib/escpos-encode';
import { localDateTimeToIso } from '@/lib/shop-hours';
import { resolveOrderItemName } from '@/lib/order-item-name';
import {
  channelLabel,
  lineWidthForPaper,
  paymentLabel,
  receiptLabels,
  type ReceiptLang,
} from '@/lib/receipt-labels';

/** Where the kitchen ticket was printed from */
export type KitchenOrderSource = 'WEBPOS' | 'ONLINE' | 'POSAPP' | 'WAITERAPP';

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

/** Machine markers stored in order.notes so UI/receipts can recover tab + ticket. */
const TICKET_NOTE_RE = /\[ticket:([^\]]+)\]/i;
const TAB_NOTE_RE = /\[tab:([^\]]+)\]/i;

export function encodeOrderMetaNotes(opts: {
  existing?: string | null;
  ticketDisplay?: string | null;
  tabNumber?: string | null;
}): string | undefined {
  let base = String(opts.existing || '')
    .replace(TICKET_NOTE_RE, '')
    .replace(TAB_NOTE_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[·\s]+|[·\s]+$/g, '')
    .trim();
  const tags: string[] = [];
  const ticket = opts.ticketDisplay?.trim();
  const tab = opts.tabNumber != null ? String(opts.tabNumber).trim() : '';
  if (ticket) tags.push(`[ticket:${ticket.replace(/[\[\]]/g, '')}]`);
  if (tab) tags.push(`[tab:${tab.replace(/[\[\]]/g, '')}]`);
  const joined = [...tags, base].filter(Boolean).join(' ').trim();
  return joined || undefined;
}

export function parseOrderMetaNotes(notes?: string | null): {
  ticketDisplay?: string;
  tabNumber?: string;
  cleanNotes: string;
} {
  const raw = String(notes || '');
  const ticketMatch = raw.match(TICKET_NOTE_RE);
  const tabMatch = raw.match(TAB_NOTE_RE);
  const cleanNotes = raw
    .replace(TICKET_NOTE_RE, '')
    .replace(TAB_NOTE_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[·\s]+|[·\s]+$/g, '')
    .trim();
  let ticketDisplay = ticketMatch?.[1]?.trim() || undefined;
  if (ticketDisplay && !ticketDisplay.startsWith('#')) {
    ticketDisplay = `#${ticketDisplay.replace(/^#/, '')}`;
  }
  return {
    ticketDisplay,
    tabNumber: tabMatch?.[1]?.trim() || undefined,
    cleanNotes,
  };
}

export type WebPosReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  seatNumber?: number | null;
  productId?: string | null;
  categoryId?: string | null;
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
  paperWidthMm?: 58 | 80;
  receiptLanguage?: 'en' | 'fr' | 'de' | 'panel';
  receiptLogoUrl?: string | null;
  autoPrintReceipt?: boolean;
  autoPrintKitchen?: boolean;
  printers?: Array<{
    id: string;
    name: string;
    enabled?: boolean;
    paperWidthMm?: 58 | 80;
    printReceipts?: boolean;
    printKitchenTickets?: boolean;
    printEndOfDayReports?: boolean;
    printAllProducts?: boolean;
    linkedCategoryIds?: string[];
    linkedProductIds?: string[];
  }>;
};

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
  completedAt: number;
  channel?: string;
  paymentMethod: string;
  /** Split tenders printed as separate lines (cash + card, etc.). */
  paymentLines?: Array<{ method: string; amount: number }>;
  amountTendered?: number | null;
  changeDue?: number | null;
  /** Delivery customer (printed on delivery receipts) */
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
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
  splitLabel?: string | null;
  notes?: string;
  receiptUrl?: string;
  includeQr?: boolean;
  staffName?: string | null;
  language?: ReceiptLang | string;
  paperWidthMm?: 58 | 80;
  header?: string;
  footer?: string;
  showVat?: boolean;
  showStaff?: boolean;
};

function padLine(left: string, right: string, width: number): string {
  const gap = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(gap) + right;
}

function centerLine(text: string, width: number): string {
  const t = text.slice(0, width);
  const pad = Math.max(0, Math.floor((width - t.length) / 2));
  return ' '.repeat(pad) + t;
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
  const time = d.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich',
  });
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
  const dayKey = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Zurich' });
  if (dayKey === todayKey) return time;
  const dayLabel = d.toLocaleDateString('de-CH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Zurich',
  });
  return `${dayLabel} ${time}`;
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
  const net = roundMoney2(tx.subtotal);
  const tva = roundMoney2(tx.taxAmount);
  const brut = roundMoney2(net + tva);
  const rateLabel = `${L.tva}: ${tx.taxRate}%`;

  if (tx.vatIncludedInPrice !== false) {
    let r = L.vatIncludedNote.slice(0, width) + '\n';
    r += vatTableRow(L.type, L.net, L.tva, L.brut, width) + '\n';
    r += vatTableRow(rateLabel, net.toFixed(2), tva.toFixed(2), brut.toFixed(2), width);
    return r;
  }

  const text = `${L.tva} ${tx.taxRate}% ${L.net} ${net.toFixed(2)} ${L.tva} ${tva.toFixed(2)} ${L.total} ${brut.toFixed(2)}`;
  return text.slice(0, width);
}

function formatReceiptMetaFooter(
  tx: WebPosReceipt,
  L: ReturnType<typeof receiptLabels>,
  locale: string,
  width: number
): string {
  const date = new Date(tx.completedAt);
  const dateStr = `${date.toLocaleDateString(locale, { timeZone: 'Europe/Zurich' })} ${date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Zurich' })}`;
  const rawRef = (tx.orderDisplay || tx.orderNumber || tx.id.slice(-8)).trim();
  const orderRef = shortenOrderRef(rawRef, 16);
  const channel = tx.channel ? channelLabel(L, tx.channel) : '';
  const user = tx.showStaff !== false && tx.staffName?.trim() ? tx.staffName.trim() : '';
  const parts = [dateStr, orderRef, channel, user].filter(Boolean);
  return centerLine(parts.join(' | '), width);
}

/** Shorten long TX refs for receipt footer, e.g. TX-20260801-005747-8949 → TX-005747-8949 */
function shortenOrderRef(orderNumber: string, maxLen = 16): string {
  if (orderNumber.length <= maxLen) return orderNumber;
  const parts = orderNumber.split('-');
  if (parts.length >= 3) {
    const short = `${parts[0]}-${parts[parts.length - 2]}-${parts[parts.length - 1]}`;
    if (short.length <= maxLen) return short;
  }
  return `…${orderNumber.slice(-(maxLen - 1))}`;
}

export function generateWebPosReceiptText(tx: WebPosReceipt, panelLang?: string): string {
  const width = lineWidthForPaper(tx.paperWidthMm);
  const lang = resolveLang(tx, panelLang);
  const L = receiptLabels(lang);
  const locale = lang === 'fr' ? 'fr-CH' : lang === 'de' ? 'de-CH' : 'en-CH';
  const sep = '='.repeat(width);
  const thin = '-'.repeat(width);

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
  if (tx.tableLabel) {
    r += `${L.table} ${tx.tableLabel}`;
    if (tx.guestCount) r += ` · ${tx.guestCount} ${L.pax}`;
    r += '\n';
  }
  if (tx.channel === 'delivery') {
    if (tx.customerName?.trim()) r += `${L.customer}: ${tx.customerName.trim()}\n`;
    if (tx.customerPhone?.trim()) r += `Tel: ${tx.customerPhone.trim()}\n`;
    if (tx.shippingAddress?.trim()) {
      r += `${L.deliveryAddress}:\n`;
      for (const line of tx.shippingAddress.trim().split(/\r?\n/)) {
        const chunk = line.trim();
        if (!chunk) continue;
        for (let i = 0; i < chunk.length; i += width) {
          r += chunk.slice(i, i + width) + '\n';
        }
      }
    }
  }
  if (tx.splitLabel) r += `${tx.splitLabel}\n`;
  r += thin + '\n';

  for (const item of tx.items) {
    r += item.name.slice(0, width) + '\n';
    r +=
      padLine(
        `  ${item.quantity} x ${item.unitPrice.toFixed(2)}`,
        item.lineTotal.toFixed(2),
        width
      ) + '\n';
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
  r += sep + '\n';
  const tenders =
    tx.paymentLines && tx.paymentLines.length > 0
      ? tx.paymentLines
      : [{ method: tx.paymentMethod, amount: tx.total }];
  if (tenders.length === 1) {
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
  r += padLine(`${L.paid}:`, `CHF ${tx.total.toFixed(2)}`, width) + '\n';
  if (
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
  // VAT calculations below payment section
  const vatSection = formatVatSection(tx, L, width);
  if (vatSection) {
    r += vatSection + '\n';
  }
  if (tx.notes) r += `${L.note} ${tx.notes}\n`;

  // QR is embedded as ESC/POS graphics by the printer layer — do not print the URL text.
  if (tx.includeQr !== false && (tx.receiptUrl || tx.id)) {
    r += thin + '\n';
    r += L.scanDigitalReceipt + '\n';
  }

  r += formatReceiptMetaFooter(tx, L, locale, width) + '\n';
  const footer = (tx.footer || L.thankYou).trim();
  r += footer + '\n\n\n';
  return r;
}

export type KitchenTicketItem = WebPosReceiptItem & {
  courseNumber?: number | null;
};

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
  /** Staff or customer name at footer */
  userName?: string | null;
  /** Origin of the order / print */
  orderSource?: KitchenOrderSource | string | null;
  itemTextScale?: 1 | 2 | 3;
  headerTextScale?: 1 | 2 | 3;
  boldText?: boolean;
  /** Print COURSE N headers when items have courseNumber */
  groupByCourse?: boolean;
  tableLabel?: string | null;
  /** Void ticket: title CANCELLED + strikethrough item lines */
  cancelled?: boolean;
  cancelReason?: string | null;
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
  return items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
}

type KitchenLine = {
  kind: 'center' | 'header' | 'item' | 'normal' | 'strike';
  /** Line body without trailing newlines (ESC/POS adds LF bytes explicitly). */
  text: string;
  /** Extra blank lines after this row (kitchen readability). */
  blankAfter?: number;
};

/** Columns available when GS ! enlarges text (scale 3 = double width). */
function kitchenColsForScale(paperWidthMm: number | undefined, scale: 1 | 2 | 3): number {
  const base = lineWidthForPaper(paperWidthMm);
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
  const qty = `${Number(item.quantity) || 0}x`;
  const fullName = String(item.name || '').replace(/\s+/g, ' ').trim();
  const paren = fullName.match(/^(.*?)\s*\((.*)\)\s*$/);
  const product = paren ? paren[1].trim() : fullName;
  const extras = paren ? paren[2].trim() : '';

  const primary = `${qty} ${product}`.trim();
  const wrappedPrimary = wrapKitchenWords(primary, width);
  const lines: KitchenLine[] = [];

  const pushStrikeOrItem = (text: string, blankAfter = 0) => {
    if (!cancelled) {
      lines.push({ kind: 'item', text, blankAfter });
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

  if (wrappedPrimary.length) {
    wrappedPrimary.forEach((w, i) => {
      const last = i === wrappedPrimary.length - 1 && !extras;
      pushStrikeOrItem(w, last ? 1 : 0);
    });
  } else {
    pushStrikeOrItem(qty, extras ? 0 : 1);
  }

  if (extras) {
    const extraLines = wrapKitchenWords(`(${extras})`, Math.max(8, width - 2));
    extraLines.forEach((w, i) => {
      pushStrikeOrItem(`  ${w}`, i === extraLines.length - 1 ? 1 : 0);
    });
  }

  return lines;
}

function buildKitchenTicketLines(
  opts: KitchenTicketOpts,
  forEscPos = false
): {
  width: number;
  L: ReturnType<typeof receiptLabels>;
  lines: KitchenLine[];
} {
  const headerScale = (opts.headerTextScale === 1 || opts.headerTextScale === 3
    ? opts.headerTextScale
    : 2) as 1 | 2 | 3;
  const itemScale = (opts.itemTextScale === 1 || opts.itemTextScale === 3
    ? opts.itemTextScale
    : 2) as 1 | 2 | 3;
  const headerWidth = kitchenColsForScale(opts.paperWidthMm, headerScale);
  const itemWidth = kitchenColsForScale(opts.paperWidthMm, itemScale);
  const footWidth = lineWidthForPaper(opts.paperWidthMm);
  const L = receiptLabels(opts.language);
  // Short separator avoids wrap when a prior large-font mode was left on by a flaky printer.
  const thin = '-'.repeat(Math.min(footWidth, 32));
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
  for (const w of wrapKitchenWords(
    formatChannelWhen(L, opts.channel, opts.scheduledFor),
    headerWidth
  )) {
    lines.push({ kind: 'header', text: w });
  }
  lines.push({ kind: 'normal', text: thin });

  if (opts.tableLabel) {
    for (const w of wrapKitchenWords(`TABLE ${opts.tableLabel}`, headerWidth)) {
      lines.push({ kind: 'header', text: w });
    }
  }

  if (cancelled && opts.cancelReason) {
    for (const w of wrapKitchenWords(String(opts.cancelReason), footWidth)) {
      lines.push({ kind: 'normal', text: w });
    }
    lines.push({ kind: 'normal', text: thin });
  }

  const items = opts.items;
  const hasCourses =
    !cancelled &&
    opts.groupByCourse !== false &&
    items.some((i) => i.courseNumber != null && i.courseNumber > 0);

  if (hasCourses) {
    const courses = Array.from(
      new Set(items.map((i) => i.courseNumber || 1).filter((n) => n > 0))
    ).sort((a, b) => a - b);
    for (const course of courses) {
      lines.push({ kind: 'header', text: `COURSE ${course}` });
      for (const item of items.filter((i) => (i.courseNumber || 1) === course)) {
        lines.push(...formatKitchenItemLines(item, itemWidth, cancelled, forEscPos));
      }
    }
  } else {
    for (const item of items) {
      lines.push(...formatKitchenItemLines(item, itemWidth, cancelled, forEscPos));
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
  return buildKitchenTicketLines(opts, false)
    .lines.map((l) => `${l.text}\n${'\n'.repeat(l.blankAfter || 0)}`)
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

/** Kitchen ticket as ESC/POS with bold + enlarged text (default scale 2 ≈ 12pt tall). */
export function generateKitchenTicketEscPos(opts: KitchenTicketOpts): Uint8Array {
  const { lines } = buildKitchenTicketLines(opts, true);
  const headerScale = (opts.headerTextScale === 1 || opts.headerTextScale === 3
    ? opts.headerTextScale
    : 2) as 1 | 2 | 3;
  const itemScale = (opts.itemTextScale === 1 || opts.itemTextScale === 3
    ? opts.itemTextScale
    : 2) as 1 | 2 | 3;
  const bold = opts.boldText !== false;
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

export type EodVatRow = {
  label: string;
  net: number;
  tva: number;
  brut: number;
};

/** Cash drawer reconciliation for a closed (or closing) shift. */
export type EodShiftCash = {
  openingFloat: number;
  cashSales: number;
  expectedCash: number;
  closingCashCounted?: number | null;
  variance?: number | null;
  staffName?: string | null;
};

export type EodReportPrint = {
  label: string;
  periodFrom?: string;
  periodTo?: string;
  salesCount: number;
  revenue: number;
  subtotal?: number;
  taxTotal: number;
  netTotal?: number;
  tipsTotal?: number;
  grandTotal?: number;
  refundTotal: number;
  cancelledCount: number;
  cancelledTotal: number;
  cashTotal: number;
  cardTotal: number;
  terminalTotal: number;
  coversServed?: number | null;
  vatRows?: EodVatRow[];
  productsSold: Array<{ name: string; quantity: number; total: number }>;
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
  const sep = '='.repeat(Math.min(width, 32));
  const thin = '-'.repeat(Math.min(width, 32));
  const money = (n: number) => `CHF ${Number(n || 0).toFixed(2)}`;
  const two = (n: number) => Number(n || 0).toFixed(2);
  const tips = Number(report.tipsTotal || 0);
  const brut = Number(report.revenue || 0);
  const grand = Number(report.grandTotal != null ? report.grandTotal : brut + tips);
  const period =
    report.periodFrom && report.periodTo
      ? `${report.periodFrom} to ${report.periodTo}`
      : report.label;

  let r = '';
  r += sep + '\n';
  if (report.businessName) {
    r += centerLine(report.businessName.toUpperCase().slice(0, width), width) + '\n';
  }
  r += sep + '\n';
  r += '\n';
  r += centerLine(L.endOfDay, width) + '\n';
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
        money(report.cancelledTotal),
        width
      ) + '\n';
  }
  if (report.refundTotal > 0) {
    r += padLine(L.refunds, money(report.refundTotal), width) + '\n';
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

  if (report.productsSold.length) {
    r += '\n';
    r += thin + '\n';
    r += centerLine(L.productsSold, width) + '\n';
    r += thin + '\n';
    const qtySum = report.productsSold.reduce((s, p) => s + p.quantity, 0);
    r += padLine(L.totalQty, String(Math.round(qtySum * 1000) / 1000), width) + '\n';
    const nameWidth = width <= 32 ? 22 : 30;
    for (const p of report.productsSold.slice(0, 60)) {
      const name = p.name.slice(0, nameWidth).padEnd(Math.min(nameWidth, width - 6));
      r += (name + String(p.quantity).padStart(6)).slice(0, width) + '\n';
    }
  }

  const shiftRows = report.shiftCash
    ? Array.isArray(report.shiftCash)
      ? report.shiftCash
      : [report.shiftCash]
    : [];
  if (shiftRows.length) {
    r += '\n';
    r += thin + '\n';
    r += centerLine(L.cashDrawer, width) + '\n';
    r += thin + '\n';
    for (let i = 0; i < shiftRows.length; i++) {
      const s = shiftRows[i]!;
      if (shiftRows.length > 1) {
        const label = s.staffName
          ? `${i + 1}. ${s.staffName}`
          : `${i + 1}`;
        r += centerLine(label.slice(0, width), width) + '\n';
      }
      r += padLine(L.openingFloat, money(s.openingFloat), width) + '\n';
      r += centerLine(`(${L.floatCarriesForward})`, width) + '\n';
      r += padLine(L.cashSalesDuringShift, money(s.cashSales), width) + '\n';
      r += padLine(L.expectedInDrawer, money(s.expectedCash), width) + '\n';
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

/** Minimal ESC/POS: init + optional logo + text + optional QR + feed + partial cut */
export function textToEscPos(
  text: string,
  qrData?: string,
  logoBytes?: Uint8Array | null
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
  if (qrData) {
    parts.push(alignCenter, escposQrCode(qrData, 5), alignLeft);
  }
  parts.push(feed, cut);
  return concatBytes(...parts);
}

export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/** Load image URL → ESC/POS GS v 0 raster (monochrome). */
export async function logoUrlToEscPos(
  url: string,
  maxWidthDots = 384
): Promise<Uint8Array | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('logo load failed'));
      el.src = url;
    });
    const scale = Math.min(1, maxWidthDots / img.width);
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
  role: 'receipt' | 'kitchen' | 'eod'
): Array<{ name: string; paperWidthMm: 58 | 80 }> {
  const list = (settings?.printers || []).filter((p) => p.enabled !== false && p.name);
  const matched = list.filter((p) => {
    if (role === 'receipt') return !!p.printReceipts;
    if (role === 'kitchen') return !!p.printKitchenTickets;
    return !!p.printEndOfDayReports;
  });
  if (matched.length) {
    return matched.map((p) => ({
      name: p.name,
      paperWidthMm: (p.paperWidthMm === 58 ? 58 : 80) as 58 | 80,
    }));
  }
  // Fallback: default paper width, caller supplies Windows printer name from localStorage
  return [];
}

export function filterKitchenItems(
  items: KitchenTicketItem[],
  printer: NonNullable<PosPrintSettingsClient['printers']>[number]
): KitchenTicketItem[] {
  if (printer.printAllProducts !== false) return items;
  const cats = new Set(printer.linkedCategoryIds || []);
  const prods = new Set(printer.linkedProductIds || []);
  if (!cats.size && !prods.size) return items;
  return items.filter(
    (i) => (i.productId && prods.has(i.productId)) || (i.categoryId && cats.has(i.categoryId))
  );
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
  completedAt?: string | null;
  createdAt: string;
  splitCheckNumber?: number | null;
  items: Array<{
    id?: string;
    name?: string | null;
    quantity: number;
    totalPrice: number;
    unitPrice?: number;
    refundedQuantity?: number;
  }>;
  refundReason?: string | null;
};

export function posOrderToWebPosReceipt(
  order: PosOrderForReceipt,
  ctx: {
    businessName: string;
    address?: string;
    phone?: string;
    vatNumber?: string;
    taxRate?: number;
    vatIncludedInPrice?: boolean;
    printSettings?: PosPrintSettingsClient | null;
    panelLang?: string;
    splitLabel?: string | null;
  }
): WebPosReceipt {
  const subtotal = Number(order.subtotal ?? 0);
  const taxAmount = Number(order.taxAmount ?? 0);
  const inferredRate =
    subtotal > 0 && taxAmount > 0 ? roundMoney2((taxAmount / subtotal) * 100) : 8.1;
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
  return {
    businessName: ctx.businessName,
    address: ctx.address,
    phone: ctx.phone,
    vatNumber: ctx.vatNumber,
    id: order.clientId || order.id,
    orderDisplay: ticketDisplay,
    orderNumber: order.orderNumber,
    completedAt,
    channel: order.channel || undefined,
    paymentMethod: order.paymentMethod || 'cash',
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    shippingAddress: order.shippingAddress,
    tableLabel: order.tableLabel,
    guestCount: order.guestCount,
    items: order.items.map((i) => ({
      name: resolveOrderItemName(i.name),
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice ?? (i.quantity ? i.totalPrice / i.quantity : i.totalPrice)),
      lineTotal: Number(i.totalPrice),
    })),
    subtotal,
    discount: Number(order.discountAmount ?? 0),
    taxAmount,
    taxRate: ctx.taxRate ?? inferredRate,
    rounding: Number(order.roundingAmount ?? 0),
    tipAmount: Number(order.tipAmount ?? 0),
    total: Number(order.total),
    vatIncludedInPrice: ctx.vatIncludedInPrice === true,
    splitLabel,
    receiptUrl: order.clientId ? buildReceiptUrl(order.clientId) : undefined,
    includeQr: ctx.printSettings?.receiptShowQrCode !== false,
    staffName: order.staffName,
    language: lang,
    paperWidthMm,
    header: ctx.printSettings?.receiptHeader,
    footer: ctx.printSettings?.receiptFooter,
    showVat: ctx.printSettings?.receiptShowVatTable !== false,
    showStaff: ctx.printSettings?.receiptShowStaffLine !== false,
  };
}
