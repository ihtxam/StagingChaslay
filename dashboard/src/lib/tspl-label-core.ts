/** LuckyDoor / TSC clones are 203 dpi (8 dots/mm). */
export const TSPL_DPMM = 8;

/**
 * USB TSPL label printers (LuckyDoor EML-400L, Gprinter, TSC clones).
 * Niimbot names are excluded — those use a bitmap protocol, not TSPL.
 */
export function isTsplLabelPrinterName(name?: string | null): boolean {
  const n = String(name || '').toLowerCase();
  if (/niimbot|\bk3\b|\bb21\b|\bd11\b|\bb1\b|\bd110\b/.test(n)) return false;
  return /eml-?\d|emlabel|luckydoor|lucky\s*door|\btspl\b|gprinter|\btsc[-\s]|zd\d{3}|4inch|4-inch|4 inch|lp-80[hn]|lp-400/.test(
    n
  );
}

export function tsplQuote(value: string, maxLen = 64): string {
  return String(value || '')
    .replace(/\r?\n/g, ' ')
    .replace(/"/g, "'")
    .trim()
    .slice(0, maxLen);
}

/** Windows-1252 bytes (TSPL CODEPAGE 1252) for FR/DE product names. */
export function encodeWin1252(str: string): Uint8Array {
  const extra: Record<number, number> = {
    0x20ac: 0x80, // €
    0x201a: 0x82,
    0x0192: 0x83,
    0x201e: 0x84,
    0x2026: 0x85,
    0x2020: 0x86,
    0x2021: 0x87,
    0x02c6: 0x88,
    0x2030: 0x89,
    0x0160: 0x8a, // Š
    0x2039: 0x8b,
    0x0152: 0x8c, // Œ
    0x017d: 0x8e, // Ž
    0x2018: 0x91,
    0x2019: 0x92,
    0x201c: 0x93,
    0x201d: 0x94,
    0x2022: 0x95,
    0x2013: 0x96,
    0x2014: 0x97,
    0x02dc: 0x98,
    0x2122: 0x99,
    0x0161: 0x9a,
    0x203a: 0x9b,
    0x0153: 0x9c,
    0x017e: 0x9e,
    0x0178: 0x9f,
  };
  const bytes: number[] = [];
  for (const ch of str) {
    const c = ch.codePointAt(0) || 0;
    if (c <= 0x7f) bytes.push(c);
    else if (c >= 0xa0 && c <= 0xff) bytes.push(c);
    else bytes.push(extra[c] ?? 0x3f);
  }
  return Uint8Array.from(bytes);
}

export type TsplLabelFields = {
  widthMm: number;
  heightMm: number;
  storeName?: string;
  productName?: string;
  meta?: string;
  barcode: string;
  showStoreName?: boolean;
  showProductName?: boolean;
  showBarcodeNumber?: boolean;
  copies?: number;
};

function tsplLine(text: string, x: number, y: number, font: string, mul: number): string {
  return `TEXT ${x},${y},"${font}",0,${mul},${mul},"${tsplQuote(text, 48)}"`;
}

export function buildTsplCommandList(fields: TsplLabelFields): string[] {
  const w = fields.widthMm;
  const h = fields.heightMm;
  const copies = Math.min(20, Math.max(1, Math.floor(Number(fields.copies) || 1)));
  const pad = Math.max(8, Math.round(w * TSPL_DPMM * 0.04));
  const dotsH = Math.round(h * TSPL_DPMM);
  const mul = w >= 80 ? 2 : 1;
  const line3 = 24 * mul + 4;
  const line2 = 20 * mul + 4;
  let y = pad;

  const cmds: string[] = [
    `SIZE ${w} mm,${h} mm`,
    'GAP 2 mm,0 mm',
    'SPEED 4',
    'DENSITY 8',
    'DIRECTION 1',
    'REFERENCE 0,0',
    'CODEPAGE 1252',
    'CLS',
  ];

  if (fields.showStoreName !== false && fields.storeName) {
    cmds.push(tsplLine(fields.storeName, pad, y, '3', mul));
    y += line3;
  }
  if (fields.showProductName !== false && fields.productName) {
    cmds.push(tsplLine(fields.productName, pad, y, '3', mul));
    y += line3;
  }
  if (fields.meta) {
    cmds.push(tsplLine(fields.meta.replace(/ · /g, '  '), pad, y, '2', 1));
    y += line2;
  }

  const numberReserve = fields.showBarcodeNumber !== false ? line2 : 0;
  const remain = dotsH - y - pad - numberReserve;
  const barH = Math.max(40, Math.min(h <= 20 ? 56 : 160, remain));
  const narrow = w <= 40 ? 1 : 2;
  const wide = w <= 40 ? 2 : 4;
  const barcode = tsplQuote(fields.barcode, 48);
  cmds.push(`BARCODE ${pad},${y},"128",${barH},0,0,${narrow},${wide},"${barcode}"`);
  y += barH + 4;
  if (fields.showBarcodeNumber !== false) {
    cmds.push(tsplLine(fields.barcode, pad, Math.min(y, dotsH - line2), '2', 1));
  }
  cmds.push(`PRINT 1,${copies}`);
  return cmds;
}

export function encodeTsplCommands(commands: string[]): Uint8Array {
  return encodeWin1252(commands.join('\r\n') + '\r\n');
}
