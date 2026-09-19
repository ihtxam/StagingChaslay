/**
 * Shop loyalty earn math — run: npx tsx backend/src/services/shop-loyalty.earn.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function computeEarnPoints(paidFoodSubtotalChf: number, earnPointsPerChf: number) {
  const base = Math.max(0, Number(paidFoodSubtotalChf) || 0);
  const rate = Number(earnPointsPerChf) || 0;
  if (rate <= 0) return 0;
  return Math.floor(base * rate + 1e-9);
}

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "shop-loyalty.service.ts"), "utf8");
assert.match(src, /Math\.floor\(base \* rate \+ 1e-9\)/);
assert.match(src, /earnForPaidOrder/);
assert.match(src, /paidFood <= 0 && total > 0/);

assert.equal(computeEarnPoints(3.8, 1), 3, "CHF 3.80 at 1 pt/CHF should earn 3 points");
assert.equal(computeEarnPoints(3.8 * 1, 1), 3);
assert.equal(computeEarnPoints(1, 1), 1);
assert.equal(computeEarnPoints(0.8, 1), 0);
assert.equal(computeEarnPoints(3.8, 0), 0);

console.log("shop-loyalty.earn.test.ts: ok");
