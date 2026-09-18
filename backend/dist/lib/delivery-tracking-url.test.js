"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Guest order status URL — run: npx tsx backend/src/lib/delivery-tracking-url.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const delivery_tracking_url_1 = require("./delivery-tracking-url");
const merchant = { slug: 'gandhi', subdomain: null, customDomain: null };
const withToken = (0, delivery_tracking_url_1.buildGuestOrderTrackingUrl)(merchant, 'order-1', 'abc');
strict_1.default.equal(withToken.includes('/shop/gandhi/order/order-1'), true);
strict_1.default.equal(withToken.includes('track=abc'), true);
const pickup = (0, delivery_tracking_url_1.buildGuestOrderTrackingUrl)(merchant, 'order-1', null);
strict_1.default.equal(pickup.includes('/shop/gandhi/order/order-1'), true);
strict_1.default.equal(pickup.includes('track='), false);
console.log('delivery-tracking-url.test.ts ok');
//# sourceMappingURL=delivery-tracking-url.test.js.map