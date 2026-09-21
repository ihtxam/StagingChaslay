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

/** Alternate forms for scanner vs stored barcode (UPC/EAN leading zero, etc.). */
export function barcodeMatchVariants(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const variants = new Set<string>([trimmed, trimmed.toLowerCase()]);
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return [...variants];
  variants.add(digits);
  if (digits.length === 12) variants.add(`0${digits}`);
  if (digits.length === 13 && digits.startsWith('0')) variants.add(digits.slice(1));
  const stripped = digits.replace(/^0+/, '') || digits;
  variants.add(stripped);
  return [...variants];
}

function variantsIntersect(a: string[], b: string[]): boolean {
  const setB = new Set(b);
  return a.some((v) => setB.has(v));
}

export function productMatchesScan(
  p: { barcode?: string | null; sku?: string | null; extraBarcodes?: string[] | null; name?: string },
  code: string
): boolean {
  const q = code.trim();
  if (!q) return false;
  const lower = q.toLowerCase();
  const qVariants = barcodeMatchVariants(q);
  return productScanCodes(p).some((c) => {
    if (c === q || c.toLowerCase() === lower) return true;
    return variantsIntersect(barcodeMatchVariants(c), qVariants);
  });
}

/** True when idle auto-submit should treat search input as a barcode scan (not name browse). */
export function looksLikeRetailBarcodeInput(raw: string): boolean {
  const code = raw.trim();
  if (!code || /\s/.test(code)) return false;
  const digits = code.replace(/\D/g, '');
  if (digits.length >= 8 && digits.length === code.replace(/[-\s]/g, '').length) return true;
  if (/^[A-Za-z0-9][A-Za-z0-9._-]{7,}$/.test(code)) return true;
  return false;
}

export function tokenizedProductSearchMatch(
  name: string,
  brand: string | null | undefined,
  query: string
): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = `${name} ${brand || ''}`.toLowerCase();
  return tokens.every((tok) => hay.includes(tok));
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
