/**
 * Cart checkout guard — run: npx tsx dashboard/src/lib/order-to-cart.test.ts
 */
import assert from 'node:assert/strict';
import { orderMatchesCartLink, resolveCartCheckoutGuard, type CartOrderLink } from './order-to-cart.ts';
import type { MerchantOrder } from './order-management.ts';

function paid(partial: Partial<MerchantOrder> & Pick<MerchantOrder, 'id' | 'orderNumber'>): MerchantOrder {
  return {
    status: 'completed',
    paymentStatus: 'paid',
    refundAmount: 0,
    channel: 'takeaway',
    ticketDisplay: '#6393',
    ...partial,
  } as MerchantOrder;
}

const paidOrder = paid({ id: 'ord-1', orderNumber: '6393', ticketDisplay: '#6393' });

const emptyLink: CartOrderLink = {
  ticketDisplay: null,
  tabNumber: null,
  tableId: null,
  ticketOrderNumber: null,
};

assert.equal(orderMatchesCartLink(paidOrder, emptyLink), false);
assert.equal(resolveCartCheckoutGuard([paidOrder], emptyLink).action, 'ok');

const staleLink: CartOrderLink = {
  ticketDisplay: '#6393',
  tabNumber: null,
  tableId: null,
  ticketOrderNumber: null,
};
assert.equal(resolveCartCheckoutGuard([paidOrder], staleLink).action, 'blocked');

const freshTicket: CartOrderLink = {
  ticketDisplay: '#1204',
  tabNumber: null,
  tableId: null,
  ticketOrderNumber: 'WP-NEW',
};
assert.equal(orderMatchesCartLink(paidOrder, freshTicket), false);
assert.equal(resolveCartCheckoutGuard([paidOrder], freshTicket).action, 'ok');

console.log('order-to-cart.test.ts OK');
