/**
 * Public shop hosts must never attach merchant auth or redirect to panel login.
 * Run: npx tsx dashboard/src/lib/shop-public-auth.test.ts
 */
import assert from 'node:assert/strict';
import { isShopCustomerSurface, isShopStorefrontHost } from './shop-storefront-host.ts';

function isPublicShopHost(hostname: string, pathname = '/'): boolean {
  return isShopCustomerSurface(pathname, hostname) || isShopStorefrontHost(hostname, pathname);
}

assert.equal(isPublicShopHost('order.rebornsense.com', '/kebabvillage'), true);
assert.equal(isPublicShopHost('shop.chaslay.com', '/brazza/menu'), true);
assert.equal(isPublicShopHost('kebabvillage.com', '/menu'), true);
assert.equal(isPublicShopHost('app.rebornsense.com', '/merchant'), false);
assert.equal(isPublicShopHost('app.rebornsense.com', '/login'), false);

console.log('shop-public-auth.test.ts: ok');
