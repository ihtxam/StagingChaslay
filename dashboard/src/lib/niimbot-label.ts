import JsBarcode from 'jsbarcode';
import type { LabelPrintOptions, LabelProduct } from '@/lib/barcode-labels';
import { labelMetaLine, normalizeLabelOptions } from '@/lib/barcode-labels';
import type { PosPrintSettingsClient } from '@/lib/webpos-receipt';

/** Niimbot thermal head resolution (203 dpi ≈ 8 dots/mm). */
export const NIIMBOT_DPMM = 8;
/** B21 / D11 / B1 printhead width. Wider canvases must be clamped to the head. */
export const NIIMBOT_PRINTHEAD_PX = 384;
/** K3: 80 mm effective print width at 203 dpi (FCC-ID 2ARXBK3A manual) = 640 dots. */
export const NIIMBOT_K3_PRINTHEAD_PX = 640;

export function niimbotPrintheadPx(printerName?: string | null): number {
  const n = String(printerName || '').toLowerCase();
  return /\bk3\b|k3w|k3_w/.test(n) ? NIIMBOT_K3_PRINTHEAD_PX : NIIMBOT_PRINTHEAD_PX;
}

export function isNiimbotPrinterName(name?: string | null): boolean {
  const n = String(name || '').toLowerCase();
  return /niimbot|niimbus|\bk3\b|\bb21\b|\bd11\b|\bb1\b|\bd110\b/.test(n);
}

export function extractNiimbotComPort(...values: Array<string | null | undefined>): string | null {
  for (const raw of values) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const stripped = text.replace(/^\\\\\.\\/i, '').replace(/:$/, '');
    if (/^COM\d+$/i.test(stripped)) return stripped.toUpperCase();
    const paren = text.match(/\((COM\d+)\)/i);
    if (paren) return paren[1]!.toUpperCase();
    const inline = text.match(/\b(COM\d+)\b/i);
    if (inline) return inline[1]!.toUpperCase();
  }
  return null;
}

export function extractNiimbotUsbPort(...values: Array<string | null | undefined>): string | null {
  for (const raw of values) {
    const text = String(raw || '').trim();
    if (!text) continue;
    if (/^USB\d+$/i.test(text) || /^USBPRINT$/i.test(text)) return text.toUpperCase();
    const inline = text.match(/\b(USB\d+)\b/i);
    if (inline) return inline[1]!.toUpperCase();
    if (/USBPRINT/i.test(text)) return 'USBPRINT';
  }
  return null;
}

/**
 * Port the Test bars POST must send. Selected USB005 / USBPRINT wins — never
 * rewrite it to a live Bluetooth COM6. Selected COM6 stays COM6. Only when the
 * saved port is empty do we use the matching live queue's portName.
 */
export function resolveNiimbotTestPortName(
  profile: { name?: string | null; portName?: string | null },
  livePrinters: Array<{ name?: string | null; portName?: string | null }> = []
): string | undefined {
  const name = String(profile.name || '').trim();
  const saved = String(profile.portName || '').trim();
  const savedUsb = extractNiimbotUsbPort(saved);
  if (savedUsb) return saved;

  const savedCom = extractNiimbotComPort(saved);
  if (savedCom) return savedCom;

  const nameCom = extractNiimbotComPort(name);
  if (nameCom) return nameCom;

  const liveExact = livePrinters.find(
    (ap) => ap.name === name && (!saved || String(ap.portName || '') === saved)
  );
  const liveByName = livePrinters.find((ap) => ap.name === name);
  const live = liveExact || liveByName;
  return saved || String(live?.portName || '').trim() || undefined;
}

/** What the Print Agent reports back about one label job. */
export type NiimbotBarsResult = {
  printer?: string;
  path?: string;
  profile?: string;
  baud?: number | null;
  portSource?: string;
  bitmapNonZeroBytes?: number | null;
  rasterRowBytes?: number | null;
  dimensionHex?: string;
  confirmed?: boolean;
};

/** Shown wherever the agent reported nothing. Never a bare '?'. */
export const NIIMBOT_NOT_REPORTED = 'n/a';

/*
 * Kept as compact tokens rather than prose: this string lands inside a
 * translated sentence the merchant screenshots, and a clause of English in the
 * middle of a French toast reads like a bug. `port=queue` says the same thing
 * in every locale.
 */
const PORT_SOURCE_LABEL: Record<string, string> = {
  selected: 'port=selected',
  queue: 'port=queue-bound',
  discovered: 'port=by-name',
};

/** e.g. `com COM8 @ 115200 baud (port=queue-bound)`. */
export function niimbotTransportLabel(result: NiimbotBarsResult): string {
  const path = String(result.path || '').trim();
  if (!path) return NIIMBOT_NOT_REPORTED;
  const parts = [path];
  const port = String(result.printer || '').trim();
  if (port && port.toUpperCase() !== path.toUpperCase() && /^COM\d+$/i.test(port)) {
    parts.push(port.toUpperCase());
  }
  if (result.baud) parts.push(`@ ${result.baud} baud`);
  const source = PORT_SOURCE_LABEL[String(result.portSource || '')];
  if (source) parts.push(`(${source})`);
  return parts.join(' ');
}

/**
 * Fills the Test bars headline.
 *
 * Every value comes from the agent's reply, and anything it did not report
 * reads `n/a` rather than `?`: for a week the merchant screenshotted
 * `via ? · inkBytes=? · rowBytes=? · dim=?` and we could not tell a missing
 * value from a broken template. The final sweep replaces any placeholder the
 * template has and this function does not, so raw braces can never ship either.
 */
export function renderNiimbotBarsToast(
  template: string,
  opts: { name: string; result: NiimbotBarsResult; protocol: string; invert?: boolean }
): string {
  const { name, result, protocol } = opts;
  const fallbackProfile = opts.invert ? `${protocol}+invert` : protocol;
  const values: Record<string, string> = {
    name: String(name || NIIMBOT_NOT_REPORTED),
    path: niimbotTransportLabel(result),
    profile: String(result.profile || fallbackProfile || NIIMBOT_NOT_REPORTED),
    ink:
      typeof result.bitmapNonZeroBytes === 'number'
        ? String(result.bitmapNonZeroBytes)
        : NIIMBOT_NOT_REPORTED,
    row:
      typeof result.rasterRowBytes === 'number'
        ? String(result.rasterRowBytes)
        : NIIMBOT_NOT_REPORTED,
    dim: String(result.dimensionHex || NIIMBOT_NOT_REPORTED),
  };
  let text = String(template || '');
  for (const [key, value] of Object.entries(values)) {
    text = text.split(`{${key}}`).join(value);
  }
  return text.replace(/\{[a-zA-Z0-9_]+\}/g, NIIMBOT_NOT_REPORTED);
}

export function shouldTestNiimbotBars(profile: {
  name?: string | null;
  portName?: string | null;
  printLabels?: boolean;
}): boolean {
  const name = String(profile.name || '');
  const port = String(profile.portName || '');
  if (isNiimbotPrinterName(name) || isNiimbotPrinterName(port)) return true;
  if (profile.printLabels && extractNiimbotComPort(name, port)) return true;
  return false;
}

export function labelPrinterUsesNiimbot(
  settings?: PosPrintSettingsClient | null,
  printerName?: string | null
): boolean {
  const profiles = (settings?.printers || []).filter((p) => p.enabled !== false && p.printLabels);
  const profile =
    profiles.find((p) => p.name === printerName) ||
    profiles.find((p) => isNiimbotPrinterName(p.name)) ||
    profiles[0];
  if (profile && isNiimbotPrinterName(profile.name)) return true;
  if (profile && profile.printLabels && extractNiimbotComPort(profile.name, profile.portName)) return true;
  return isNiimbotPrinterName(printerName);
}

export function labelPixelSize(
  opts: LabelPrintOptions,
  printerName?: string | null
): { widthPx: number; heightPx: number } {
  const o = normalizeLabelOptions(opts);
  const headPx = niimbotPrintheadPx(printerName);
  let widthPx = Math.max(8, Math.round(o.widthMm * NIIMBOT_DPMM));
  let heightPx = Math.max(8, Math.round(o.heightMm * NIIMBOT_DPMM));
  if (widthPx > headPx) {
    const scale = headPx / widthPx;
    widthPx = headPx;
    heightPx = Math.max(8, Math.round(heightPx * scale));
  }
  return { widthPx, heightPx };
}

async function drawBarcodeOnCanvasAsync(
  ctx: CanvasRenderingContext2D,
  barcode: string,
  x: number,
  y: number,
  maxWidth: number,
  height: number
): Promise<number> {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svg, barcode, {
      format: 'CODE128',
      displayValue: false,
      height,
      width: 2,
      margin: 0,
    });
  } catch {
    return y;
  }
  const svgData = new XMLSerializer().serializeToString(svg);
  const img = new Image();
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgData)}`;
  return new Promise((resolve) => {
    img.onload = () => {
      const scale = Math.min(1, maxWidth / Math.max(img.width, 1));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      ctx.drawImage(img, x + (maxWidth - w) / 2, y, w, h);
      resolve(y + h);
    };
    img.onerror = () => resolve(y);
    img.src = url;
  });
}

/** Render one product label to a PNG data URL for Niimbot printing. */
export async function renderNiimbotLabelPng(
  product: LabelProduct,
  opts: LabelPrintOptions,
  printerName?: string | null
): Promise<{ imageBase64: string; bitmapBase64: string; widthPx: number; heightPx: number }> {
  if (typeof document === 'undefined') {
    throw new Error('Label rendering requires a browser');
  }
  const o = normalizeLabelOptions(opts);
  const { widthPx, heightPx } = labelPixelSize(o, printerName);
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
  if (o.showProductName && product.name) {
    ctx.font = `600 ${Math.max(10, Math.round(lineH * 0.85))}px system-ui,sans-serif`;
    const words = product.name.slice(0, 40);
    ctx.fillText(words, widthPx / 2, y, innerW);
    y += lineH;
  }
  const meta = labelMetaLine(product, o);
  if (meta) {
    ctx.font = `${Math.max(8, Math.round(lineH * 0.65))}px system-ui,sans-serif`;
    ctx.fillText(meta, widthPx / 2, y, innerW);
    y += Math.round(lineH * 0.85);
  }

  const barH = Math.max(24, Math.round((heightPx - y - pad) * 0.55));
  y = await drawBarcodeOnCanvasAsync(ctx, product.barcode, pad, y, innerW, barH);

  if (o.showBarcodeNumber) {
    ctx.font = `${Math.max(9, Math.round(lineH * 0.7))}px ui-monospace,monospace`;
    ctx.fillText(product.barcode, widthPx / 2, Math.min(y + 2, heightPx - lineH), innerW);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const imageBase64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  const bitmap = canvasToNiimbotBitmap(ctx.getImageData(0, 0, widthPx, heightPx), widthPx, heightPx);
  let bin = '';
  for (let i = 0; i < bitmap.length; i++) bin += String.fromCharCode(bitmap[i]!);
  const bitmapBase64 = btoa(bin);
  return { imageBase64, bitmapBase64, widthPx, heightPx };
}

/** Packed 1-bit rows (MSB = left), matching niimprint line encoding. */
export function canvasToNiimbotBitmap(
  image: ImageData,
  widthPx: number,
  heightPx: number
): Uint8Array {
  const rowBytes = Math.ceil(widthPx / 8);
  const out = new Uint8Array(rowBytes * heightPx);
  const data = image.data;
  for (let y = 0; y < heightPx; y++) {
    for (let x = 0; x < widthPx; x++) {
      const i = (y * widthPx + x) * 4;
      const lum = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
      const print = lum < 200;
      if (!print) continue;
      const byteIndex = y * rowBytes + (x >> 3);
      const bit = 7 - (x & 7);
      out[byteIndex] = (out[byteIndex] || 0) | (1 << bit);
    }
  }
  return out;
}
