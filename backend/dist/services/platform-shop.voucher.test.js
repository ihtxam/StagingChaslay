"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Platform shop voucher tests.
 * Run: npx tsx src/services/platform-shop.voucher.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const platform_shop_service_1 = require("./platform-shop.service");
const catalog = [
    {
        id: 'prod-1',
        name: 'Paper',
        description: null,
        price: '49.00',
        discountPercent: null,
        imageUrl: null,
        isActive: true,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    },
];
const baseVoucher = {
    id: 'v-1',
    code: 'HAHA',
    label: null,
    discountPercent: 30,
    discountAmount: null,
    isActive: true,
    maxUses: null,
    usedCount: 0,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
};
const cart = platform_shop_service_1.PlatformShopService.computeCart([{ productId: 'prod-1', quantity: 1 }], [...catalog], baseVoucher);
strict_1.default.equal(cart.subtotal, 49);
strict_1.default.equal(cart.discountAmount, 14.7);
strict_1.default.equal(cart.total, 34.3);
strict_1.default.equal(cart.voucherCode, 'HAHA');
const fixedVoucher = { ...baseVoucher, discountPercent: null, discountAmount: '10.00' };
const fixedCart = platform_shop_service_1.PlatformShopService.computeCart([{ productId: 'prod-1', quantity: 1 }], [...catalog], fixedVoucher);
strict_1.default.equal(fixedCart.discountAmount, 10);
strict_1.default.equal(fixedCart.total, 39);
const zeroPct = { ...baseVoucher, discountPercent: 0, discountAmount: '5.00' };
const zeroPctCart = platform_shop_service_1.PlatformShopService.computeCart([{ productId: 'prod-1', quantity: 1 }], [...catalog], zeroPct);
strict_1.default.equal(zeroPctCart.discountAmount, 5);
console.log('platform-shop voucher tests passed');
//# sourceMappingURL=platform-shop.voucher.test.js.map