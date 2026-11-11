/**
 * Regression: orderChannel ↔ isOnlineShopOrder must not recurse (merchant /orders stack overflow).
 * Run: cd dashboard && npx vitest run src/lib/order-management-channel.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  isInvoiceOrder,
  isKitchenTypeOrder,
  isOnlineShopOrder,
  isProgrammedOrder,
  orderChannel,
  orderListPrimaryLabel,
  orderMatchesSearchQuery,
  type MerchantOrder,
} from './order-management';

/** Mirrors Orders.tsx `matchesTypeFilter` — exercised when date preset changes list filtering. */
function matchesTypeFilter(o: MerchantOrder, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'programmed') return isProgrammedOrder(o);
  if (filter === 'kitchen') return isKitchenTypeOrder(o);
  if (filter === 'online') return isOnlineShopOrder(o);
  if (filter === 'invoice') return isInvoiceOrder(o);
  return orderChannel(o) === filter;
}

function posOrder(partial: Partial<MerchantOrder>): MerchantOrder {
  return {
    id: 'ord-test-1',
    status: 'completed',
    refundAmount: 0,
    orderType: 'pos',
    ...partial,
  } as MerchantOrder;
}

describe('orderChannel / isOnlineShopOrder', () => {
  it('does not exceed the stack when resolving a POS channel', () => {
    const o = posOrder({
      fulfillmentChannel: 'dine_in',
      channel: 'dine_in',
      orderNumber: 'WP-MHX5QNH0BE',
      ticketDisplay: '#6351',
      subtotal: 8.67,
      taxAmount: 0.23,
    });
    expect(() => orderChannel(o)).not.toThrow();
    expect(orderChannel(o)).toBe('dine_in');
    expect(isOnlineShopOrder(o)).toBe(false);
  });

  it('orderListPrimaryLabel resolves customer display without recursion', () => {
    const o = posOrder({
      fulfillmentChannel: 'takeaway',
      tableLabel: 'Counter 2',
      notes: null,
    });
    expect(() => orderListPrimaryLabel(o)).not.toThrow();
    expect(orderListPrimaryLabel(o)).toContain('Counter 2');
  });

  it('still treats third-party channel hints as online shop', () => {
    const o = posOrder({
      orderType: 'pos',
      fulfillmentChannel: 'ubereats',
    });
    expect(isOnlineShopOrder(o)).toBe(true);
    expect(orderChannel(o)).toBe('ubereats');
  });

  it('filters a yesterday-sized batch like Orders list useMemo without stack overflow', () => {
    const batch: MerchantOrder[] = Array.from({ length: 80 }, (_, i) =>
      posOrder({
        id: `ord-y-${i}`,
        fulfillmentChannel: i % 3 === 0 ? 'dine_in' : i % 3 === 1 ? 'takeaway' : 'delivery',
        channel: 'dine_in',
        subtotal: 10 + i,
        taxAmount: 0.26,
        orderNumber: `WP-${i}`,
        ticketDisplay: `#${6000 + i}`,
        createdAt: new Date().toISOString(),
      })
    );
    expect(() => {
      for (const o of batch) {
        orderChannel(o);
        isOnlineShopOrder(o);
        orderListPrimaryLabel(o);
        matchesTypeFilter(o, 'all');
        matchesTypeFilter(o, 'takeaway');
        orderMatchesSearchQuery(o, '');
      }
    }).not.toThrow();
  });
});
