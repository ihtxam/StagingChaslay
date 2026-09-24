/**
 * BOGO offer math — run: cd backend && npx tsx src/services/offers.bogo.test.ts
 */
import assert from "node:assert/strict";
import { OffersService } from "./offers.service";

const offer = {
  id: "test-bogo",
  merchantId: "m1",
  name: "Buy 4 get 5th free",
  offerType: "bogo" as const,
  rules: { buyQty: 4, getQty: 1, getDiscountPercent: 100, sameProductOnly: true },
  isActive: true,
  validFrom: null,
  validTo: null,
  scheduleMode: null,
  daysOfWeek: [],
  timeStart: null,
  timeEnd: null,
  channels: [],
  productIds: [],
  categoryIds: [],
  stackable: false,
  priority: 0,
  badgeLabel: "4+1",
  staffIds: [],
};

const lines = [
  { productId: "a", categoryId: null, name: "A", unitPrice: 9.5, quantity: 4 },
  { productId: "b", categoryId: null, name: "B", unitPrice: 13.5, quantity: 1 },
];

const result = OffersService.evaluateCart([offer as any], lines, new Date(), "dine_in");
assert.equal(result.discount, 13.5, "5th item (most expensive) should be free when 4 of another SKU qualify");

const fiveSame = OffersService.evaluateCart(
  [offer as any],
  [{ productId: "a", categoryId: null, name: "A", unitPrice: 9.5, quantity: 5 }],
  new Date(),
  "dine_in"
);
assert.equal(fiveSame.discount, 9.5, "5 same items should free one unit");

const fourOnly = OffersService.evaluateCart(
  [offer as any],
  [{ productId: "a", categoryId: null, name: "A", unitPrice: 9.5, quantity: 4 }],
  new Date(),
  "dine_in"
);
assert.equal(fourOnly.discount, 0, "4 items alone should not trigger free slot");

console.log("offers.bogo.test.ts: ok");
