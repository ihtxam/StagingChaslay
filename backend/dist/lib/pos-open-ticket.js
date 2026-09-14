"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPEN_TICKET_STATUSES = void 0;
exports.isKitchenTicketStatus = isKitchenTicketStatus;
exports.isOpenTicketStatus = isOpenTicketStatus;
exports.isFullyPaidTicket = isFullyPaidTicket;
exports.nextOpenTicketStatus = nextOpenTicketStatus;
exports.decideOpenTicketClose = decideOpenTicketClose;
exports.closeReasonForDecision = closeReasonForDecision;
exports.OPEN_TICKET_STATUSES = ["held", "sent_to_kitchen"];
const FULL_PAY_EPS = 0.05;
function isKitchenTicketStatus(status) {
    return String(status || "").toLowerCase() === "sent_to_kitchen";
}
function isOpenTicketStatus(status) {
    const s = String(status || "").toLowerCase();
    return s === "held" || s === "sent_to_kitchen";
}
function isFullyPaidTicket(cartTotal, paidTotal) {
    const paid = Number(paidTotal);
    if (!Number.isFinite(paid) || paid <= 0)
        return false;
    if (!(cartTotal > 0))
        return false;
    return cartTotal - paid <= FULL_PAY_EPS;
}
/** Once in kitchen, status must not fall back to a plain hold. */
function nextOpenTicketStatus(current, sendToKitchen) {
    if (isKitchenTicketStatus(current) || sendToKitchen)
        return "sent_to_kitchen";
    return "held";
}
function decideOpenTicketClose(input) {
    if (!input.identityMatched)
        return "keep";
    if (input.explicitCancel)
        return "close";
    if (input.paymentSettled === false)
        return "keep";
    const fullyPaid = isFullyPaidTicket(input.cartTotal, input.paidTotal);
    if (isKitchenTicketStatus(input.status)) {
        if (input.settleKitchen === true || fullyPaid)
            return "close";
        return "keep";
    }
    if (fullyPaid)
        return "close";
    return "keep";
}
function closeReasonForDecision(input) {
    if (decideOpenTicketClose(input) !== "close")
        return null;
    if (input.explicitCancel)
        return "cancelled";
    return "paid";
}
//# sourceMappingURL=pos-open-ticket.js.map