/**
 * Guest order status URL — run: npx tsx backend/src/lib/delivery-tracking-url.test.ts
 */
import assert from 'node:assert/strict';
import { buildGuestOrderTrackingUrl } from './delivery-tracking-url';

const merchant = { slug: 'gandhi', subdomain: null, customDomain: null };

const withToken = buildGuestOrderTrackingUrl(merchant, 'order-1', 'abc');
assert.equal(withToken.includes('/shop/gandhi/order/order-1'), true);
assert.equal(withToken.includes('track=abc'), true);

const pickup = buildGuestOrderTrackingUrl(merchant, 'order-1', null);
assert.equal(pickup.includes('/shop/gandhi/order/order-1'), true);
assert.equal(pickup.includes('track='), false);

console.log('delivery-tracking-url.test.ts ok');
