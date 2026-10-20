/**
 * Run: npx tsx backend/src/services/profit-margin.service.test.ts
 */
import assert from "node:assert/strict";

function marginPct(revenue: number, profit: number): number | null {
  if (revenue <= 0.0005) return profit > 0 ? 100 : null;
  return Math.round((profit / revenue) * 10000) / 100;
}

assert.equal(marginPct(100, 40), 40);
assert.equal(marginPct(0, 0), null);
assert.equal(marginPct(50, 60), 120);

console.log("profit-margin.service tests passed");
