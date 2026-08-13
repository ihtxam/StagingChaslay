/**
 * Minimal helpers for receipt QR codes (browser + ESC/POS).
 */

import { publicApi } from '@/lib/api';

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
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    data
  )}`;
}

/**
 * ESC/POS QR code (Function 165/167/169/180 - common on Epson-compatible thermals).
 * Returns raw bytes: store QR data + print.
 */
export function escposQrCode(data: string, moduleSize = 4): Uint8Array {
  const encoder = new TextEncoder();
  const payload = encoder.encode(data);
  const storeLen = payload.length + 3;
  const pL = storeLen & 0xff;
  const pH = (storeLen >> 8) & 0xff;
  const cn = 0x31; // QR
  const model = [0x1d, 0x28, 0x6b, 0x04, 0x00, cn, 0x41, 0x32, 0x00]; // model 2
  const sizeCmd = [0x1d, 0x28, 0x6b, 0x03, 0x00, cn, 0x43, Math.max(1, Math.min(16, moduleSize))];
  const errorLevel = [0x1d, 0x28, 0x6b, 0x03, 0x00, cn, 0x45, 0x31]; // M
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
