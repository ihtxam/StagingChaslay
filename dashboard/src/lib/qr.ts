/**
 * Minimal helpers for receipt QR codes (browser + ESC/POS).
 */

import { publicApi } from '@/lib/api';

/** EC-XXXXXXXX redeem codes (6–12 hex digits after prefix). */
const ECARD_BODY_RE = /EC[-' ]?([0-9A-F]{6,12})/i;

/** Normalize legacy domain typos and receipt path variants. */
export function normalizeReceiptDomain(raw: string): string {
  let base = String(raw || '')
    .trim()
    .replace(/chasly\.com/gi, 'chaslay.com')
    .replace(/^https?:\/\/app\./i, 'https://pay.');
  return base;
}

/** Normalize merchant/env base to .../receipt (legacy configs used .../receipts). */
export function normalizeReceiptPublicBase(raw: string): string {
  let base = normalizeReceiptDomain(raw).replace(/\/$/, '');
  if (/\/receipts$/i.test(base)) {
    base = base.replace(/\/receipts$/i, '/receipt');
  } else if (!/\/receipt$/i.test(base)) {
    base = `${base}/receipt`;
  }
  return base;
}

/** Fix chasly typo and force receipt links onto pay.* (not app.*). */
export function sanitizeReceiptOrigin(raw: string): string {
  let base = normalizeReceiptDomain(raw).replace(/\/+$/, '');
  if (!base) return 'https://pay.chaslay.com';
  base = base.replace(/^https?:\/\/app\./i, 'https://pay.');
  return base;
}

/** Public receipt page origin + /receipt path (no trailing slash). */
export function receiptPublicBase(_origin?: string): string {
  const envBase = import.meta.env.VITE_PUBLIC_RECEIPT_BASE_URL as string | undefined;
  return normalizeReceiptPublicBase(sanitizeReceiptOrigin(envBase || 'https://pay.chaslay.com'));
}

/** Build a public digital-receipt URL for a sale id */
export function buildReceiptUrl(saleId: string, origin?: string): string {
  return `${receiptPublicBase(origin)}/${encodeURIComponent(saleId)}`;
}

/**
 * Extract an e-gift EC-… code from noisy scanner wedge input (URLs, receipt text, UUID fragments).
 */
export function extractGiftCardCode(raw: string): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const m = url.pathname.match(/\/gift\/([^/]+)/i);
      if (m?.[1]) {
        const fromUrl = decodeURIComponent(m[1]).trim();
        const ec = fromUrl.match(ECARD_BODY_RE);
        if (ec) return `EC-${ec[1].toUpperCase()}`;
        return fromUrl;
      }
    }
  } catch {
    /* not a URL */
  }
  const inline = trimmed.match(/\/gift\/([^/?#\s]+)/i);
  if (inline?.[1]) {
    const decoded = decodeURIComponent(inline[1]).trim();
    const ec = decoded.match(ECARD_BODY_RE);
    if (ec) return `EC-${ec[1].toUpperCase()}`;
    return decoded;
  }
  const ec = trimmed.match(ECARD_BODY_RE);
  if (ec) return `EC-${ec[1].toUpperCase()}`;
  return trimmed;
}

/** POS scan wedge normalizer — extracts EC code from messy input. */
export function normalizeScannedPayload(raw: string): string {
  return extractGiftCardCode(raw);
}

/** @deprecated use extractGiftCardCode */
export function parseGiftCardCode(raw: string): string {
  return extractGiftCardCode(raw);
}

/** Compact payload (legacy QR) — redeem code only, e.g. EC9E1E09C. */
export function buildGiftCardRedeemQrPayload(code: string): string {
  const parsed = extractGiftCardCode(code);
  const m = parsed.match(/^EC[-' ]?([0-9A-F]{6,12})$/i);
  if (m) return `EC${m[1].toUpperCase()}`;
  return parsed.replace(/[\s:_\-]+/g, '').toUpperCase() || String(code || '').trim();
}

/** Human-readable + Code128 payload — dashed redeem code, e.g. EC-9E1E09C. */
export function buildGiftCardBarcodePayload(code: string): string {
  const parsed = extractGiftCardCode(code);
  const m = parsed.match(/^EC[-' ]?([0-9A-F]{6,12})$/i);
  if (m) return `EC-${m[1].toUpperCase()}`;
  return parsed.trim() || String(code || '').trim();
}

/** Return the first ref that exists on the public receipt API (backend UUID preferred). */
export async function resolvePublishedReceiptRef(
  backendOrderId: string | null | undefined,
  clientId: string,
  orderNumber?: string | null
): Promise<string | null> {
  const candidates = [
    ...new Set([backendOrderId, orderNumber, clientId].filter(Boolean)),
  ] as string[];
  for (const ref of candidates) {
    try {
      const res = await publicApi.get(`/receipts/${encodeURIComponent(ref)}`);
      if (res.data?.success && res.data?.receipt?.id) {
        return String(res.data.receipt.id);
      }
      if (res.status === 200 && res.data?.receipt) return ref;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

export type EscPosErrorCorrection = 'L' | 'M' | 'Q' | 'H';

/** External PNG QR (works in browser print without npm dep). ECC-M + quiet zone for scan reliability. */
export function qrImageUrl(
  data: string,
  size = 180,
  opts?: { ecc?: EscPosErrorCorrection; margin?: number }
): string {
  const ecc = opts?.ecc ?? 'M';
  const margin = Math.max(0, opts?.margin ?? 4);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=${ecc}&margin=${margin}&data=${encodeURIComponent(
    data
  )}`;
}

/** Thermal receipt QR raster width — ~180px on 80mm (384-dot) paper. */
export const RECEIPT_QR_RASTER_PX_80 = 180;
/** 58mm thermal QR — same visual ratio as 80mm 180px (was 112 @ 150). */
export const RECEIPT_QR_RASTER_PX_58 = 136;

/** Delivery slip QR — full paper width (400px target; 80mm thermal caps at 384 dots). */
export const DELIVERY_SLIP_QR_RASTER_PX_80 = 384;
export const DELIVERY_SLIP_QR_RASTER_PX_58 = 280;

export function receiptQrRasterPx(paperWidthMm?: 58 | 80): number {
  return paperWidthMm === 58 ? RECEIPT_QR_RASTER_PX_58 : RECEIPT_QR_RASTER_PX_80;
}

export function deliverySlipQrRasterPx(paperWidthMm?: 58 | 80): number {
  return paperWidthMm === 58 ? DELIVERY_SLIP_QR_RASTER_PX_58 : DELIVERY_SLIP_QR_RASTER_PX_80;
}

/** Canvas/image pixels → ESC/POS GS v 0 monochrome raster (width padded to 8-dot boundary). */
export function imageDataToEscPosRaster(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  darkThreshold = 160
): Uint8Array {
  const paddedWidth = Math.ceil(width / 8) * 8;
  const bytesPerRow = paddedWidth / 8;
  const raster = new Uint8Array(bytesPerRow * height);
  const cutoff = Math.max(1, Math.min(255, darkThreshold));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < paddedWidth; x++) {
      if (x >= width) continue;
      const i = (y * width + x) * 4;
      const lum = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
      if (lum < cutoff) {
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
    height & 0xff,
    (height >> 8) & 0xff,
  ]);
  return concatBytes(header, raster);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('image load failed'));
    el.src = url;
  });
}

/** Bitmap receipt QR for thermal print (matches Android EscPosImageEncoder path). */
export async function generateReceiptQrRasterEscPos(
  data: string,
  paperWidthMm?: 58 | 80
): Promise<Uint8Array | null> {
  const raw = String(data || '').trim();
  if (!raw || typeof document === 'undefined') return null;
  const size = receiptQrRasterPx(paperWidthMm);
  try {
    const img = await loadImage(qrImageUrl(raw, size, { ecc: 'M', margin: 8 }));
    const w = Math.max(8, img.width);
    const h = Math.max(8, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const { data: pixels } = ctx.getImageData(0, 0, w, h);
    return imageDataToEscPosRaster(pixels, w, h, 128);
  } catch {
    return null;
  }
}

function wrapLabelLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = String(text || '')
    .trim()
    .split(/\s+/);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function drawCenteredLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  width: number,
  lineHeight: number
): number {
  const lines = wrapLabelLines(ctx, label, width - 4);
  ctx.fillStyle = '#000000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const ln of lines) {
    ctx.fillText(ln, x + width / 2, y);
    y += lineHeight;
  }
  return y;
}

/** Single labeled QR block (label centered above QR). */
export async function buildLabeledReceiptQrRasterEscPos(opts: {
  label: string;
  data: string;
  paperWidthMm?: 58 | 80;
  /** Override QR pixel size (defaults to receipt size). */
  qrSizePx?: number;
}): Promise<Uint8Array | null> {
  const raw = String(opts.data || '').trim();
  if (!raw || typeof document === 'undefined') return null;
  const paper = opts.paperWidthMm ?? 80;
  const canvasWidth = paper === 58 ? 280 : 384;
  const qrSize = opts.qrSizePx ?? (paper === 58 ? 120 : 160);
  const labelLineHeight = 14;
  const gap = 6;
  try {
    const img = await loadImage(qrImageUrl(raw, qrSize, { ecc: 'M', margin: 6 }));
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.font = 'bold 12px Arial, sans-serif';
    const labelLines = wrapLabelLines(ctx, opts.label, canvasWidth - 8);
    const labelHeight = Math.max(labelLineHeight, labelLines.length * labelLineHeight);
    canvas.width = canvasWidth;
    canvas.height = labelHeight + gap + qrSize + 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const labelBottom = drawCenteredLabel(ctx, opts.label, 0, 4, canvasWidth, labelLineHeight);
    const qrX = Math.floor((canvasWidth - qrSize) / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, qrX, labelBottom + gap, qrSize, qrSize);
    const { data: pixels } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageDataToEscPosRaster(pixels, canvas.width, canvas.height, 128);
  } catch {
    return null;
  }
}

/** Large labeled QR for delivery driver slip (full paper width). */
export async function buildDeliverySlipQrRasterEscPos(opts: {
  label: string;
  data: string;
  paperWidthMm?: 58 | 80;
}): Promise<Uint8Array | null> {
  const paper = opts.paperWidthMm ?? 80;
  return buildLabeledReceiptQrRasterEscPos({
    ...opts,
    qrSizePx: deliverySlipQrRasterPx(paper),
  });
}

/** Two labeled QRs side-by-side (digital receipt + delivery directions). */
export async function buildDualReceiptQrRasterEscPos(opts: {
  left: { label: string; data: string };
  right: { label: string; data: string };
  paperWidthMm?: 58 | 80;
}): Promise<Uint8Array | null> {
  const leftData = String(opts.left.data || '').trim();
  const rightData = String(opts.right.data || '').trim();
  if (!leftData || !rightData || typeof document === 'undefined') return null;
  const paper = opts.paperWidthMm ?? 80;
  const canvasWidth = paper === 58 ? 280 : 384;
  const gap = paper === 58 ? 10 : 16;
  const colWidth = Math.floor((canvasWidth - gap) / 2);
  const qrSize = paper === 58 ? 108 : 136;
  const labelLineHeight = 13;
  const labelGap = 5;
  try {
    const [leftImg, rightImg] = await Promise.all([
      loadImage(qrImageUrl(leftData, qrSize, { ecc: 'M', margin: 6 })),
      loadImage(qrImageUrl(rightData, qrSize, { ecc: 'M', margin: 6 })),
    ]);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.font = 'bold 11px Arial, sans-serif';
    const leftLabelLines = wrapLabelLines(ctx, opts.left.label, colWidth - 4);
    const rightLabelLines = wrapLabelLines(ctx, opts.right.label, colWidth - 4);
    const labelRows = Math.max(leftLabelLines.length, rightLabelLines.length, 1);
    const labelHeight = labelRows * labelLineHeight + 4;
    canvas.width = canvasWidth;
    canvas.height = labelHeight + labelGap + qrSize + 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawCenteredLabel(ctx, opts.left.label, 0, 4, colWidth, labelLineHeight);
    drawCenteredLabel(ctx, opts.right.label, colWidth + gap, 4, colWidth, labelLineHeight);
    const qrY = labelHeight + labelGap;
    const leftQrX = Math.floor(colWidth / 2 - qrSize / 2);
    const rightQrX = colWidth + gap + Math.floor(colWidth / 2 - qrSize / 2);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(leftImg, leftQrX, qrY, qrSize, qrSize);
    ctx.drawImage(rightImg, rightQrX, qrY, qrSize, qrSize);
    const { data: pixels } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imageDataToEscPosRaster(pixels, canvas.width, canvas.height, 128);
  } catch {
    return null;
  }
}

/** GS ( k fn 69 n — 48=L, 49=M, 50=Q, 51=H (Epson ESC/POS). */
const ESCPOS_EC_BYTE: Record<EscPosErrorCorrection, number> = {
  L: 0x30,
  M: 0x31,
  Q: 0x32,
  H: 0x33,
};

/**
 * ESC/POS QR code (Function 165/167/169/180 - common on Epson-compatible thermals).
 * Returns raw bytes: store QR data + print.
 */
export function escposQrCode(
  data: string,
  moduleSize = 4,
  errorCorrection: EscPosErrorCorrection = 'M'
): Uint8Array {
  const encoder = new TextEncoder();
  const payload = encoder.encode(data);
  const storeLen = payload.length + 3;
  const pL = storeLen & 0xff;
  const pH = (storeLen >> 8) & 0xff;
  const cn = 0x31; // QR
  const model = [0x1d, 0x28, 0x6b, 0x04, 0x00, cn, 0x41, 0x32, 0x00]; // model 2
  const sizeCmd = [0x1d, 0x28, 0x6b, 0x03, 0x00, cn, 0x43, Math.max(1, Math.min(16, moduleSize))];
  const errorLevel = [0x1d, 0x28, 0x6b, 0x03, 0x00, cn, 0x45, ESCPOS_EC_BYTE[errorCorrection]];
  const storeHeader = [0x1d, 0x28, 0x6b, pL, pH, cn, 0x50, 0x30];
  const print = [0x1d, 0x28, 0x6b, 0x03, 0x00, cn, 0x51, 0x30];

  const out = new Uint8Array(
    model.length +
      sizeCmd.length +
      errorLevel.length +
      storeHeader.length +
      payload.length +
      print.length
  );
  let o = 0;
  out.set(model, o);
  o += model.length;
  out.set(sizeCmd, o);
  o += sizeCmd.length;
  out.set(errorLevel, o);
  o += errorLevel.length;
  out.set(storeHeader, o);
  o += storeHeader.length;
  out.set(payload, o);
  o += payload.length;
  out.set(print, o);
  return out;
}

/** ESC/POS Code128 barcode (GS k 73) — subset B, no HRI (label printed separately). */
export function escposCode128(data: string, height = 80, width = 2): Uint8Array {
  const raw = String(data || '').trim();
  if (!raw) return new Uint8Array(0);
  // {B selects Code128 subset B; prefix is consumed by the printer, not scanned.
  const encoded = raw.startsWith('{') ? raw : `{B${raw}`;
  const encoder = new TextEncoder();
  const payload = encoder.encode(encoded);
  if (!payload.length || payload.length > 255) return new Uint8Array(0);
  const alignCenter = new Uint8Array([0x1b, 0x61, 0x01]);
  const alignLeft = new Uint8Array([0x1b, 0x61, 0x00]);
  const heightCmd = new Uint8Array([0x1d, 0x68, Math.max(1, Math.min(255, height))]);
  const widthCmd = new Uint8Array([0x1d, 0x77, Math.max(1, Math.min(6, width))]);
  const hriOff = new Uint8Array([0x1d, 0x48, 0]);
  const printHeader = new Uint8Array([0x1d, 0x6b, 73, payload.length]);
  const lf = new Uint8Array([0x0a]);
  return concatBytes(alignCenter, heightCmd, widthCmd, hriOff, printHeader, payload, lf, alignLeft);
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Table QR (dine-in)
// ---------------------------------------------------------------------------

/** Compact POS scan payload: CHASLAY:T:{merchantSlug}:{tableUuid} */
export function buildTableQrPayload(merchantSlug: string, tableId: string): string {
  const slug = String(merchantSlug || '').trim();
  const tid = String(tableId || '').trim();
  return `CHASLAY:T:${slug}:${tid}`;
}

export type ParsedTableQr = {
  merchantSlug?: string;
  tableId: string;
};

/** Parse table QR from POS wedge or customer phone scan. */
export function parseTableQrPayload(raw: string): ParsedTableQr | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;

  const compact = trimmed.match(/^CHASLAY:T:([^:]+):([a-f0-9-]+)$/i);
  if (compact) {
    return { merchantSlug: compact[1], tableId: compact[2]! };
  }

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const table = url.searchParams.get('table');
      if (table) {
        const parts = url.pathname.split('/').filter(Boolean);
        const shopIdx = parts.indexOf('shop');
        const slug = shopIdx >= 0 ? parts[shopIdx + 1] : undefined;
        return { merchantSlug: slug, tableId: table };
      }
    }
  } catch {
    /* not a URL */
  }

  const inline = trimmed.match(/[?&]table=([a-f0-9-]+)/i);
  if (inline) return { tableId: inline[1]! };

  return null;
}

/** Customer-facing shop URL — opens dine-in menu for a table. */
export function buildTableShopUrl(
  merchantSlug: string,
  tableId: string,
  origin?: string
): string {
  const base = String(origin || (typeof window !== 'undefined' ? window.location.origin : 'https://app.chaslay.com')).replace(/\/$/, '');
  const slug = encodeURIComponent(merchantSlug);
  const table = encodeURIComponent(tableId);
  return `${base}/shop/${slug}/menu?channel=dine_in&table=${table}`;
}

/** Waiter ordering URL — opens waiter app on a specific table (not customer menu). */
export function buildWaiterTableUrl(tableId: string, origin?: string): string {
  const base = String(origin || (typeof window !== 'undefined' ? window.location.origin : 'https://app.chaslay.com')).replace(/\/$/, '');
  return `${base}/merchant/waiter?table=${encodeURIComponent(tableId)}`;
}

/** Parse waiter table deep link (?table=uuid). */
export function parseWaiterTableUrl(raw: string): { tableId: string } | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const table = url.searchParams.get('table');
      if (table) return { tableId: table };
    }
  } catch {
    /* not a URL */
  }
  const inline = trimmed.match(/[?&]table=([a-f0-9-]+)/i);
  if (inline?.[1]) return { tableId: inline[1]! };
  return null;
}
