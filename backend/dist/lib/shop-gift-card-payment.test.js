"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Gift card online payment guards — run: cd backend && npx tsx src/lib/shop-gift-card-payment.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const adyen_result_codes_ts_1 = require("./adyen-result-codes.ts");
strict_1.default.equal((0, adyen_result_codes_ts_1.isAdyenPaymentSuccess)("Authorised"), true);
strict_1.default.equal((0, adyen_result_codes_ts_1.isAdyenPaymentSuccess)("Cancelled"), false);
strict_1.default.equal((0, adyen_result_codes_ts_1.isAdyenPaymentSuccess)("Refused"), false);
strict_1.default.equal((0, adyen_result_codes_ts_1.isAdyenPaymentSuccess)(""), false);
console.log("shop-gift-card-payment.test.ts OK");
//# sourceMappingURL=shop-gift-card-payment.test.js.map