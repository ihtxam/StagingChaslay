"use strict";
/** Canonical public digital-receipt URL helpers (pay.rebornsense.com/receipt/{id}). */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeReceiptOrigin = sanitizeReceiptOrigin;
exports.normalizeReceiptPublicBase = normalizeReceiptPublicBase;
exports.buildReceiptPublicUrl = buildReceiptPublicUrl;
exports.normalizeReceiptPublicUrl = normalizeReceiptPublicUrl;
exports.receiptPublicUrl = receiptPublicUrl;
exports.receiptPublicBaseUrl = receiptPublicBaseUrl;
exports.normalizeReceiptDomain = normalizeReceiptDomain;
const brand_1 = require("@/lib/brand");
const DEFAULT_RECEIPT_ORIGIN = brand_1.PAY_ORIGIN || `https://pay.${brand_1.BRAND_DOMAIN}`;
/** Fix common typos and force receipt pages onto pay.* (not app.*). */
function sanitizeReceiptOrigin(raw) {
    let base = String(raw || "").trim();
    if (!base)
        return DEFAULT_RECEIPT_ORIGIN;
    base = base.replace(/\/+$/, "");
    base = (0, brand_1.rewriteLegacyPublicHost)(base);
    // Receipt viewer lives on pay.* — app.* is the merchant panel
    base = base.replace(/^https?:\/\/app\./i, "https://pay.");
    return base || DEFAULT_RECEIPT_ORIGIN;
}
/** Normalize to .../receipt (legacy configs used .../receipts). */
function normalizeReceiptPublicBase(raw) {
    const origin = sanitizeReceiptOrigin(String(raw || process.env.PUBLIC_RECEIPT_BASE_URL || DEFAULT_RECEIPT_ORIGIN).trim());
    let base = origin.replace(/\/+$/, "");
    if (/\/receipts$/i.test(base)) {
        base = base.replace(/\/receipts$/i, "/receipt");
    }
    else if (!/\/receipt$/i.test(base)) {
        base = `${base}/receipt`;
    }
    return base;
}
function buildReceiptPublicUrl(ref, base) {
    const id = String(ref || "").trim();
    if (!id)
        return normalizeReceiptPublicBase(base);
    return `${normalizeReceiptPublicBase(base)}/${encodeURIComponent(id)}`;
}
function normalizeReceiptPublicUrl(url, fallbackRef) {
    const raw = String(url || "").trim();
    if (!raw && fallbackRef) {
        return buildReceiptPublicUrl(fallbackRef);
    }
    if (!raw)
        return normalizeReceiptPublicBase(null);
    try {
        const parsed = new URL(raw);
        const origin = sanitizeReceiptOrigin(`${parsed.protocol}//${parsed.host}`);
        const parts = parsed.pathname.split("/").filter(Boolean);
        const ref = parts[parts.length - 1] ||
            fallbackRef ||
            "";
        if (ref)
            return buildReceiptPublicUrl(ref, origin);
        return normalizeReceiptPublicBase(origin);
    }
    catch {
        if (fallbackRef)
            return buildReceiptPublicUrl(fallbackRef);
        return normalizeReceiptPublicBase(null);
    }
}
/** Alias used across backend services. */
function receiptPublicUrl(ref) {
    return buildReceiptPublicUrl(ref);
}
function receiptPublicBaseUrl() {
    return normalizeReceiptPublicBase(process.env.PUBLIC_RECEIPT_BASE_URL);
}
/** @deprecated use sanitizeReceiptOrigin — kept for imports that normalize host strings */
function normalizeReceiptDomain(raw) {
    return sanitizeReceiptOrigin(raw);
}
//# sourceMappingURL=receipt-public-url.js.map