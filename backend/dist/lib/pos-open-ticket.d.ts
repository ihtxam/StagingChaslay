/**
 * POS open-ticket ledger — source of truth until paid or closed.
 *
 * A ticket is created on Hold or Send to kitchen. It MUST stay listed
 * on the till until one of:
 *   - collected payment covering the open cart
 *   - explicit cancel with a reason
 *   - explicit transfer that empties this ticket (table / dish move)
 *
 * Rows are never deleted. They are only soft-closed (closed_at + reason).
 * Kitchen tickets (sent_to_kitchen) are never closed by a stale session id,
 * a missing amount, a pay-later / invoice sale, or a partial payment.
 * ODS/KDS are projections only.
 */
export type OpenTicketStatus = "held" | "sent_to_kitchen";
export type TicketCloseReason = "paid" | "cancelled" | "transferred" | "deleted" | "superseded";
export type TicketCloseInput = {
    status: string;
    cartTotal: number;
    paidTotal?: number | null;
    settleKitchen?: boolean;
    explicitCancel?: boolean;
    identityMatched: boolean;
    /**
     * False for pay-later / invoice — the cart total is recorded but money
     * was not collected, so the open ticket must stay.
     */
    paymentSettled?: boolean;
};
export type TicketCloseDecision = "keep" | "close";
export declare const OPEN_TICKET_STATUSES: readonly ["held", "sent_to_kitchen"];
export declare function isKitchenTicketStatus(status?: string | null): boolean;
export declare function isOpenTicketStatus(status?: string | null): boolean;
export declare function isFullyPaidTicket(cartTotal: number, paidTotal?: number | null): boolean;
/** Once in kitchen, status must not fall back to a plain hold. */
export declare function nextOpenTicketStatus(current: string | null | undefined, sendToKitchen: boolean): OpenTicketStatus;
export declare function decideOpenTicketClose(input: TicketCloseInput): TicketCloseDecision;
export declare function closeReasonForDecision(input: TicketCloseInput): TicketCloseReason | null;
//# sourceMappingURL=pos-open-ticket.d.ts.map