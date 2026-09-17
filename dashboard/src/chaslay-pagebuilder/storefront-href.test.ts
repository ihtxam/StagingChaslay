/**
 * Storefront href helpers — run: npx tsx dashboard/src/chaslay-pagebuilder/storefront-href.test.ts
 */
import assert from 'node:assert/strict';
import {
  isContactNavLink,
  isHomeNavLink,
  isShopMenuNavLink,
  resolveStorefrontHref,
} from './storefront-href';

const base = '/shop/demo';

assert.equal(isShopMenuNavLink('#menu'), true);
assert.equal(isShopMenuNavLink('/menu'), true);
assert.equal(isShopMenuNavLink('/order'), true);
assert.equal(isShopMenuNavLink('/order-now'), true);
assert.equal(isShopMenuNavLink('/shop/demo/menu'), true);
assert.equal(isShopMenuNavLink('/order/abc'), false);
assert.equal(isShopMenuNavLink('#about'), false);

assert.equal(isHomeNavLink('#home'), true);
assert.equal(isHomeNavLink('/'), true);
assert.equal(isHomeNavLink('/home'), true);
assert.equal(isHomeNavLink('#about'), false);

assert.equal(isContactNavLink('#contact'), true);
assert.equal(isContactNavLink('/contact'), true);
assert.equal(isContactNavLink('/shop/demo/contact'), true);
assert.equal(isContactNavLink('#about'), false);

assert.equal(resolveStorefrontHref('#menu', base, true), `${base}/menu`);
assert.equal(resolveStorefrontHref('/menu', base, true), `${base}/menu`);
assert.equal(resolveStorefrontHref('/order', base, true), `${base}/menu`);
assert.equal(resolveStorefrontHref('#about', base, true, { surface: 'home' }), '#about');
assert.equal(resolveStorefrontHref('#about', base, true, { surface: 'shop' }), `${base}#about`);
assert.equal(resolveStorefrontHref('#home', base, true, { surface: 'shop' }), base);
assert.equal(resolveStorefrontHref('#home', base, true, { surface: 'home' }), '#home');
assert.equal(resolveStorefrontHref('/', base, true), base);
assert.equal(resolveStorefrontHref('/pages/about', base, true), `${base}/pages/about`);
assert.equal(resolveStorefrontHref('#contact', base, false), '#contact');

console.log('storefront-href tests passed');
