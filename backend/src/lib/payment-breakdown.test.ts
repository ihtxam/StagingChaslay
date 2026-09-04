/**
 * Payment breakdown helpers — run: npx tsx backend/src/lib/payment-breakdown.test.ts
 */
import assert from "node:assert/strict";
import {
  netPaymentBucketsAfterRefund,
  scaleTendersToOrderTotal,
  parsePaymentBreakdown,
} from "./payment-breakdown";

// Stale breakdown sums above order total should scale down.
const oversized = parsePaymentBreakdown(
  [
    { method: "cash", amount: 120 },
    { method: "card", amount: 80 },
  ],
  "mixed",
  100
);
const scaled = scaleTendersToOrderTotal(oversized, 100);
const scaledSum = scaled.reduce((s, t) => s + t.amount, 0);
assert.ok(Math.abs(scaledSum - 100) < 0.02, `expected sum 100, got ${scaledSum}`);
assert.ok(scaled.find((t) => t.method === "cash")!.amount < 120);

// Net buckets after refund should not exceed order total.
const buckets = netPaymentBucketsAfterRefund(
  100,
  0,
  [
    { method: "cash", amount: 120 },
    { method: "card", amount: 80 },
  ],
  "mixed"
);
const bucketSum = [...buckets.values()].reduce((s, v) => s + v, 0);
assert.ok(Math.abs(bucketSum - 100) < 0.02, `expected bucket sum 100, got ${bucketSum}`);

// Partial refund on cash-only order.
const cashOnly = netPaymentBucketsAfterRefund(110, 20, [{ method: "cash", amount: 110 }], "cash");
assert.equal(cashOnly.get("cash"), 90);

console.log("payment-breakdown.test.ts: ok");
