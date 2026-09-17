import {
  buildOrderLabelData,
  orderLabelMetaLine,
  type OrderLabelData,
  type OrderLabelLine,
} from '@/lib/order-label-barcode';
import {
  normalizeLabelOptions,
  parseLabelHeightMm,
  parseLabelWidthMm,
  type LabelPrintOptions,
} from '@/lib/barcode-labels';
import { concatBytes, escposCode128 } from '@/lib/qr';
import { escposCp850Encode, ESC_CODEPAGE_CP850 } from '@/lib/escpos-encode';
import { printViaAgentOrQueue } from '@/lib/webpos-print-relay';
import { printNiimbotLabelViaAgent } from '@/lib/print-agent';
import { labelPrinterUsesNiimbot, labelPixelSize } from '@/lib/niimbot-label';
import { labelPrinterUsesTspl } from '@/lib/tspl-label';
import { buildTsplCommandList, encodeTsplCommands } from '@/lib/tspl-label-core';
import { printersForRole, type PosPrintSettingsClient } from '@/lib/webpos-receipt';
import JsBarcode from 'jsbarcode';

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
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
  parts.push(new Uint8Array([0x1b, 0x64, 0x02]));
  parts.push(new Uint8Array([0x1d, 0x56, 0x41, 0x00]));
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

async function renderNiimbotOrderLabelPng(
  data: OrderLabelData,
  opts: LabelPrintOptions
): Promise<{ bitmapBase64: string; widthPx: number; heightPx: number }> {
  if (typeof document === 'undefined') throw new Error('Label rendering requires a browser');
  const o = normalizeLabelOptions(opts);
  const { widthPx, heightPx } = labelPixelSize(o);
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const pad = Math.max(2, Math.round(widthPx * 0.04));
  let y = pad;
  const innerW = widthPx - pad * 2;
  const lineH = Math.max(10, Math.round(heightPx * 0.12));

  if (o.showStoreName && o.storeName) {
    ctx.font = `bold ${Math.max(9, Math.round(lineH * 0.75))}px system-ui,sans-serif`;
    ctx.fillText(o.storeName.slice(0, 28), widthPx / 2, y, innerW);
    y += lineH;
  }
  if (o.showProductName && data.productName) {
    ctx.font = `600 ${Math.max(10, Math.round(lineH * 0.85))}px system-ui,sans-serif`;
    ctx.fillText(data.productName.slice(0, 40), widthPx / 2, y, innerW);
    y += lineH;
  }
  const meta = orderLabelMetaLine(data);
  if (meta) {
    ctx.font = `${Math.max(8, Math.round(lineH * 0.65))}px system-ui,sans-serif`;
    ctx.fillText(meta, widthPx / 2, y, innerW);
    y += Math.round(lineH * 0.85);
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, data.barcode, { format: 'CODE128', displayValue: false, height: 36, width: 2, margin: 0 });
  const svgData = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
  await new Promise<void>((resolve) => {
    img.onload = () => {
      const barH = Math.max(24, Math.round((heightPx - y - pad) * 0.55));
      const scale = Math.min(1, innerW / Math.max(img.width, 1));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      ctx.drawImage(img, pad + (innerW - w) / 2, y, w, h);
      y += h + 2;
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });

  if (o.showBarcodeNumber) {
    ctx.font = `${Math.max(8, Math.round(lineH * 0.65))}px ui-monospace,monospace`;
    ctx.fillText(data.barcode.slice(0, 32), widthPx / 2, Math.min(y, heightPx - lineH), innerW);
  }

  const imageData = ctx.getImageData(0, 0, widthPx, heightPx);
  const rowBytes = Math.ceil(widthPx / 8);
  const bitmap = new Uint8Array(rowBytes * heightPx);
  const px = imageData.data;
  for (let row = 0; row < heightPx; row++) {
    for (let x = 0; x < widthPx; x++) {
      const i = (row * widthPx + x) * 4;
      const lum = px[i]! * 0.299 + px[i + 1]! * 0.587 + px[i + 2]! * 0.114;
      if (lum >= 200) continue;
      const byteIndex = row * rowBytes + (x >> 3);
      bitmap[byteIndex] = (bitmap[byteIndex] || 0) | (1 << (7 - (x & 7)));
    }
  }
  let bin = '';
  for (let i = 0; i < bitmap.length; i++) bin += String.fromCharCode(bitmap[i]!);
  return { bitmapBase64: btoa(bin), widthPx, heightPx };
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
  const labelOpts = labelOptionsFromPrintSettings(settings, opts?.storeName);
  const labelsPrinters = printersForRole(settings || null, 'labels');
  const labelProfile = labelsPrinters[0];
  const printerName = labelProfile?.name?.trim();
  if (!printerName) {
    throw new Error(
      'No label printer configured. Open Settings → Receipts & printers, add your label printer, and enable Labels.'
    );
  }
  const portName = (settings?.printers || []).find((p) => p.name === printerName)?.portName || null;
  const useNiimbot = labelPrinterUsesNiimbot(settings, printerName);
  const useTspl = !useNiimbot && labelPrinterUsesTspl(settings, printerName);

  if (useTspl) {
    const payload = buildOrderLabelTspl(data, labelOpts);
    return await printViaAgentOrQueue({
      dataBase64: toBase64(payload),
      printerName,
      text: data.barcode,
      retryLocally: opts?.retryLocally,
      jobKind: 'other',
      jobLabel: 'order-label-tspl',
    });
  }

  if (useNiimbot) {
    const rendered = await renderNiimbotOrderLabelPng(data, labelOpts);
    await printNiimbotLabelViaAgent({
      printerName,
      portName,
      bitmapBase64: rendered.bitmapBase64,
      widthPx: rendered.widthPx,
      heightPx: rendered.heightPx,
    });
    return 'local';
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
