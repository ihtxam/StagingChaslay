/**
 * Platform shop voucher tests.
 * Run: npx tsx src/services/platform-shop.voucher.test.ts
 */
import assert from 'node:assert/strict';
import { PlatformShopService } from './platform-shop.service';

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
] as const;

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

const cart = PlatformShopService.computeCart(
  [{ productId: 'prod-1', quantity: 1 }],
  [...catalog],
  baseVoucher
);
assert.equal(cart.subtotal, 49);
assert.equal(cart.discountAmount, 14.7);
assert.equal(cart.total, 34.3);
assert.equal(cart.voucherCode, 'HAHA');

const fixedVoucher = { ...baseVoucher, discountPercent: null, discountAmount: '10.00' };
const fixedCart = PlatformShopService.computeCart(
  [{ productId: 'prod-1', quantity: 1 }],
  [...catalog],
  fixedVoucher
);
assert.equal(fixedCart.discountAmount, 10);
assert.equal(fixedCart.total, 39);

const zeroPct = { ...baseVoucher, discountPercent: 0, discountAmount: '5.00' };
const zeroPctCart = PlatformShopService.computeCart(
  [{ productId: 'prod-1', quantity: 1 }],
  [...catalog],
  zeroPct
);
assert.equal(zeroPctCart.discountAmount, 5);

console.log('platform-shop voucher tests passed');
