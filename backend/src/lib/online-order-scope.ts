import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { schema } from "@/db";

/** Active online / QR / kiosk orders shown in Order Hub, Web POS alerts, and incoming poll. */
export const INCOMING_ONLINE_ORDER_STATUSES = [
  "pending",
  "pending_approval",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
] as const;

export type IncomingOnlineOrderStatus = (typeof INCOMING_ONLINE_ORDER_STATUSES)[number];

/** SQL filter for online shop, legacy online, kiosk, and aggregator tickets. */
export function onlineOrderScopeCondition(): SQL {
  return or(
    inArray(schema.orders.orderType, ["web_shop", "online"]),
    inArray(schema.orders.orderSource, [
      "online_shop",
      "kiosk",
      "qr_table",
      "justeat",
      "ubereats",
    ]),
    sql`lower(coalesce(${schema.orders.fulfillmentChannel}, '')) in ('web_shop', 'online')`,
    sql`lower(coalesce(${schema.orders.fulfillmentChannel}, '')) like '%uber%'`,
    sql`lower(coalesce(${schema.orders.fulfillmentChannel}, '')) like '%justeat%'`,
    sql`lower(coalesce(${schema.orders.fulfillmentChannel}, '')) like '%just-eat%'`,
    sql`lower(coalesce(${schema.orders.fulfillmentChannel}, '')) like '%doordash%'`,
    sql`lower(coalesce(${schema.orders.fulfillmentChannel}, '')) like '%deliveroo%'`
  )!;
}

export function incomingOnlineOrdersWhere(
  merchantId: string,
  statuses: readonly string[] = INCOMING_ONLINE_ORDER_STATUSES
): SQL {
  const statusFilter =
    statuses.length === 1
      ? sql`${schema.orders.status} = ${statuses[0]}`
      : inArray(schema.orders.status, [...statuses]);

  return and(
    eq(schema.orders.merchantId, merchantId),
    onlineOrderScopeCondition(),
    statusFilter
  )!;
}
