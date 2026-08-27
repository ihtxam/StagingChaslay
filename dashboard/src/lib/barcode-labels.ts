import JsBarcode from 'jsbarcode';
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

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCode128Svg(data: string, opts?: { height?: number; width?: number }): string {
  const raw = String(data || '').trim();
  if (!raw || typeof document === 'undefined') return '';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svg, raw, {
      format: 'CODE128',
      displayValue: false,
      height: opts?.height ?? 36,
      width: 2,
      margin: 2,
    });
    svg.setAttribute('width', String(opts?.width ?? 140));
    svg.removeAttribute('height');
    svg.setAttribute('style', 'max-width:100%;height:auto');
    return svg.outerHTML;
  } catch {
    return '';
  }
}

export function barcodeSvg(data: string, opts?: { height?: number; width?: number }): string {
  return renderCode128Svg(data, opts);
}

function money(value: string | number | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CHF' }).format(n);
}

export function labelMetaLine(product: LabelProduct, opts: LabelPrintOptions): string {
  const o = normalizeLabelOptions(opts);
  const meta: string[] = [];
  if (o.showPrice) {
    const p = money(product.price);
    if (p) meta.push(p);
  }
  if (o.showSku && product.sku) meta.push(String(product.sku));
  return meta.join(' · ');
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
  const meta = labelMetaLine(product, o);
  if (meta) parts.push(line(meta.replace(/ · /g, '  ')));
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
  settings?: PosPrintSettingsClient | null,
  relayOpts?: { retryLocally?: boolean }
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
      retryLocally: relayOpts?.retryLocally,
      jobKind: 'other',
      jobLabel: 'barcode-label',
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
      const meta = labelMetaLine(product, o);
      pages.push(`
        <div class="label">
          ${o.showStoreName && o.storeName ? `<div class="store">${escapeHtml(o.storeName)}</div>` : ''}
          ${o.showProductName ? `<div class="name">${escapeHtml(product.name)}</div>` : ''}
          ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ''}
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
