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
  clientId: string
): Promise<string | null> {
  const candidates = [...new Set([backendOrderId, clientId].filter(Boolean))] as string[];
  for (const ref of candidates) {
    try {
      await publicApi.get(`/receipts/${encodeURIComponent(ref)}`);
      return ref;
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/** External PNG QR (works in browser print without npm dep) */
export function qrImageUrl(data: string, size = 180): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=L&data=${encodeURIComponent(
    data
  )}`;
}

/** Thermal receipt QR raster width — ~25% of 80mm printable (384 dots), bitmap path. */
export const RECEIPT_QR_RASTER_PX_80 = 150;
export const RECEIPT_QR_RASTER_PX_58 = 112;

export function receiptQrRasterPx(paperWidthMm?: 58 | 80): number {
  return paperWidthMm === 58 ? RECEIPT_QR_RASTER_PX_58 : RECEIPT_QR_RASTER_PX_80;
}

/** Canvas/image pixels → ESC/POS GS v 0 monochrome raster (width padded to 8-dot boundary). */
export function imageDataToEscPosRaster(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Uint8Array {
  const paddedWidth = Math.ceil(width / 8) * 8;
  const bytesPerRow = paddedWidth / 8;
  const raster = new Uint8Array(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < paddedWidth; x++) {
      if (x >= width) continue;
      const i = (y * width + x) * 4;
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
    const img = await loadImage(qrImageUrl(raw, size));
    const w = Math.max(8, img.width);
    const h = Math.max(8, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const { data: pixels } = ctx.getImageData(0, 0, w, h);
    return imageDataToEscPosRaster(pixels, w, h);
  } catch {
    return null;
  }
}

export type EscPosErrorCorrection = 'L' | 'M' | 'Q' | 'H';

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
