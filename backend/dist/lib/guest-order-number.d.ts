export declare function parseOrderMetaFromNotes(notes?: string | null): {
    ticketDisplay?: string;
    tabNumber?: string;
};
/**
 * Guest-facing primary order reference.
 * Prefers kitchen shout / tab number over opaque WP-/DI- backend ids.
 */
export declare function guestOrderNumber(opts: {
    orderNumber?: string | null;
    orderDisplay?: string | null;
    tabNumber?: string | null;
}): string;
/** True when a value is safe to show on the customer pickup board (ODS). */
export declare function isGuestFacingOdsNumber(value: unknown): boolean;
/** Normalize a kitchen ticket key for ODS push; returns empty when not guest-facing. */
export declare function resolveOdsPushNumber(value: unknown): string;
//# sourceMappingURL=guest-order-number.d.ts.map