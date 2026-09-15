/**
 * Gift card addon flag helpers — run: npx tsx backend/src/lib/gift-card-addon.test.ts
 */
import assert from "node:assert/strict";
import { isGiftCardAddonEnabled, isGiftCardsLicensed } from "./gift-card-addon";

assert.equal(isGiftCardAddonEnabled(true), true);
assert.equal(isGiftCardAddonEnabled(false), false);
assert.equal(isGiftCardAddonEnabled(1), true);
assert.equal(isGiftCardAddonEnabled(0), false);
assert.equal(isGiftCardAddonEnabled("1"), true);
assert.equal(isGiftCardAddonEnabled("true"), true);
assert.equal(isGiftCardAddonEnabled("t"), true);
assert.equal(isGiftCardAddonEnabled(undefined), false);
assert.equal(isGiftCardAddonEnabled(null), false);

assert.equal(isGiftCardsLicensed({ giftCardAddonEnabled: true, features: [] }), true);
assert.equal(isGiftCardsLicensed({ giftCardAddonEnabled: false, features: null }), true);
assert.equal(isGiftCardsLicensed({ giftCardAddonEnabled: false, features: ["gift_cards"] }), true);
assert.equal(isGiftCardsLicensed({ giftCardAddonEnabled: false, features: ["pos_gift_cards"] }), true);
assert.equal(isGiftCardsLicensed({ giftCardAddonEnabled: false, features: ["loyalty"] }), false);

console.log("gift-card-addon.test.ts: ok");
