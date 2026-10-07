"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Cart free gift tiers — run: cd backend && npx tsx src/lib/cart-free-gift.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const cart_free_gift_ts_1 = require("./cart-free-gift.ts");
const tiers = (0, cart_free_gift_ts_1.normalizeCartGiftTiers)({
    cartGiftTiers: [
        { minCartTotal: 75, productIds: ["a", "b"] },
        { minCartTotal: 120, productIds: ["c"] },
    ],
});
strict_1.default.equal(tiers.length, 2);
strict_1.default.equal(tiers[0].minCartTotal, 75);
const sub = (0, cart_free_gift_ts_1.cartPaidSubtotal)([
    { unitPrice: 40, quantity: 2 },
    { unitPrice: 0, quantity: 1, cartFreeGiftOfferId: "o1", cartFreeGiftTierIndex: 0 },
]);
strict_1.default.equal(sub, 80);
const status = (0, cart_free_gift_ts_1.evaluateCartGiftTiers)({
    tiers,
    subtotal: 74,
    claimedByTier: new Map(),
});
strict_1.default.equal(status[0].unlocked, false);
strict_1.default.equal(status[0].remaining, 1);
strict_1.default.equal(status[1].remaining, 46);
strict_1.default.equal((0, cart_free_gift_ts_1.validateCartFreeGiftLine)({
    offerId: "o1",
    tierIndex: 0,
    productId: "a",
    tiers,
    paidSubtotal: 80,
}), null);
strict_1.default.ok((0, cart_free_gift_ts_1.validateCartFreeGiftLine)({
    offerId: "o1",
    tierIndex: 0,
    productId: "a",
    tiers,
    paidSubtotal: 50,
}));
console.log("cart-free-gift.test.ts OK");
//# sourceMappingURL=cart-free-gift.test.js.map