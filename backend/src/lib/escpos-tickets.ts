/** Compact ESC/POS tickets for server-side print-job expansion (Print Agent drain). */

const ESC_INIT = Buffer.from([0x1b, 0x40]);
const CP850 = Buffer.from([0x1b, 0x74, 0x02]);
const ALIGN_CENTER = Buffer.from([0x1b, 0x61, 0x01]);
const ALIGN_LEFT = Buffer.from([0x1b, 0x61, 0x00]);
const SIZE_DOUBLE = Buffer.from([0x1d, 0x21, 0x11]);
const SIZE_NORMAL = Buffer.from([0x1d, 0x21, 0x00]);
const BOLD_ON = Buffer.from([0x1b, 0x45, 0x01]);
const BOLD_OFF = Buffer.from([0x1b, 0x45, 0x00]);
const CUT = Buffer.from([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00]);

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

function formatWhen(at: Date | string | number | null | undefined): string {
  const d = at instanceof Date ? at : new Date(at || Date.now());
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
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
}): Buffer {
  const width = opts.paperWidthMm === 58 ? 32 : 42;
  const lines = [
    String(opts.orderNumber || "-"),
    String(opts.orderSource || "ONLINE").toUpperCase(),
    "---",
  ];
  for (const item of opts.items) {
    const qty = Number(item.quantity) || 1;
    lines.push(...wrap(`${qty}x ${item.name || "Item"}`, width));
    for (const extra of item.extras || []) {
      lines.push(...wrap(`  + ${extra}`, width));
    }
  }
  lines.push("---");
  if (opts.customerName) lines.push(padLine("Guest", opts.customerName, width));
  if (opts.customerPhone) lines.push(padLine("Tel", opts.customerPhone, width));
  if (opts.channel) lines.push(padLine("Channel", opts.channel, width));
  if (opts.scheduledFor) lines.push(padLine("When", formatWhen(opts.scheduledFor), width));
  if (opts.shippingAddress) {
    lines.push(...wrap(opts.shippingAddress, width));
  }
  if (opts.notes?.trim()) {
    lines.push("---");
    lines.push(...wrap(opts.notes.trim(), width));
  }
  lines.push("---", "");
  return ticket({ header: "KITCHEN", lines, width });
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
