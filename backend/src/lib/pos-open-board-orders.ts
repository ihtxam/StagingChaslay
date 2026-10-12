import { and, eq, inArray, isNotNull, or, type SQL } from "drizzle-orm";
import { schema } from "@/db";
import { onlineOrderScopeCondition } from "@/lib/online-order-scope";

/**
 * Open kitchen / fulfillment tickets that All Orders must keep even when they
 * fall outside the selected createdAt / scheduledFor day window.
 * Shop pre-orders (WEB-…) created last week for next Saturday are the usual miss.
 */
export const OPEN_POS_BOARD_STATUSES = [
  "pending",
  "pending_approval",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "awaiting_payment",
] as const;

export function shouldFetchOpenBoardExtras(status?: string): boolean {
  if (!status || status === "all") return true;
  if (status === "completed") return false;
  return (OPEN_POS_BOARD_STATUSES as readonly string[]).includes(status);
}

export function openPosBoardOrdersWhere(merchantId: string, status?: string): SQL {
  const statuses =
    status &&
    status !== "all" &&
    (OPEN_POS_BOARD_STATUSES as readonly string[]).includes(status)
      ? [status]
      : [...OPEN_POS_BOARD_STATUSES];

  return and(
    eq(schema.orders.merchantId, merchantId),
    inArray(schema.orders.orderType, ["pos", "web_shop", "online"]),
    inArray(schema.orders.status, statuses),
    or(onlineOrderScopeCondition(), isNotNull(schema.orders.scheduledFor))!
  )!;
}
