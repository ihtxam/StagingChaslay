/**
 * Run: cd backend && npx tsx src/lib/pos-fulfillment-channel.test.ts
 */
import assert from "node:assert/strict";
import { resolvePosOrderFulfillmentChannel } from "./pos-fulfillment-channel";

// Bistro walk-in: Sur place in DB but #6351 + WP-… + 2.6% VAT split → takeaway
assert.equal(
  resolvePosOrderFulfillmentChannel(
    {
      orderType: "pos",
      fulfillmentChannel: "dine_in",
      orderNumber: "WP-MHX5QNH0BE",
      ticketDisplay: "#6351",
      subtotal: 8.67,
      taxAmount: 0.23,
    },
    { taxIncludedInPrice: true, taxTakeawayRate: 2.6, taxDineInRate: 8.1 }
  ),
  "takeaway"
);

assert.equal(
  resolvePosOrderFulfillmentChannel(
    {
      orderType: "pos",
      fulfillmentChannel: "dine_in",
      tableLabel: "T3",
      subtotal: 8.23,
      taxAmount: 0.67,
    },
    { taxIncludedInPrice: true, taxTakeawayRate: 2.6, taxDineInRate: 8.1 }
  ),
  "dine_in"
);

assert.equal(
  resolvePosOrderFulfillmentChannel(
    {
      orderType: "pos",
      fulfillmentChannel: "dine_in",
      orderNumber: "DI-ABC-0001",
      ticketDisplay: "D-042",
      subtotal: 8.23,
      taxAmount: 0.67,
    },
    { taxIncludedInPrice: true, taxTakeawayRate: 2.6, taxDineInRate: 8.1 }
  ),
  "dine_in"
);

assert.equal(
  resolvePosOrderFulfillmentChannel({
    orderType: "web_shop",
    fulfillmentChannel: "dine_in",
  }),
  "dine_in"
);

console.log("pos-fulfillment-channel.test.ts ok");
