import type { KioskMenuCategory } from '@/lib/kiosk-api';

export type KioskMenuItem = KioskMenuCategory['items'][number];

/** Camera / BarcodeDetector formats for product barcodes */
export const KIOSK_PRODUCT_SCAN_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'codabar',
  'itf',
  'qr_code',
];

/** QR and 2D codes used on membership / loyalty cards */
export const KIOSK_MEMBERSHIP_SCAN_FORMATS = [
  'qr_code',
  'aztec',
  'data_matrix',
  'pdf417',
];

export function buildKioskProductScanIndex(menu: KioskMenuCategory[]): Map<string, KioskMenuItem> {
  const map = new Map<string, KioskMenuItem>();
  for (const cat of menu) {
    for (const item of cat.items) {
      const barcode = String(item.barcode || '').trim();
      const sku = String(item.sku || '').trim();
      if (barcode) {
        map.set(barcode, item);
        map.set(barcode.toLowerCase(), item);
      }
      if (sku) {
        map.set(sku, item);
        map.set(sku.toLowerCase(), item);
      }
    }
  }
  return map;
}

export function findKioskProductByScanCode(
  index: Map<string, KioskMenuItem>,
  raw: string
): KioskMenuItem | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  const candidates = [trimmed, trimmed.toLowerCase(), digits].filter(Boolean);
  for (const key of candidates) {
    const hit = index.get(key);
    if (hit) return hit;
  }
  return null;
}
