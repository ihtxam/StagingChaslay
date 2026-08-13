/** Canonical public digital-receipt URL helpers (pay.chaslay.com/receipt/{id}). */

const DEFAULT_RECEIPT_ORIGIN = "https://pay.chaslay.com";

/** Fix common typos and force receipt pages onto pay.* (not app.*). */
export function sanitizeReceiptOrigin(raw: string): string {
  let base = String(raw || "").trim();
  if (!base) return DEFAULT_RECEIPT_ORIGIN;

  base = base.replace(/\/+$/, "");
  // chasly.com → chaslay.com (user-reported typo in QR/email links)
  base = base.replace(/chasly\.com/gi, "chaslay.com");
  // Receipt viewer lives on pay.* — app.* is the merchant panel
  base = base.replace(/^https?:\/\/app\./i, "https://pay.");
  return base || DEFAULT_RECEIPT_ORIGIN;
}

/** Normalize to .../receipt (legacy configs used .../receipts). */
export function normalizeReceiptPublicBase(raw?: string | null): string {
  const origin = sanitizeReceiptOrigin(
    String(raw || process.env.PUBLIC_RECEIPT_BASE_URL || DEFAULT_RECEIPT_ORIGIN).trim()
  );
  let base = origin.replace(/\/+$/, "");
  if (/\/receipts$/i.test(base)) {
    base = base.replace(/\/receipts$/i, "/receipt");
  } else if (!/\/receipt$/i.test(base)) {
    base = `${base}/receipt`;
  }
  return base;
}

export function buildReceiptPublicUrl(ref: string, base?: string | null): string {
  const id = String(ref || "").trim();
  if (!id) return normalizeReceiptPublicBase(base);
  return `${normalizeReceiptPublicBase(base)}/${encodeURIComponent(id)}`;
}

export function normalizeReceiptPublicUrl(url: string, fallbackRef?: string): string {
  const raw = String(url || "").trim();
  if (!raw && fallbackRef) {
    return buildReceiptPublicUrl(fallbackRef);
  }
  if (!raw) return normalizeReceiptPublicBase(null);

  try {
    const parsed = new URL(raw);
    const origin = sanitizeReceiptOrigin(`${parsed.protocol}//${parsed.host}`);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const ref =
      parts[parts.length - 1] ||
      fallbackRef ||
      "";
    if (ref) return buildReceiptPublicUrl(ref, origin);
    return normalizeReceiptPublicBase(origin);
  } catch {
    if (fallbackRef) return buildReceiptPublicUrl(fallbackRef);
    return normalizeReceiptPublicBase(null);
  }
}

/** Alias used across backend services. */
export function receiptPublicUrl(ref: string): string {
  return buildReceiptPublicUrl(ref);
}

export function receiptPublicBaseUrl(): string {
  return normalizeReceiptPublicBase(process.env.PUBLIC_RECEIPT_BASE_URL);
}

/** @deprecated use sanitizeReceiptOrigin — kept for imports that normalize host strings */
export function normalizeReceiptDomain(raw: string): string {
  return sanitizeReceiptOrigin(raw);
}
