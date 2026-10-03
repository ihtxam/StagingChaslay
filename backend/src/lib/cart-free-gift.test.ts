/**
 * Cart free gift tiers — run: cd backend && npx tsx src/lib/cart-free-gift.test.ts
 */
import assert from "node:assert/strict";
import {
  cartPaidSubtotal,
  evaluateCartGiftTiers,
  normalizeCartGiftTiers,
  validateCartFreeGiftLine,
} from "./cart-free-gift.ts";

const tiers = normalizeCartGiftTiers({
  cartGiftTiers: [
    { minCartTotal: 75, productIds: ["a", "b"] },
    { minCartTotal: 120, productIds: ["c"] },
  ],
});
assert.equal(tiers.length, 2);
assert.equal(tiers[0].minCartTotal, 75);

const sub = cartPaidSubtotal([
  { unitPrice: 40, quantity: 2 },
  { unitPrice: 0, quantity: 1, cartFreeGiftOfferId: "o1", cartFreeGiftTierIndex: 0 },
]);
assert.equal(sub, 80);

const status = evaluateCartGiftTiers({
  tiers,
  subtotal: 74,
  claimedByTier: new Map(),
});
assert.equal(status[0].unlocked, false);
assert.equal(status[0].remaining, 1);
assert.equal(status[1].remaining, 46);

assert.equal(
  validateCartFreeGiftLine({
    offerId: "o1",
    tierIndex: 0,
    productId: "a",
    tiers,
    paidSubtotal: 80,
  }),
  null
);
assert.ok(
  validateCartFreeGiftLine({
    offerId: "o1",
    tierIndex: 0,
    productId: "a",
    tiers,
    paidSubtotal: 50,
  })
);

console.log("cart-free-gift.test.ts OK");
