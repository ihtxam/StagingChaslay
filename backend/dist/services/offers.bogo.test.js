"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * BOGO offer math — run: cd backend && npx tsx src/services/offers.bogo.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const offers_service_1 = require("./offers.service");
const offer = {
    id: "test-bogo",
    merchantId: "m1",
    name: "Buy 4 get 5th free",
    offerType: "bogo",
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
const result = offers_service_1.OffersService.evaluateCart([offer], lines, new Date(), "dine_in");
strict_1.default.equal(result.discount, 13.5, "5th item (most expensive) should be free when 4 of another SKU qualify");
const fiveSame = offers_service_1.OffersService.evaluateCart([offer], [{ productId: "a", categoryId: null, name: "A", unitPrice: 9.5, quantity: 5 }], new Date(), "dine_in");
strict_1.default.equal(fiveSame.discount, 9.5, "5 same items should free one unit");
const fourOnly = offers_service_1.OffersService.evaluateCart([offer], [{ productId: "a", categoryId: null, name: "A", unitPrice: 9.5, quantity: 4 }], new Date(), "dine_in");
strict_1.default.equal(fourOnly.discount, 0, "4 items alone should not trigger free slot");
console.log("offers.bogo.test.ts: ok");
//# sourceMappingURL=offers.bogo.test.js.map