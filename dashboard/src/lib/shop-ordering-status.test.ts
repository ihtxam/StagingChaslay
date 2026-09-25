/**
 * Shop ordering block + header dedupe —
 * run: npx tsx dashboard/src/lib/shop-ordering-status.test.ts
 */
import assert from 'node:assert/strict';
import {
  resolveShopOrderingBlock,
  shouldShowDeliveryChannelStatus,
} from './shop-ordering-status.ts';

const t = (key: string) => key;

const vacationCart = resolveShopOrderingBlock({
  vacationActive: true,
  acceptingOrders: true,
  t,
  variant: 'cart',
});
assert.equal(vacationCart.blocked, true);
assert.equal(vacationCart.reason, 'vacation');
assert.equal(vacationCart.message, 'shopVacationOrdersBlocked');

const vacationHeader = resolveShopOrderingBlock({
  vacationActive: true,
  acceptingOrders: true,
  t,
  variant: 'header',
});
assert.equal(vacationHeader.message, 'shopVacationTitle');

const paused = resolveShopOrderingBlock({
  vacationActive: false,
  acceptingOrders: false,
  t,
});
assert.equal(paused.reason, 'orders_paused');
assert.equal(paused.message, 'shopNotAcceptingOrders');

assert.equal(
  resolveShopOrderingBlock({ vacationActive: false, acceptingOrders: true, t }).blocked,
  false
);

assert.equal(vacationCart.blocked, true, 'vacation overrides acceptingOrders=false');
assert.equal(
  resolveShopOrderingBlock({ vacationActive: true, acceptingOrders: false, t }).reason,
  'vacation'
);

assert.equal(shouldShowDeliveryChannelStatus('Open now', 'Open now'), false);
assert.equal(shouldShowDeliveryChannelStatus('Open now', 'Delivery closed'), true);
assert.equal(shouldShowDeliveryChannelStatus('Open now', null), false);

console.log('shop-ordering-status.test.ts: ok');
