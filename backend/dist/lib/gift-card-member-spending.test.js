"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Member spending tx types — run: npx tsx backend/src/lib/gift-card-member-spending.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const gift_card_member_spending_1 = require("./gift-card-member-spending");
const types = (0, gift_card_member_spending_1.memberSpendingOrderTransactionTypes)();
strict_1.default.deepEqual(types, [
    "redeem",
    "sell",
    "points_earn",
    "points_redeem",
    "stamp_earn",
    "stamp_reward",
]);
console.log("gift-card-member-spending.test.ts: ok");
//# sourceMappingURL=gift-card-member-spending.test.js.map