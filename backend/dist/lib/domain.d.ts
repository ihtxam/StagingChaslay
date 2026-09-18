/** Normalize merchant custom domain (hostname only, lowercase, no scheme/path). */
export declare function normalizeCustomDomain(raw?: string | null): string | null;
/** Preserve www (and other host labels) — used by the custom-domain wizard. */
export declare function normalizeCustomDomainHost(raw?: string | null): string | null;
/** Basic hostname validation for merchant-entered domains. */
export declare function isValidCustomDomainHost(host: string): boolean;
//# sourceMappingURL=domain.d.ts.map