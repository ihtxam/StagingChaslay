import assert from 'node:assert/strict';
import test from 'node:test';
import type { OnlineOrder } from '@/components/WebPosOnlineOrdersPanel';
import type { PosOrderListRow } from '@/lib/webpos-orders-merge';
import { mergeOrdersWithOnlineForAllFilter, onlineOrderAsPosOrder } from './webpos-orders-merge.ts';

const posOrder = (id: string): PosOrderListRow =>
  ({
    id,
    orderNumber: `POS-${id}`,
    orderType: 'pos',
    status: 'completed',
    total: 10,
    refundAmount: 0,
    createdAt: '2026-09-03T10:00:00Z',
    items: [],
  }) as PosOrderListRow;

const onlineOrder = (id: string): OnlineOrder => ({
  id,
  orderNumber: `WEB-${id}`,
  orderType: 'web_shop',
  orderSource: 'online_shop',
  fulfillmentChannel: 'delivery',
  status: 'preparing',
  total: '25.50',
  createdAt: '2026-09-03T11:00:00Z',
});

test('mergeOrdersWithOnlineForAllFilter adds online rows on all channel', () => {
  const merged = mergeOrdersWithOnlineForAllFilter([posOrder('a')], [onlineOrder('b')], 'all');
  assert.equal(merged.length, 2);
  assert.ok(merged.some((o) => o.id === 'b' && o.orderType === 'web_shop'));
});

test('mergeOrdersWithOnlineForAllFilter skips duplicates and non-all filters', () => {
  const merged = mergeOrdersWithOnlineForAllFilter(
    [posOrder('a')],
    [onlineOrder('a'), onlineOrder('c')],
    'all'
  );
  assert.equal(merged.length, 2);
  assert.equal(merged.find((o) => o.id === 'a')?.orderNumber, 'POS-a');

  const dineInOnly = mergeOrdersWithOnlineForAllFilter(
    [posOrder('a')],
    [onlineOrder('c')],
    'dine_in'
  );
  assert.equal(dineInOnly.length, 1);
});

test('onlineOrderAsPosOrder maps fulfillment channel', () => {
  const row = onlineOrderAsPosOrder(onlineOrder('x'));
  assert.equal(row.channel, 'delivery');
  assert.equal(row.orderSource, 'online_shop');
  assert.equal(row.total, 25.5);
});

test('mergeOrdersWithOnlineForAllFilter keeps a future scheduled WEB- ticket', () => {
  const scheduled: OnlineOrder = {
    ...onlineOrder('cc71-11fl'),
    orderNumber: 'WEB-CC71-11FL',
    scheduledFor: '2026-10-20T17:00:00Z',
    paymentStatus: 'awaiting_payment',
    status: 'preparing',
  };
  const merged = mergeOrdersWithOnlineForAllFilter([posOrder('till-1')], [scheduled], 'all');
  assert.ok(merged.some((o) => o.orderNumber === 'WEB-CC71-11FL'));
});

test('onlineOrderAsPosOrder maps delivery and card fees into charged total fields', () => {
  const row = onlineOrderAsPosOrder({
    ...onlineOrder('fee'),
    total: '31.00',
    subtotal: '20.00',
    taxAmount: '1.60',
    deliveryFee: '5.00',
    cardFee: '0.90',
  });
  assert.equal(row.deliveryFee, 5);
  assert.equal(row.cardFee, 0.9);
  assert.equal(row.total, 31);
});
