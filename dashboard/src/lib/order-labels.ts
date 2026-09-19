import {
  buildOrderLabelData,
  formatOrderLabelWeightKg,
  orderLabelMetaLine,
  type OrderLabelData,
  type OrderLabelLine,
} from '@/lib/order-label-barcode';
import {
  normalizeLabelOptions,
  parseLabelHeightMm,
  parseLabelWidthMm,
  type LabelPrintOptions,
  type LabelProduct,
} from '@/lib/barcode-labels';
import { concatBytes, escposCode128 } from '@/lib/qr';
import { escposCp850Encode, ESC_CODEPAGE_CP850 } from '@/lib/escpos-encode';
import { printViaAgentOrQueue } from '@/lib/webpos-print-relay';
import { printNiimbotLabelViaAgent } from '@/lib/print-agent';
import { renderNiimbotLabelPng } from '@/lib/niimbot-label';
import {
  buildTsplBitmapLabel,
  buildTsplCommandList,
  encodeTsplCommands,
  tsplBarcodeFits,
} from '@/lib/tspl-label-core';
import { printersForRole, type PosPrintSettingsClient } from '@/lib/webpos-receipt';
import { pickPreferredLabelPrinter, resolveLabelPrintProtocol } from '@/lib/label-print-protocol';
import JsBarcode from 'jsbarcode';

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

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

function orderLabelAsProduct(data: OrderLabelData): LabelProduct {
  return {
    id: data.heldId,
    name: data.productName,
    barcode: data.barcode,
    price: data.price,
    sku: formatOrderLabelWeightKg(data.weightKg) || null,
  };
}

function orderLabelRenderOpts(data: OrderLabelData, opts: LabelPrintOptions): LabelPrintOptions {
  return {
    ...opts,
    showPrice: true,
    showSku: !!formatOrderLabelWeightKg(data.weightKg),
  };
}

export function buildOrderLabelEscPos(data: OrderLabelData, opts: LabelPrintOptions): Uint8Array {
  const o = normalizeLabelOptions(opts);
  const init = new Uint8Array([0x1b, 0x40]);
  const center = new Uint8Array([0x1b, 0x61, 0x01]);
  const left = new Uint8Array([0x1b, 0x61, 0x00]);
  const small = new Uint8Array([0x1d, 0x21, 0x00]);
  const parts: Uint8Array[] = [init, ESC_CODEPAGE_CP850, center, small];
  const line = (text: string) => concatBytes(escposCp850Encode(text.slice(0, 32)), new Uint8Array([0x0a]));
  if (o.showStoreName && o.storeName) parts.push(line(o.storeName));
  if (o.showProductName && data.productName) parts.push(line(data.productName));
  const meta = orderLabelMetaLine(data);
  if (meta) parts.push(line(meta.replace(/ · /g, '  ')));
  const barH = o.heightMm <= 20 ? 48 : o.heightMm <= 25 ? 60 : o.heightMm <= 30 ? 72 : 88;
  parts.push(escposCode128(data.barcode, barH, o.widthMm === 40 ? 1 : 2));
  if (o.showBarcodeNumber) parts.push(line(data.barcode));
  parts.push(new Uint8Array([0x1b, 0x64, 0x04]));
  parts.push(left);
  return concatBytes(...parts);
}

export function buildOrderLabelTspl(data: OrderLabelData, opts: LabelPrintOptions): Uint8Array {
  const o = normalizeLabelOptions(opts);
  return encodeTsplCommands(
    buildTsplCommandList({
      widthMm: o.widthMm,
      heightMm: o.heightMm,
      storeName: o.storeName,
      productName: data.productName,
      meta: orderLabelMetaLine(data),
      barcode: data.barcode,
      showStoreName: o.showStoreName,
      showProductName: o.showProductName,
      showBarcodeNumber: o.showBarcodeNumber,
      copies: o.copies,
    })
  );
}

export function printOrderLabelHtml(data: OrderLabelData, opts: LabelPrintOptions) {
  const o = normalizeLabelOptions(opts);
  const svg = renderCode128Svg(data.barcode, {
    height: o.heightMm <= 20 ? 28 : 40,
    width: o.widthMm === 40 ? 120 : 160,
  });
  const meta = orderLabelMetaLine(data);
  const html = `<!doctype html><html><head><title>Order label</title>
    <style>
      @page { size: ${o.widthMm}mm ${o.heightMm}mm; margin: 1.5mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: system-ui, sans-serif; color: #111; }
      .label { width: ${o.widthMm}mm; height: ${o.heightMm}mm; padding: 1mm; page-break-after: always;
        display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      .store { font-size: 8px; font-weight: 700; }
      .name { font-size: 10px; font-weight: 600; line-height: 1.15; }
      .meta { font-size: 8px; }
      .bars svg { max-width: 100%; height: auto; }
      .num { font-size: 7px; font-family: ui-monospace, monospace; }
    </style></head><body>
      <div class="label">
        ${o.showStoreName && o.storeName ? `<div class="store">${escapeHtml(o.storeName)}</div>` : ''}
        ${o.showProductName ? `<div class="name">${escapeHtml(data.productName)}</div>` : ''}
        ${meta ? `<div class="meta">${escapeHtml(meta)}</div>` : ''}
        <div class="bars">${svg}</div>
        ${o.showBarcodeNumber ? `<div class="num">${escapeHtml(data.barcode)}</div>` : ''}
      </div>
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`;
  const win = window.open('', '_blank', 'noopener,noreferrer,width=480,height=640');
  if (!win) throw new Error('Popup blocked');
  win.document.write(html);
  win.document.close();
}

export function labelOptionsFromPrintSettings(
  settings?: PosPrintSettingsClient | null,
  storeName?: string
): LabelPrintOptions {
  return {
    storeName,
    widthMm: parseLabelWidthMm(settings?.labelWidthMm),
    heightMm: parseLabelHeightMm(settings?.labelHeightMm),
    showStoreName: settings?.labelShowStoreName !== false,
    showProductName: settings?.labelShowProductName !== false,
    showBarcodeNumber: settings?.labelShowBarcodeNumber !== false,
    showPrice: true,
    showSku: false,
    copies: 1,
  };
}

export async function printOrderLabelViaAgent(
  heldId: string,
  lines: OrderLabelLine[],
  settings?: PosPrintSettingsClient | null,
  opts?: { storeName?: string; retryLocally?: boolean }
): Promise<'local' | 'queued' | 'browser'> {
  const data = buildOrderLabelData(heldId, lines);
  const labelOpts = orderLabelRenderOpts(data, labelOptionsFromPrintSettings(settings, opts?.storeName));
  const labelsPrinters = printersForRole(settings || null, 'labels');
  const preferred = pickPreferredLabelPrinter(settings);
  const printerName = preferred?.name?.trim() || labelsPrinters[0]?.name?.trim();
  if (!printerName) {
    throw new Error(
      'No label printer configured. Open Settings → Receipts & printers, add your label printer, and enable Labels.'
    );
  }
  const portName =
    ((settings?.printers || []).find((p) => p.name === printerName) as { portName?: string | null } | undefined)
      ?.portName || null;
  const protocol = resolveLabelPrintProtocol(settings, printerName);
  const o = normalizeLabelOptions(labelOpts);

  if (protocol === 'niimbot' || protocol === 'tspl') {
    const rendered = await renderNiimbotLabelPng(orderLabelAsProduct(data), labelOpts);
    if (!rendered.bitmapBase64) throw new Error('Order label raster was empty');
    if (protocol === 'niimbot') {
      await printNiimbotLabelViaAgent({
        printerName,
        portName,
        bitmapBase64: rendered.bitmapBase64,
        widthPx: rendered.widthPx,
        heightPx: rendered.heightPx,
      });
      return 'local';
    }
    const payload = tsplBarcodeFits(data.barcode, o.widthMm)
      ? buildOrderLabelTspl(data, labelOpts)
      : buildTsplBitmapLabel({
          widthMm: o.widthMm,
          heightMm: o.heightMm,
          bitmap: fromBase64(rendered.bitmapBase64),
          widthPx: rendered.widthPx,
          heightPx: rendered.heightPx,
          copies: o.copies,
        });
    return await printViaAgentOrQueue({
      dataBase64: toBase64(payload),
      printerName,
      text: data.barcode,
      retryLocally: opts?.retryLocally,
      jobKind: 'other',
      jobLabel: tsplBarcodeFits(data.barcode, o.widthMm) ? 'order-label-tspl' : 'order-label-tspl-bitmap',
    });
  }

  const payload = buildOrderLabelEscPos(data, labelOpts);
  try {
    return await printViaAgentOrQueue({
      dataBase64: toBase64(payload),
      printerName,
      text: data.barcode,
      retryLocally: opts?.retryLocally,
      jobKind: 'other',
      jobLabel: 'order-label',
    });
  } catch {
    printOrderLabelHtml(data, labelOpts);
    return 'browser';
  }
}

export type { OrderLabelData, OrderLabelLine };
