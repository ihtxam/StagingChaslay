/**
 * Regression: orderChannel ↔ isOnlineShopOrder must not recurse (merchant /orders stack overflow).
 * Run: cd dashboard && npx vitest run src/lib/order-management-channel.test.ts
 */
import { describe, expect, it } from 'vitest';
import {
  isOnlineShopOrder,
  orderChannel,
  orderListPrimaryLabel,
  type MerchantOrder,
} from './order-management';

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
    expect(orderChannel(o)).toBe('takeaway');
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
});
