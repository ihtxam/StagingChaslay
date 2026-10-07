/** Transactional shop order emails always use platform mailco when configured (never merchant Brevo). */
export declare const PLATFORM_MAILCO_EMAIL_TYPES: Set<string>;
export declare function isPlatformMailcoEmailType(emailType?: string | null): boolean;
/** Error thrown when mailco API rejects a send — preserves HTTP status for routing decisions. */
export declare class MailcoSendError extends Error {
    readonly status?: number;
    readonly code?: string;
    constructor(message: string, opts?: {
        status?: number;
        code?: string;
    });
}
/**
 * When false (default), platform mailco sends never fall back to Brevo — failures are logged and thrown.
 * Set MAILCO_BREVO_FALLBACK=1 (or true/yes) to allow Brevo only on transient mailco outages (5xx/429/timeouts).
 */
export declare function isMailcoBrevoFallbackEnabled(): boolean;
/** True when mailco failed transiently and Brevo fallback is appropriate (not config errors). */
export declare function isTransientMailcoError(error: unknown): boolean;
//# sourceMappingURL=mailco-routing.d.ts.map