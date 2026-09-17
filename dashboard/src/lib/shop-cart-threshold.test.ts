/**
 * Cart threshold picker — run:
 * npx tsx dashboard/src/lib/shop-cart-threshold.test.ts
 */
import assert from 'node:assert/strict';
import { pickCartThresholdBar } from './shop-cart-threshold';

assert.equal(pickCartThresholdBar({ channel: 'takeaway', subtotal: 10, minOrder: 20, freeDeliveryFrom: 40 }), null);

const belowMin = pickCartThresholdBar({
  channel: 'delivery',
  subtotal: 10,
  minOrder: 20,
  freeDeliveryFrom: 40,
});
assert.deepEqual(belowMin, { kind: 'min', threshold: 20 });

const minMet = pickCartThresholdBar({
  channel: 'delivery',
  subtotal: 25,
  minOrder: 20,
  freeDeliveryFrom: 40,
});
assert.deepEqual(minMet, { kind: 'free', threshold: 40 });

const freeUnlocked = pickCartThresholdBar({
  channel: 'delivery',
  subtotal: 50,
  minOrder: 20,
  freeDeliveryFrom: 40,
});
assert.deepEqual(freeUnlocked, { kind: 'free', threshold: 40 });

assert.equal(
  pickCartThresholdBar({ channel: 'delivery', subtotal: 30, minOrder: 20, freeDeliveryFrom: 0 }),
  null
);

const noMin = pickCartThresholdBar({
  channel: 'delivery',
  subtotal: 5,
  minOrder: 0,
  freeDeliveryFrom: 35,
});
assert.deepEqual(noMin, { kind: 'free', threshold: 35 });

console.log('shop-cart-threshold tests passed');
