/** Strip scheme/port and lowercase — keeps www when present. */
export declare function parseHostname(raw?: string | null): string | null;
/** Normalize merchant custom domain (hostname only, lowercase, no scheme/path). */
export declare function normalizeCustomDomain(raw?: string | null): string | null;
/** Host labels to match stored custom_domain against incoming Host (apex ↔ www). */
export declare function customDomainHostVariants(rawHost: string): string[];
/** True when request Host matches stored custom domain (ignores www prefix). */
export declare function customDomainMatches(storedDomain: string | null | undefined, requestHost: string): boolean;
/** Preserve www (and other host labels) — used by the custom-domain wizard. */
export declare function normalizeCustomDomainHost(raw?: string | null): string | null;
/** Basic hostname validation for merchant-entered domains. */
export declare function isValidCustomDomainHost(host: string): boolean;
//# sourceMappingURL=domain.d.ts.map