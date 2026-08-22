/**
 * Extract an e-gift EC-… code from noisy scanner wedge input (URLs, receipt text, UUID fragments).
 */
export declare function extractGiftCardCode(raw: string): string;
/** Alias used by POS scan handlers. */
export declare function normalizeScannedPayload(raw: string): string;
/** @deprecated use extractGiftCardCode */
export declare function parseGiftCardCode(raw: string): string;
/** Compact payload (legacy QR) — redeem code only, e.g. EC9E1E09C. */
export declare function buildGiftCardRedeemQrPayload(code: string): string;
/** Human-readable + Code128 payload — dashed redeem code, e.g. EC-9E1E09C. */
export declare function buildGiftCardBarcodePayload(code: string): string;
/** Lookup keys for e-card rows (accepts compact, dashed, and legacy formats). */
export declare function ecardLookupCandidates(raw: string): string[];
/** New e-gift cards: EC- + 8 hex chars (existing 12-hex cards still valid). */
export declare function generateEcardCode(): string;
/** Optional public deep link shown in emails (not used on thermal QR/barcode). */
export declare function buildGiftCardRedeemUrl(code: string): string;
//# sourceMappingURL=gift-card-code.d.ts.map