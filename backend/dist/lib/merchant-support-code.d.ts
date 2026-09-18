import type { getDb } from "@/db";
type Db = ReturnType<typeof getDb>;
/** Normalize merchant country to a short support prefix (CH, UK, DE, …). */
export declare function normalizeSupportCountryPrefix(country?: string | null): string;
export declare function formatMerchantSupportCode(prefix: string, seq: number): string;
/** Assign the next support code in a country series, e.g. CH-001, UK-042. */
export declare function assignMerchantSupportCode(db: Db, country?: string | null): Promise<string>;
export {};
//# sourceMappingURL=merchant-support-code.d.ts.map