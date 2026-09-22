/**
 * shop-hours-display.test.ts — run: npx tsx dashboard/src/lib/shop-hours-display.test.ts
 */
import assert from 'node:assert/strict';
import {
  hasChannelHours,
  summarizeChannelHours,
  summarizeStoreHours,
} from './shop-hours-display.ts';

const hours = {
  takeaway: {
    mon: [{ open: '11:00', close: '22:00' }],
  },
  delivery: {
    mon: [{ open: '12:00', close: '21:00' }],
    sun: [{ open: '16:00', close: '23:00' }],
  },
};

assert.equal(hasChannelHours(hours, 'delivery'), true);
assert.equal(hasChannelHours({ takeaway: {} }, 'delivery'), false);

const deliveryRows = summarizeChannelHours(hours, 'delivery', 'de');
assert.ok(deliveryRows.some((r) => r.label.includes('Montag') || r.label === 'Montag'));
assert.ok(deliveryRows.some((r) => r.hours.includes('12:00')));

const generalRows = summarizeStoreHours(hours, undefined, 'en');
assert.ok(generalRows.some((r) => r.hours.includes('11:00')));

console.log('shop-hours-display.test.ts OK');
