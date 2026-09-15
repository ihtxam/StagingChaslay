"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INCOMING_ONLINE_ORDER_STATUSES = void 0;
exports.onlineOrderScopeCondition = onlineOrderScopeCondition;
exports.incomingOnlineOrdersWhere = incomingOnlineOrdersWhere;
const drizzle_orm_1 = require("drizzle-orm");
const db_1 = require("@/db");
/** Active online / QR / kiosk orders shown in Order Hub, Web POS alerts, and incoming poll. */
exports.INCOMING_ONLINE_ORDER_STATUSES = [
    "pending",
    "pending_approval",
    "accepted",
    "preparing",
    "ready",
    "out_for_delivery",
];
/** SQL filter for online shop, legacy online, kiosk, and aggregator tickets. */
function onlineOrderScopeCondition() {
    return (0, drizzle_orm_1.or)((0, drizzle_orm_1.inArray)(db_1.schema.orders.orderType, ["web_shop", "online"]), (0, drizzle_orm_1.inArray)(db_1.schema.orders.orderSource, [
        "online_shop",
        "kiosk",
        "qr_table",
        "justeat",
        "ubereats",
    ]), (0, drizzle_orm_1.sql) `lower(coalesce(${db_1.schema.orders.fulfillmentChannel}, '')) in ('web_shop', 'online')`, (0, drizzle_orm_1.sql) `lower(coalesce(${db_1.schema.orders.fulfillmentChannel}, '')) like '%uber%'`, (0, drizzle_orm_1.sql) `lower(coalesce(${db_1.schema.orders.fulfillmentChannel}, '')) like '%justeat%'`, (0, drizzle_orm_1.sql) `lower(coalesce(${db_1.schema.orders.fulfillmentChannel}, '')) like '%just-eat%'`, (0, drizzle_orm_1.sql) `lower(coalesce(${db_1.schema.orders.fulfillmentChannel}, '')) like '%doordash%'`, (0, drizzle_orm_1.sql) `lower(coalesce(${db_1.schema.orders.fulfillmentChannel}, '')) like '%deliveroo%'`);
}
function incomingOnlineOrdersWhere(merchantId, statuses = exports.INCOMING_ONLINE_ORDER_STATUSES) {
    const statusFilter = statuses.length === 1
        ? (0, drizzle_orm_1.sql) `${db_1.schema.orders.status} = ${statuses[0]}`
        : (0, drizzle_orm_1.inArray)(db_1.schema.orders.status, [...statuses]);
    return (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_1.schema.orders.merchantId, merchantId), onlineOrderScopeCondition(), statusFilter);
}
//# sourceMappingURL=online-order-scope.js.map