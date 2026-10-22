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
 *
 * ## Reconciliation protocol (all clients: WebPOS, Waiter, sync)
 *
 * 1. **Open** — `POST /merchant/pos/held` creates/updates one ledger row per ticket identity.
 * 2. **Terminal states** — every path must close the ledger row (`closed_at` + reason):
 *    - **paid** — full payment or `settleKitchen` after kitchen ticket (`releaseHeldByIdentity`)
 *    - **cancelled** — `cancelHeld` or matching CXL sale
 *    - **transferred** — empty cart / table move
 * 3. **Payment** — `push-sales` (paid) and Order Center collect both call `releaseHeldByIdentity`
 *    with `settleKitchen: true` and `paymentSettled: true` when money is collected.
 * 4. **List / poll** — `GET /merchant/pos/held` reconciles stale rows (paid/cancelled heal) **before**
 *    any optional KDS restore; restore never runs for tickets that already have a paid POS sale.
 * 5. **KDS** — dismissed on paid release and cancel so open KDS cannot recreate ghosts.
 */

export type OpenTicketStatus = "held" | "sent_to_kitchen";

export type TicketCloseReason =
  | "paid"
  | "cancelled"
  | "transferred"
  | "deleted"
  | "superseded";

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

export const OPEN_TICKET_STATUSES = ["held", "sent_to_kitchen"] as const;

const FULL_PAY_EPS = 0.05;

export function isKitchenTicketStatus(status?: string | null): boolean {
  return String(status || "").toLowerCase() === "sent_to_kitchen";
}

export function isOpenTicketStatus(status?: string | null): boolean {
  const s = String(status || "").toLowerCase();
  return s === "held" || s === "sent_to_kitchen";
}

export function isFullyPaidTicket(cartTotal: number, paidTotal?: number | null): boolean {
  const paid = Number(paidTotal);
  if (!Number.isFinite(paid) || paid <= 0) return false;
  if (!(cartTotal > 0)) return false;
  return cartTotal - paid <= FULL_PAY_EPS;
}

/** Once in kitchen, status must not fall back to a plain hold. */
export function nextOpenTicketStatus(
  current: string | null | undefined,
  sendToKitchen: boolean
): OpenTicketStatus {
  if (isKitchenTicketStatus(current) || sendToKitchen) return "sent_to_kitchen";
  return "held";
}

export function decideOpenTicketClose(input: TicketCloseInput): TicketCloseDecision {
  if (!input.identityMatched) return "keep";
  if (input.explicitCancel) return "close";
  if (input.paymentSettled === false) return "keep";
  const fullyPaid = isFullyPaidTicket(input.cartTotal, input.paidTotal);
  if (isKitchenTicketStatus(input.status)) {
    if (input.settleKitchen === true || fullyPaid) return "close";
    return "keep";
  }
  if (fullyPaid) return "close";
  return "keep";
}

export function closeReasonForDecision(input: TicketCloseInput): TicketCloseReason | null {
  if (decideOpenTicketClose(input) !== "close") return null;
  if (input.explicitCancel) return "cancelled";
  return "paid";
}
