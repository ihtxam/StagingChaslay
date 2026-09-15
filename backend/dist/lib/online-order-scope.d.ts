import { type SQL } from "drizzle-orm";
/** Active online / QR / kiosk orders shown in Order Hub, Web POS alerts, and incoming poll. */
export declare const INCOMING_ONLINE_ORDER_STATUSES: readonly ["pending", "pending_approval", "accepted", "preparing", "ready", "out_for_delivery"];
export type IncomingOnlineOrderStatus = (typeof INCOMING_ONLINE_ORDER_STATUSES)[number];
/** SQL filter for online shop, legacy online, kiosk, and aggregator tickets. */
export declare function onlineOrderScopeCondition(): SQL;
export declare function incomingOnlineOrdersWhere(merchantId: string, statuses?: readonly string[]): SQL;
//# sourceMappingURL=online-order-scope.d.ts.map