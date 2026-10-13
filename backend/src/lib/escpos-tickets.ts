/** Compact ESC/POS tickets for server-side print-job expansion (Print Agent drain). */

const ESC_INIT = Buffer.from([0x1b, 0x40]);
const CP850 = Buffer.from([0x1b, 0x74, 0x02]);
const ALIGN_CENTER = Buffer.from([0x1b, 0x61, 0x01]);
const ALIGN_LEFT = Buffer.from([0x1b, 0x61, 0x00]);
const SIZE_DOUBLE = Buffer.from([0x1d, 0x21, 0x11]);
const SIZE_NORMAL = Buffer.from([0x1d, 0x21, 0x00]);
const BOLD_ON = Buffer.from([0x1b, 0x45, 0x01]);
const BOLD_OFF = Buffer.from([0x1b, 0x45, 0x00]);
/** Short feed + single full cut — matches dashboard escposKitchenCut(). */
const CUT = Buffer.from([0x1b, 0x64, 0x02, 0x1d, 0x56, 0x00]);

const CP850_MAP: Record<string, number> = {
  À: 0xb7,
  Á: 0xb5,
  Â: 0xb6,
  Ä: 0x8e,
  Ç: 0x80,
  È: 0xd4,
  É: 0x90,
  Ê: 0xd2,
  Ë: 0xd3,
  Ì: 0xde,
  Í: 0xd6,
  Î: 0xd7,
  Ï: 0xd8,
  Ñ: 0xa5,
  Ò: 0xe3,
  Ó: 0xe0,
  Ô: 0xe2,
  Ö: 0x99,
  Ù: 0xeb,
  Ú: 0xe9,
  Û: 0xea,
  Ü: 0x9a,
  à: 0x85,
  á: 0xa0,
  â: 0x83,
  ä: 0x84,
  ç: 0x87,
  è: 0x8a,
  é: 0x82,
  ê: 0x88,
  ë: 0x89,
  ì: 0x8d,
  í: 0xa1,
  î: 0x8c,
  ï: 0x8b,
  ñ: 0xa4,
  ò: 0x95,
  ó: 0xa2,
  ô: 0x93,
  ö: 0x94,
  ù: 0x97,
  ú: 0xa3,
  û: 0x96,
  ü: 0x81,
  ß: 0xe1,
  "€": 0xd5,
};

function encodeCp850(text: string): Buffer {
  const src = String(text || "").replace(/\r\n/g, "\n");
  const out = Buffer.alloc(src.length);
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const code = ch.charCodeAt(0);
    if (code < 128) out[i] = code;
    else out[i] = CP850_MAP[ch] ?? 0x3f;
  }
  return out;
}

function padLine(left: string, right: string, width: number): string {
  const l = String(left || "");
  const r = String(right || "");
  const gap = Math.max(1, width - l.length - r.length);
  return `${l}${" ".repeat(gap)}${r}`.slice(0, width);
}

function wrap(text: string, width: number): string[] {
  const raw = String(text || "").trim();
  if (!raw) return [];
  if (raw.length <= width) return [raw];
  const words = raw.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= width) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w.length <= width ? w : w.slice(0, width);
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export type KitchenTicketLang = "en" | "fr" | "de";

const KITCHEN_LABELS: Record<
  KitchenTicketLang,
  {
    kitchen: string;
    takeaway: string;
    delivery: string;
    dineIn: string;
    asap: string;
    totalItems: string;
    tel: string;
  }
> = {
  en: {
    kitchen: "KITCHEN",
    takeaway: "TAKEAWAY",
    delivery: "DELIVERY",
    dineIn: "DINE IN",
    asap: "ASAP",
    totalItems: "Items",
    tel: "Tel",
  },
  fr: {
    kitchen: "CUISINE",
    takeaway: "EMPORTER",
    delivery: "LIVRAISON",
    dineIn: "SUR PLACE",
    asap: "ASAP",
    totalItems: "Articles",
    tel: "Tel",
  },
  de: {
    kitchen: "KÜCHE",
    takeaway: "ZUM MITNEHMEN",
    delivery: "LIEFERUNG",
    dineIn: "VOR ORT",
    asap: "SOFORT",
    totalItems: "Artikel",
    tel: "Tel",
  },
};

export function resolveKitchenTicketLang(lang?: string | null): KitchenTicketLang {
  const code = String(lang || "en").toLowerCase().slice(0, 2);
  if (code === "fr" || code === "de") return code;
  return "en";
}

function zurichParts(at: Date): {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
} {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
  return {
    day: parts.day || "01",
    month: parts.month || "01",
    year: parts.year || "1970",
    hour: parts.hour || "00",
    minute: parts.minute || "00",
  };
}

function formatWhen(at: Date | string | number | null | undefined): string {
  const d = at instanceof Date ? at : new Date(at || Date.now());
  if (Number.isNaN(d.getTime())) return "";
  const p = zurichParts(d);
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}`;
}

function formatKitchenDate(at: Date): string {
  const p = zurichParts(at);
  return `${p.day}-${p.month}-${p.year}`;
}

function formatKitchenTime(at: Date): string {
  const p = zurichParts(at);
  return `${p.hour}:${p.minute}`;
}

function formatKitchenWhen(
  scheduledFor: Date | string | number | null | undefined,
  asap: string
): string {
  if (!scheduledFor) return asap;
  const d = scheduledFor instanceof Date ? scheduledFor : new Date(scheduledFor);
  if (Number.isNaN(d.getTime())) return asap;
  return `${formatKitchenDate(d)} ${formatKitchenTime(d)}`;
}

function kitchenChannelLabel(
  labels: (typeof KITCHEN_LABELS)[KitchenTicketLang],
  channel?: string | null
): string {
  const ch = String(channel || "takeaway").toLowerCase();
  if (ch === "delivery") return labels.delivery;
  if (ch === "dine_in" || ch === "dine-in") return labels.dineIn;
  return labels.takeaway;
}

function kitchenSourceLabel(source?: string | null): string {
  const s = String(source || "online_shop").toLowerCase();
  if (s === "justeat") return "JUST EAT";
  if (s === "ubereats") return "UBER EATS";
  if (s === "kiosk") return "KIOSK";
  if (s === "qr_table") return "QR TABLE";
  if (s === "phone") return "PHONE";
  return "ONLINE SHOP";
}

/** Drop sale-rounding lines — kitchen tickets only need prep notes. */
export function kitchenNotesForTicket(notes?: string | null): string {
  return String(notes || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^\[Rounding\b/i.test(l))
    .join("\n");
}

function ticket(opts: { header: string; lines: string[]; width?: number }): Buffer {
  const width = opts.width ?? 42;
  const sep = "-".repeat(width);
  const parts: Buffer[] = [
    ESC_INIT,
    CP850,
    ALIGN_CENTER,
    SIZE_DOUBLE,
    BOLD_ON,
    encodeCp850(opts.header.slice(0, 20)),
    Buffer.from([0x0a]),
    ALIGN_LEFT,
    SIZE_NORMAL,
    BOLD_OFF,
  ];
  const body = opts.lines
    .map((l) => (l === "---" ? sep : l.slice(0, width)))
    .join("\n");
  parts.push(encodeCp850(body), CUT);
  return Buffer.concat(parts);
}

export function reservationTicketEscPos(opts: {
  code: string;
  guestName: string;
  guestPhone?: string | null;
  partySize: number;
  reservedAt: Date | string | number;
  status?: string | null;
  tableLabel?: string | null;
  notes?: string | null;
  businessName?: string | null;
  paperWidthMm?: 58 | 80;
}): Buffer {
  const width = opts.paperWidthMm === 58 ? 32 : 42;
  const lines = [
    opts.businessName || "",
    String(opts.code || ""),
    "---",
    padLine("Guest", String(opts.guestName || "-"), width),
    padLine("Phone", String(opts.guestPhone || "-"), width),
    padLine("Party", String(opts.partySize || 1), width),
    padLine("When", formatWhen(opts.reservedAt), width),
  ].filter((l, i) => i > 1 || !!l);
  if (opts.tableLabel) lines.push(padLine("Table", String(opts.tableLabel), width));
  if (opts.status) lines.push(padLine("Status", String(opts.status), width));
  if (opts.notes?.trim()) {
    lines.push("---");
    lines.push(...wrap(`Note: ${opts.notes.trim()}`, width));
  }
  lines.push("---", "");
  return ticket({ header: "RESERVATION", lines, width });
}

export function buildKitchenTicketLines(opts: {
  orderNumber: string;
  orderSource?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  channel?: string | null;
  scheduledFor?: Date | string | null;
  notes?: string | null;
  items: Array<{ name: string; quantity: number; extras?: string[] }>;
  kitchenPrepOnly?: boolean;
  language?: string | null;
  orderedAt?: Date | string | number | null;
  width?: number;
}): { header: string; lines: string[]; width: number } {
  const width = opts.width ?? 42;
  const labels = KITCHEN_LABELS[resolveKitchenTicketLang(opts.language)];
  const prepOnly = opts.kitchenPrepOnly === true;
  const orderNo = String(opts.orderNumber || "-").trim() || "-";
  const when = formatKitchenWhen(opts.scheduledFor, labels.asap);
  const channelWhen = `${kitchenChannelLabel(labels, opts.channel)} : ${when}`;
  const headerLine = `${channelWhen}  ${orderNo}`;
  const lines: string[] = [];
  if (headerLine.length <= width) {
    lines.push(headerLine);
  } else {
    lines.push(...wrap(channelWhen, width));
    lines.push(...wrap(orderNo, width));
  }
  if (opts.customerName?.trim()) {
    lines.push(...wrap(opts.customerName.trim(), width));
  }
  if (!prepOnly && opts.customerPhone?.trim()) {
    lines.push(...wrap(`${labels.tel}: ${opts.customerPhone.trim()}`, width));
  }
  if (!prepOnly && String(opts.channel || "").toLowerCase() === "delivery" && opts.shippingAddress?.trim()) {
    lines.push(...wrap(opts.shippingAddress.trim(), width));
  }
  lines.push("---");
  let articleCount = 0;
  for (const item of opts.items) {
    const qty = Number(item.quantity) || 1;
    articleCount += qty;
    lines.push(...wrap(`${qty} x ${item.name || "Item"}`, width));
    for (const extra of item.extras || []) {
      const text = String(extra || "").replace(/^[-+]\s*/, "").trim();
      if (text) lines.push(...wrap(`- ${text}`, width));
    }
  }
  const note = kitchenNotesForTicket(opts.notes);
  if (note) {
    lines.push("---");
    lines.push(...wrap(note, width));
  }
  lines.push("---");
  lines.push(`${labels.totalItems}: ${articleCount}`);
  lines.push("---");
  const printedAt = opts.orderedAt
    ? opts.orderedAt instanceof Date
      ? opts.orderedAt
      : new Date(opts.orderedAt)
    : new Date();
  const timeStr = Number.isNaN(printedAt.getTime())
    ? formatKitchenTime(new Date())
    : formatKitchenTime(printedAt);
  const footerUser = prepOnly ? "" : String(opts.customerName || "").trim();
  lines.push(`${footerUser ? footerUser : ""}, ${timeStr} | ${kitchenSourceLabel(opts.orderSource)}`);
  return { header: labels.kitchen, lines, width };
}

export function kitchenTicketEscPos(opts: {
  orderNumber: string;
  orderSource?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  channel?: string | null;
  scheduledFor?: Date | string | null;
  notes?: string | null;
  items: Array<{ name: string; quantity: number; extras?: string[] }>;
  paperWidthMm?: 58 | 80;
  kitchenPrepOnly?: boolean;
  language?: string | null;
  orderedAt?: Date | string | number | null;
}): Buffer {
  const width = opts.paperWidthMm === 58 ? 32 : 42;
  const built = buildKitchenTicketLines({ ...opts, width });
  return ticket({ header: built.header, lines: built.lines, width });
}

export function orderNotificationTicketEscPos(opts: {
  orderNumber: string;
  orderSource?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  channel?: string | null;
  total?: number;
  items: Array<{ name: string; quantity: number }>;
  paperWidthMm?: 58 | 80;
  businessName?: string | null;
}): Buffer {
  const width = opts.paperWidthMm === 58 ? 32 : 42;
  const lines = [
    opts.businessName || "",
    String(opts.orderSource || "ONLINE").toUpperCase(),
    String(opts.orderNumber || "-"),
    "---",
    padLine("Guest", String(opts.customerName || "-"), width),
  ];
  if (opts.customerPhone) lines.push(padLine("Tel", opts.customerPhone, width));
  if (opts.channel) lines.push(padLine("Channel", opts.channel, width));
  if (opts.shippingAddress) lines.push(...wrap(opts.shippingAddress, width));
  lines.push("---");
  for (const item of opts.items.slice(0, 16)) {
    const qty = Number(item.quantity) || 1;
    lines.push(...wrap(`${qty}x ${item.name || "Item"}`, width));
  }
  if (opts.items.length > 16) lines.push(`+${opts.items.length - 16} more`);
  if (opts.total != null) {
    lines.push("---", padLine("Total", `CHF ${Number(opts.total).toFixed(2)}`, width));
  }
  lines.push("---", ">>> AWAITING ACCEPT <<<", "");
  return ticket({ header: "NEW ORDER", lines, width });
}

export function deliverySlipEscPos(opts: {
  orderNumber: string;
  customerName?: string | null;
  customerPhone?: string | null;
  shippingAddress?: string | null;
  total?: number;
  items: Array<{ name: string; quantity: number }>;
  paperWidthMm?: 58 | 80;
  businessName?: string | null;
}): Buffer {
  const width = opts.paperWidthMm === 58 ? 32 : 42;
  const lines = [
    opts.businessName || "",
    String(opts.orderNumber || "-"),
    "---",
    padLine("Guest", String(opts.customerName || "-"), width),
  ];
  if (opts.customerPhone) lines.push(padLine("Tel", opts.customerPhone, width));
  if (opts.shippingAddress) {
    lines.push("---");
    lines.push(...wrap(opts.shippingAddress, width));
  }
  lines.push("---");
  for (const item of opts.items) {
    const qty = Number(item.quantity) || 1;
    lines.push(...wrap(`${qty}x ${item.name || "Item"}`, width));
  }
  if (opts.total != null) {
    lines.push("---", padLine("Total", `CHF ${Number(opts.total).toFixed(2)}`, width));
  }
  lines.push("---", "");
  return ticket({ header: "DELIVERY", lines, width });
}
