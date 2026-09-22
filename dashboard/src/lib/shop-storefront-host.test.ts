/**
 * Shop storefront host detection — run: npx tsx dashboard/src/lib/shop-storefront-host.test.ts
 */
import assert from 'node:assert/strict';
import { isShopCustomerSurface, isShopStorefrontHost } from './shop-storefront-host.ts';

assert.equal(isShopStorefrontHost('order.rebornsense.com', '/kebabvillage'), true);
assert.equal(isShopStorefrontHost('shop.chaslay.com', '/brazza'), true);
assert.equal(isShopStorefrontHost('app.rebornsense.com', '/merchant'), false);
assert.equal(isShopStorefrontHost('polacafe.rebornsense.com', '/'), true);

assert.equal(isShopCustomerSurface('/kebabvillage', 'order.rebornsense.com'), true);
assert.equal(isShopCustomerSurface('/kebabvillage/menu', 'order.rebornsense.com'), true);
assert.equal(isShopCustomerSurface('/shop/polacafe', 'app.rebornsense.com'), true);
assert.equal(isShopCustomerSurface('/merchant', 'app.rebornsense.com'), false);

console.log('shop-storefront-host.test.ts: ok');
