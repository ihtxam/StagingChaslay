"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Payment breakdown helpers — run: npx tsx backend/src/lib/payment-breakdown.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const payment_breakdown_1 = require("./payment-breakdown");
// Stale breakdown sums above order total should scale down.
const oversized = (0, payment_breakdown_1.parsePaymentBreakdown)([
    { method: "cash", amount: 120 },
    { method: "card", amount: 80 },
], "mixed", 100);
const scaled = (0, payment_breakdown_1.scaleTendersToOrderTotal)(oversized, 100);
const scaledSum = scaled.reduce((s, t) => s + t.amount, 0);
strict_1.default.ok(Math.abs(scaledSum - 100) < 0.02, `expected sum 100, got ${scaledSum}`);
strict_1.default.ok(scaled.find((t) => t.method === "cash").amount < 120);
// Net buckets after refund should not exceed order total.
const buckets = (0, payment_breakdown_1.netPaymentBucketsAfterRefund)(100, 0, [
    { method: "cash", amount: 120 },
    { method: "card", amount: 80 },
], "mixed");
const bucketSum = [...buckets.values()].reduce((s, v) => s + v, 0);
strict_1.default.ok(Math.abs(bucketSum - 100) < 0.02, `expected bucket sum 100, got ${bucketSum}`);
// Partial refund on cash-only order.
const cashOnly = (0, payment_breakdown_1.netPaymentBucketsAfterRefund)(110, 20, [{ method: "cash", amount: 110 }], "cash");
strict_1.default.equal(cashOnly.get("cash"), 90);
// Leftover pay_later breakdown after cash/card collect must surface the collected tender.
const leftoverLater = (0, payment_breakdown_1.parsePaymentBreakdown)([{ method: "pay_later", amount: 25 }], "cash", 25);
strict_1.default.equal(leftoverLater.length, 1);
strict_1.default.equal(leftoverLater[0].method, "cash");
const laterColon = (0, payment_breakdown_1.parsePaymentBreakdown)(null, "pay_later:card", 40);
strict_1.default.equal(laterColon.length, 1);
strict_1.default.equal(laterColon[0].method, "card");
const unpaidLater = (0, payment_breakdown_1.parsePaymentBreakdown)([{ method: "pay_later", amount: 12 }], "pay_later", 12);
strict_1.default.equal(unpaidLater[0].method, "pay_later");
console.log("payment-breakdown.test.ts: ok");
//# sourceMappingURL=payment-breakdown.test.js.map