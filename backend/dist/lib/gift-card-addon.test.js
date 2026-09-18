"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Gift card addon flag helpers — run: npx tsx backend/src/lib/gift-card-addon.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const gift_card_addon_1 = require("./gift-card-addon");
strict_1.default.equal((0, gift_card_addon_1.isGiftCardAddonEnabled)(true), true);
strict_1.default.equal((0, gift_card_addon_1.isGiftCardAddonEnabled)(false), false);
strict_1.default.equal((0, gift_card_addon_1.isGiftCardAddonEnabled)(1), true);
strict_1.default.equal((0, gift_card_addon_1.isGiftCardAddonEnabled)(0), false);
strict_1.default.equal((0, gift_card_addon_1.isGiftCardAddonEnabled)("1"), true);
strict_1.default.equal((0, gift_card_addon_1.isGiftCardAddonEnabled)("true"), true);
strict_1.default.equal((0, gift_card_addon_1.isGiftCardAddonEnabled)("t"), true);
strict_1.default.equal((0, gift_card_addon_1.isGiftCardAddonEnabled)(undefined), false);
strict_1.default.equal((0, gift_card_addon_1.isGiftCardAddonEnabled)(null), false);
strict_1.default.equal((0, gift_card_addon_1.isGiftCardsLicensed)({ giftCardAddonEnabled: true, features: [] }), true);
strict_1.default.equal((0, gift_card_addon_1.isGiftCardsLicensed)({ giftCardAddonEnabled: false, features: null }), true);
strict_1.default.equal((0, gift_card_addon_1.isGiftCardsLicensed)({ giftCardAddonEnabled: false, features: ["gift_cards"] }), true);
strict_1.default.equal((0, gift_card_addon_1.isGiftCardsLicensed)({ giftCardAddonEnabled: false, features: ["pos_gift_cards"] }), true);
strict_1.default.equal((0, gift_card_addon_1.isGiftCardsLicensed)({ giftCardAddonEnabled: false, features: ["loyalty"] }), false);
console.log("gift-card-addon.test.ts: ok");
//# sourceMappingURL=gift-card-addon.test.js.map