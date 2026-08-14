import crypto from "crypto";

/** EC-XXXXXXXX redeem codes (6–12 hex digits after prefix). */
const ECARD_BODY_RE = /EC[-' ]?([0-9A-F]{6,12})/i;

/**
 * Extract an e-gift EC-… code from noisy scanner wedge input (URLs, receipt text, UUID fragments).
 */
export function extractGiftCardCode(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return "";

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const pathMatch = url.pathname.match(/\/gift\/([^/]+)/i);
      if (pathMatch?.[1]) {
        const fromUrl = decodeURIComponent(pathMatch[1]).trim();
        const ec = fromUrl.match(ECARD_BODY_RE);
        if (ec) return `EC-${ec[1].toUpperCase()}`;
        return fromUrl;
      }
    }
  } catch {
    /* not a URL */
  }

  const inlineGift = trimmed.match(/\/gift\/([^/?#\s]+)/i);
  if (inlineGift?.[1]) {
    const decoded = decodeURIComponent(inlineGift[1]).trim();
    const ec = decoded.match(ECARD_BODY_RE);
    if (ec) return `EC-${ec[1].toUpperCase()}`;
    return decoded;
  }

  const ec = trimmed.match(ECARD_BODY_RE);
  if (ec) return `EC-${ec[1].toUpperCase()}`;

  return trimmed;
}

/** Alias used by POS scan handlers. */
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
  return parsed.replace(/[\s:_\-]+/g, "").toUpperCase() || String(code || "").trim();
}

/** Human-readable + Code128 payload — dashed redeem code, e.g. EC-9E1E09C. */
export function buildGiftCardBarcodePayload(code: string): string {
  const parsed = extractGiftCardCode(code);
  const m = parsed.match(/^EC[-' ]?([0-9A-F]{6,12})$/i);
  if (m) return `EC-${m[1].toUpperCase()}`;
  return parsed.trim() || String(code || "").trim();
}

/** Lookup keys for e-card rows (accepts compact, dashed, and legacy formats). */
export function ecardLookupCandidates(raw: string): string[] {
  const extracted = extractGiftCardCode(raw);
  const compact = buildGiftCardRedeemQrPayload(extracted || raw);
  const out = new Set<string>();

  for (const v of [String(raw || "").trim(), extracted, compact]) {
    if (v) {
      out.add(v);
      out.add(v.toUpperCase());
      out.add(v.toLowerCase());
    }
  }

  const hexFromCompact = compact.match(/^EC([0-9A-F]{6,12})$/i);
  if (hexFromCompact) {
    const hex = hexFromCompact[1].toUpperCase();
    out.add(`EC-${hex}`);
    out.add(hex);
  }

  const hexFromDashed = extracted.match(/^EC[-' ]?([0-9A-F]{6,12})$/i);
  if (hexFromDashed) {
    const hex = hexFromDashed[1].toUpperCase();
    out.add(`EC-${hex}`);
    out.add(`EC${hex}`);
    out.add(hex);
  }

  return [...out].filter(Boolean);
}

/** New e-gift cards: EC- + 8 hex chars (existing 12-hex cards still valid). */
export function generateEcardCode(): string {
  return `EC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

/** Optional public deep link shown in emails (not used on thermal QR/barcode). */
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
