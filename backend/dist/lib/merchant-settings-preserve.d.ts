/**
 * Settings PATCH/PUT helpers: empty/undefined secrets and tax fields must not
 * clobber existing merchant values (password change, unrelated store push, etc.).
 */
export declare function isMaskedSecret(value: unknown): boolean;
/** True when the incoming value is a real secret the caller intends to write. */
export declare function shouldWriteCredential(value: unknown): value is string;
/**
 * Incoming tax rate for a PATCH. Returns undefined to preserve the existing DB
 * value (empty / omitted). Throws on out-of-range numbers.
 */
export declare function incomingTaxRateOrPreserve(value: unknown, field: string): string | undefined;
//# sourceMappingURL=merchant-settings-preserve.d.ts.map