import { concatBytes, escposCode128 } from '@/lib/qr';
import { escposCp850Encode, ESC_CODEPAGE_CP850 } from '@/lib/escpos-encode';
import { printViaAgentOrQueue } from '@/lib/webpos-print-relay';
import { printersForRole, type PosPrintSettingsClient } from '@/lib/webpos-receipt';

export type LabelHeightMm = 20 | 25 | 30 | 40;
export type LabelWidthMm = 40 | 58;

export type LabelPrintOptions = {
  storeName?: string;
  widthMm?: LabelWidthMm;
  heightMm?: LabelHeightMm;
  showStoreName?: boolean;
  showProductName?: boolean;
  showBarcodeNumber?: boolean;
  showPrice?: boolean;
  showSku?: boolean;
  copies?: number;
};

export type LabelProduct = {
  id: string;
  name: string;
  barcode: string;
  price?: string | number | null;
  sku?: string | null;
};

/** Code128-B patterns (start=104, stop=106). */
const C128: string[] = [
  '11011001100','11001101100','11001100110','10010011000','10010001100','10001001100','10011001000','10011000100','10001100100','11001001000',
  '11001000100','11000100100','10110011100','10011011100','10011001110','10111001100','10011101100','10011100110','11001110010','11001011100',
  '11001001110','11011100100','11001110100','11101101110','11101001100','11100101100','11100100110','11101100100','11100110100','11100110010',
  '11011011000','11011000110','11000110110','10100011000','10001011000','10001000110','10110001000','10001101000','10001100010','11010001000',
  '11000101000','11000100010','10110111000','10110001110','10001101110','10111011000','10111000110','10001110110','11101110110','11010001110',
  '11000101110','11011101000','11011100010','11011101110','11101011000','11101000110','11100010110','11101101000','11101100010','11100011010',
  '11101111010','11001000010','11110001010','10100110000','10100001100','10010110000','10010000110','10000101100','10000100110','10110010000',
  '10110000100','10011010000','10011000010','10000110100','10000110010','11000010010','11001010000','11110111010','11000010100','10001111010',
  '10100111100','10010111100','10010011110','10111100100','10011110100','10011110010','11110100100','11110010100','11110010010','11011011110',
  '11011110110','11110110110','10101111000','10100011110','10001011110','10111101000','10111100010','11110101000','11110100010','10111011110',
  '10111101110','11101011110','11110101110','11010000100','11010010000','11010011100','1100011101011',
];

function encodeCode128B(data: string): string {
  const raw = String(data || '').replace(/[^\x20-\x7E]/g, '').slice(0, 40);
  if (!raw) return '';
  const values = [104];
  for (let i = 0; i < raw.length; i++) values.push(raw.charCodeAt(i) - 32);
  let sum = values[0]!;
  for (let i = 1; i < values.length; i++) sum += values[i]! * i;
  values.push(sum % 103);
  values.push(106);
  return values.map((v) => C128[v] || '').join('');
}

export function barcodeSvg(data: string, opts?: { height?: number; width?: number }): string {
  const bits = encodeCode128B(data);
  if (!bits) return '';
  const barH = opts?.height ?? 36;
  const module = Math.max(1, Math.round((opts?.width ?? 140) / bits.length));
  const w = bits.length * module;
  let x = 0;
  let rects = '';
  for (const bit of bits) {
    if (bit === '1') rects += `<rect x="${x}" y="0" width="${module}" height="${barH}" fill="#111"/>`;
    x += module;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${barH}" viewBox="0 0 ${w} ${barH}" role="img" aria-label="${escapeHtml(data)}">${rects}</svg>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(value: string | number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CHF' }).format(n);
}

export function normalizeLabelOptions(raw?: Partial<LabelPrintOptions> | null): Required<Omit<LabelPrintOptions, 'storeName' | 'copies'>> & {
  storeName: string;
  copies: number;
} {
  const h = Number(raw?.heightMm);
  return {
    storeName: String(raw?.storeName || '').trim().slice(0, 80),
    widthMm: Number(raw?.widthMm) === 58 ? 58 : 40,
    heightMm: (h === 25 || h === 30 || h === 40 ? h : 20) as LabelHeightMm,
    showStoreName: raw?.showStoreName !== false,
    showProductName: raw?.showProductName !== false,
    showBarcodeNumber: raw?.showBarcodeNumber !== false,
    showPrice: raw?.showPrice === true,
    showSku: raw?.showSku === true,
    copies: Math.min(20, Math.max(1, Math.floor(Number(raw?.copies) || 1))),
  };
}

export function buildLabelEscPos(product: LabelProduct, opts: LabelPrintOptions): Uint8Array {
  const o = normalizeLabelOptions(opts);
  const init = new Uint8Array([0x1b, 0x40]);
  const center = new Uint8Array([0x1b, 0x61, 0x01]);
  const left = new Uint8Array([0x1b, 0x61, 0x00]);
  const small = new Uint8Array([0x1d, 0x21, 0x00]);
  const parts: Uint8Array[] = [init, ESC_CODEPAGE_CP850, center, small];
  const line = (text: string) => concatBytes(escposCp850Encode(text.slice(0, 32)), new Uint8Array([0x0a]));
  if (o.showStoreName && o.storeName) parts.push(line(o.storeName));
  if (o.showProductName && product.name) parts.push(line(product.name));
  const meta: string[] = [];
  if (o.showPrice) {
    const p = money(product.price);
    if (p) meta.push(p);
  }
  if (o.showSku && product.sku) meta.push(String(product.sku));
  if (meta.length) parts.push(line(meta.join('  ')));
  const barH = o.heightMm <= 20 ? 48 : o.heightMm <= 25 ? 60 : o.heightMm <= 30 ? 72 : 88;
  parts.push(escposCode128(product.barcode, barH, o.widthMm === 40 ? 1 : 2));
  if (o.showBarcodeNumber) parts.push(line(product.barcode));
  parts.push(new Uint8Array([0x1b, 0x64, 0x02]));
  parts.push(new Uint8Array([0x1d, 0x56, 0x41, 0x00]));
  parts.push(left);
  return concatBytes(...parts);
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

export async function printLabelsViaAgentOrQueue(
  products: LabelProduct[],
  opts: LabelPrintOptions,
  settings?: PosPrintSettingsClient | null
): Promise<'local' | 'queued' | 'browser'> {
  const o = normalizeLabelOptions(opts);
  const printable = products.filter((p) => String(p.barcode || '').trim()).slice(0, 200);
  if (!printable.length) throw new Error('No barcodes to print');

  const chunks: Uint8Array[] = [];
  for (const product of printable) {
    for (let c = 0; c < o.copies; c++) {
      chunks.push(buildLabelEscPos(product, o));
    }
  }
  const data = concatBytes(...chunks);
  const labelsPrinters = printersForRole(settings || null, 'labels');
  const printerName = labelsPrinters[0]?.name;
  try {
    return await printViaAgentOrQueue({
      dataBase64: toBase64(data),
      printerName,
      text: printable.map((p) => p.barcode).join(', '),
    });
  } catch {
    printLabelsHtml(printable, o);
    return 'browser';
  }
}

export function printLabelsHtml(products: LabelProduct[], opts: LabelPrintOptions) {
  const o = normalizeLabelOptions(opts);
  const printable = products.filter((p) => String(p.barcode || '').trim()).slice(0, 200);
  const pages: string[] = [];
  for (const product of printable) {
    for (let c = 0; c < o.copies; c++) {
      const svg = barcodeSvg(product.barcode, { height: o.heightMm <= 20 ? 28 : 40, width: o.widthMm === 40 ? 120 : 160 });
      const meta: string[] = [];
      if (o.showPrice) {
        const p = money(product.price);
        if (p) meta.push(p);
      }
      if (o.showSku && product.sku) meta.push(String(product.sku));
      pages.push(`
        <div class="label">
          ${o.showStoreName && o.storeName ? `<div class="store">${escapeHtml(o.storeName)}</div>` : ''}
          ${o.showProductName ? `<div class="name">${escapeHtml(product.name)}</div>` : ''}
          ${meta.length ? `<div class="meta">${escapeHtml(meta.join(' · '))}</div>` : ''}
          <div class="bars">${svg}</div>
          ${o.showBarcodeNumber ? `<div class="num">${escapeHtml(product.barcode)}</div>` : ''}
        </div>`);
    }
  }
  const html = `<!doctype html><html><head><title>Labels</title>
    <style>
      @page { size: ${o.widthMm}mm ${o.heightMm}mm; margin: 1.5mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: system-ui, sans-serif; color: #111; }
      .label { width: ${o.widthMm}mm; height: ${o.heightMm}mm; padding: 1mm; page-break-after: always;
        display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      .store { font-size: 8px; font-weight: 700; letter-spacing: .02em; }
      .name { font-size: 10px; font-weight: 600; line-height: 1.15; }
      .meta { font-size: 8px; }
      .bars svg { max-width: 100%; height: auto; }
      .num { font-size: 9px; font-family: ui-monospace, monospace; letter-spacing: .04em; }
    </style></head><body>${pages.join('')}<script>window.onload=()=>{window.print();}</script></body></html>`;
  const win = window.open('', '_blank', 'noopener,noreferrer,width=480,height=640');
  if (!win) throw new Error('Popup blocked');
  win.document.write(html);
  win.document.close();
}
