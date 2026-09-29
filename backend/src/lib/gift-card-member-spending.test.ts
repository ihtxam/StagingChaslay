/**
 * Member spending tx types — run: npx tsx backend/src/lib/gift-card-member-spending.test.ts
 */
import assert from "node:assert/strict";
import { memberSpendingOrderTransactionTypes } from "./gift-card-member-spending";

const types = memberSpendingOrderTransactionTypes();
assert.deepEqual(types, [
  "redeem",
  "sell",
  "points_earn",
  "points_redeem",
  "stamp_earn",
  "stamp_reward",
]);

console.log("gift-card-member-spending.test.ts: ok");
