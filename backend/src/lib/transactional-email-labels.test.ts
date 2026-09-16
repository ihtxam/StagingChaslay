/**
 * Shop order email copy — run: npx tsx backend/src/lib/transactional-email-labels.test.ts
 */
import assert from 'node:assert/strict';
import {
  merchantNewOrderEmailCopy,
  shopOrderEmailCopy,
  shopOrderReadyLabel,
  shopOrderTrackLabel,
} from './transactional-email-labels';

const confirmed = shopOrderEmailCopy('confirmed', 'Cafe Gandhi', 'WEB-FD09-12', 'en');
assert.match(confirmed.subject, /WEB-FD09-12/);
assert.match(confirmed.body.toLowerCase(), /accepted/);

const merchant = merchantNewOrderEmailCopy('Cafe Gandhi', 'WEB-FD09-12', 'en');
assert.match(merchant.subject, /WEB-FD09-12/);
assert.match(merchant.body.toLowerCase(), /order/);

assert.equal(shopOrderTrackLabel('en'), 'Track your order');
assert.equal(shopOrderReadyLabel('en'), 'Estimated time');

console.log('transactional-email-labels.test.ts ok');
