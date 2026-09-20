/** Scan / barcode matching for POS (primary + extra barcodes + SKU). */

export function productScanCodes(p: {
  barcode?: string | null;
  sku?: string | null;
  extraBarcodes?: string[] | null;
}): string[] {
  const extra = Array.isArray(p.extraBarcodes) ? p.extraBarcodes : [];
  return [p.barcode, p.sku, ...extra]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
}

export function productMatchesScan(
  p: { barcode?: string | null; sku?: string | null; extraBarcodes?: string[] | null; name?: string },
  code: string
): boolean {
  const q = code.trim();
  if (!q) return false;
  const lower = q.toLowerCase();
  const digits = q.replace(/\s/g, '');
  return productScanCodes(p).some(
    (c) => c === q || c === digits || c.toLowerCase() === lower
  );
}

export function parseExtraBarcodes(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s || '').trim()).filter(Boolean).slice(0, 20);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }
  return [];
}
