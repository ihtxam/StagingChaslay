/**
 * Shop storefront host detection — run: npx tsx dashboard/src/lib/shop-storefront-host.test.ts
 */
import assert from 'node:assert/strict';
import {
  isShopCustomerSurface,
  isShopStorefrontBoot,
  isShopStorefrontHost,
} from './shop-storefront-host.ts';

/** Keep aligned with isShopPathHubHost() fallbacks in brand.ts. */
const HUB_HOSTS = ['order.rebornsense.com', 'shop.chaslay.com'] as const;

for (const host of HUB_HOSTS) {
  assert.equal(isShopStorefrontHost(host, '/kebabvillage'), true, `${host} must be a storefront host`);
  assert.equal(isShopCustomerSurface('/kebabvillage', host), true, `${host}/kebabvillage is customer surface`);
  assert.equal(isShopCustomerSurface('/kebabvillage/menu', host), true, `${host} menu is customer surface`);
  assert.equal(isShopCustomerSurface('/', host), true, `${host} root is customer surface`);
}

assert.equal(isShopStorefrontHost('app.rebornsense.com', '/merchant'), false);
assert.equal(isShopStorefrontHost('polacafe.rebornsense.com', '/'), true);
assert.equal(isShopCustomerSurface('/shop/polacafe', 'app.rebornsense.com'), true);
assert.equal(isShopCustomerSurface('/merchant', 'app.rebornsense.com'), false);

// Boot flag from inline index.html must win before the JS bundle loads (stale SW cache scenario).
const prevBoot = (globalThis as typeof globalThis & { __REBORN_SHOP_STOREFRONT__?: boolean })
  .__REBORN_SHOP_STOREFRONT__;
(globalThis as typeof globalThis & { __REBORN_SHOP_STOREFRONT__?: boolean }).__REBORN_SHOP_STOREFRONT__ =
  true;
assert.equal(isShopStorefrontBoot(), true);
(globalThis as typeof globalThis & { __REBORN_SHOP_STOREFRONT__?: boolean }).__REBORN_SHOP_STOREFRONT__ =
  prevBoot;

console.log('shop-storefront-host.test.ts: ok');
