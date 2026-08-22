/** Canonical public digital-receipt URL helpers (pay.chaslay.com/receipt/{id}). */
/** Fix common typos and force receipt pages onto pay.* (not app.*). */
export declare function sanitizeReceiptOrigin(raw: string): string;
/** Normalize to .../receipt (legacy configs used .../receipts). */
export declare function normalizeReceiptPublicBase(raw?: string | null): string;
export declare function buildReceiptPublicUrl(ref: string, base?: string | null): string;
export declare function normalizeReceiptPublicUrl(url: string, fallbackRef?: string): string;
/** Alias used across backend services. */
export declare function receiptPublicUrl(ref: string): string;
export declare function receiptPublicBaseUrl(): string;
/** @deprecated use sanitizeReceiptOrigin — kept for imports that normalize host strings */
export declare function normalizeReceiptDomain(raw: string): string;
//# sourceMappingURL=receipt-public-url.d.ts.map