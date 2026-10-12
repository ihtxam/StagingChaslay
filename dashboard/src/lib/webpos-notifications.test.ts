import assert from 'node:assert/strict';
import {
  isBellVisibleOrder,
  isPosPaymentNotification,
  posSaleToNotificationOrder,
} from './webpos-notifications.ts';

const paidPos = posSaleToNotificationOrder({
  id: 'o1',
  orderNumber: 'WP-70BXVHRM955',
  total: 71,
  items: [{ name: 'Água das Pedras', quantity: 1 }],
});

assert.equal(paidPos.orderType, 'pos');
assert.equal(isPosPaymentNotification(paidPos), true);
assert.equal(isBellVisibleOrder(paidPos), false);
assert.equal(isPosPaymentNotification({ orderType: 'webpos' }), true);
assert.equal(isPosPaymentNotification({ orderType: 'waiter' }), true);
assert.equal(isPosPaymentNotification({ orderType: 'web_shop' }), false);
assert.equal(isBellVisibleOrder({ orderType: 'web_shop', status: 'preparing' }), true);
assert.equal(isBellVisibleOrder({ orderType: 'web_shop', status: 'completed' }), false);
assert.equal(isBellVisibleOrder({ orderType: 'web_shop', status: 'cancelled' }), false);

console.log('webpos-notifications.test.ts ok');
