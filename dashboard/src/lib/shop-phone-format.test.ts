/**
 * Swiss phone display — run: npx tsx dashboard/src/lib/shop-phone-format.test.ts
 */
import assert from 'node:assert/strict';
import { formatShopPhoneDisplay } from './shop-phone-format.ts';

assert.equal(formatShopPhoneDisplay('+41323611717'), '+41 32 361 17 17');
assert.equal(formatShopPhoneDisplay('+41 32 361 17 17'), '+41 32 361 17 17');
assert.equal(formatShopPhoneDisplay('0041323611717'), '+41 32 361 17 17');
assert.equal(formatShopPhoneDisplay(''), '');
assert.equal(formatShopPhoneDisplay('+1 202 555 0100'), '+1 202 555 0100');

console.log('shop-phone-format.test.ts OK');
