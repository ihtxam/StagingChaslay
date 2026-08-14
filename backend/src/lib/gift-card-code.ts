/**
 * Parse scanned / pasted gift-card codes (plain EC-… codes or /gift/{code} URLs).
 */
export function parseGiftCardCode(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const pathMatch = url.pathname.match(/\/gift\/([^/]+)/i);
      if (pathMatch?.[1]) {
        return decodeURIComponent(pathMatch[1]).trim();
      }
    }
  } catch {
    /* not a URL */
  }

  const inlineMatch = trimmed.match(/\/gift\/([^/?#\s]+)/i);
  if (inlineMatch?.[1]) {
    return decodeURIComponent(inlineMatch[1]).trim();
  }

  return trimmed;
}

/** Stable QR / barcode payload — redeem code only (POS scanners). */
export function buildGiftCardRedeemQrPayload(code: string): string {
  return parseGiftCardCode(code) || String(code || "").trim();
}

/** Optional public deep link shown in emails (not required for POS redeem). */
export function buildGiftCardRedeemUrl(code: string): string {
  const parsed = buildGiftCardRedeemQrPayload(code);
  const base = (
    process.env.GIFT_CARD_PUBLIC_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    "https://app.chaslay.com"
  )
    .replace(/\/$/, "")
    .replace(/^https?:\/\/pay\./i, "https://app.");
  return `${base}/gift/${encodeURIComponent(parsed)}`;
}
