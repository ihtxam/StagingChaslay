/**
 * POS open-ticket lifecycle — source of truth until paid or closed.
 *
 * A ticket is created on Hold or Send to kitchen. It MUST stay listed
 * on the till until one of:
 *   - full payment covering the open cart
 *   - explicit cancel with a reason
 *   - explicit transfer that empties this ticket (table / dish move)
 *
 * Kitchen tickets (sent_to_kitchen) are never closed by a stale session id,
 * a missing amount, or a partial payment. ODS/KDS are projections only.
 */

export type OpenTicketStatus = "held" | "sent_to_kitchen";

export type TicketCloseInput = {
  status: string;
  cartTotal: number;
  paidTotal?: number | null;
  settleKitchen?: boolean;
  explicitCancel?: boolean;
  identityMatched: boolean;
};

export type TicketCloseDecision = "keep" | "close";

const FULL_PAY_EPS = 0.05;

export function isKitchenTicketStatus(status?: string | null): boolean {
  return String(status || "").toLowerCase() === "sent_to_kitchen";
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
  const fullyPaid = isFullyPaidTicket(input.cartTotal, input.paidTotal);
  if (isKitchenTicketStatus(input.status)) {
    if (input.settleKitchen === true || fullyPaid) return "close";
    return "keep";
  }
  if (fullyPaid) return "close";
  return "keep";
}
