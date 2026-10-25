/**
 * Cart checkout guard — run: npx tsx dashboard/src/lib/order-to-cart.guard.test.ts
 */
import assert from 'node:assert/strict';
import {
  orderMatchesCartLink,
  orderStronglyMatchesCartLink,
  resolveCartCheckoutGuard,
  type CartOrderLink,
} from './order-to-cart';
import type { MerchantOrder } from './order-management';

const paidOnTable: MerchantOrder = {
  id: 'paid-1',
  orderNumber: '3228',
  status: 'completed',
  paymentStatus: 'paid',
  total: 42,
  tableId: 'table-a',
  ticketDisplay: '#100',
  tabNumber: null,
  items: [],
};

const linkTableOnly: CartOrderLink = {
  tableId: 'table-a',
  ticketDisplay: null,
  tabNumber: null,
  ticketOrderNumber: null,
};

assert.equal(orderMatchesCartLink(paidOnTable, linkTableOnly), false);
assert.equal(orderStronglyMatchesCartLink(paidOnTable, linkTableOnly), false);

const guard = resolveCartCheckoutGuard([paidOnTable], linkTableOnly, { requireSent: false });
assert.equal(guard.action, 'ok');

const linkSameTicket: CartOrderLink = {
  tableId: 'table-a',
  ticketDisplay: '#100',
  tabNumber: null,
  ticketOrderNumber: null,
};

assert.equal(orderStronglyMatchesCartLink(paidOnTable, linkSameTicket), true);
const blocked = resolveCartCheckoutGuard([paidOnTable], linkSameTicket, { requireSent: false });
assert.equal(blocked.action, 'blocked');

console.log('order-to-cart.guard.test.ts OK');
