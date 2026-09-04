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
  }) as PosOrder;

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
