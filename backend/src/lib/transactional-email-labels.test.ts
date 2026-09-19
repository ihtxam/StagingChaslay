/**
 * Shop order email copy — run: npx tsx backend/src/lib/transactional-email-labels.test.ts
 */
import assert from 'node:assert/strict';
import {
  merchantNewOrderEmailCopy,
  shopOrderEmailCopy,
  shopOrderEmailLabels,
  shopOrderTrackLabel,
} from './transactional-email-labels';
import { buildShopOrderGuestEmailHtml } from './shop-order-email-template';

const confirmed = shopOrderEmailCopy('confirmed', 'Cafe Gandhi', 'WEB-FD09-12', 'en');
assert.match(confirmed.subject, /WEB-FD09-12/);
assert.match(confirmed.body.toLowerCase(), /kitchen/);

const frConfirmed = shopOrderEmailCopy('confirmed', 'Tavannas Kebab', '6N6FZJ', 'fr');
assert.equal(frConfirmed.subject, 'Commande #6N6FZJ acceptée');
assert.match(frConfirmed.body, /cuisine a commencé/i);

const frReceived = shopOrderEmailCopy('received', 'Tavannas Kebab', '6N6FZJ', 'fr');
assert.match(frReceived.subject, /confirmée/i);

const merchant = merchantNewOrderEmailCopy('Cafe Gandhi', 'WEB-FD09-12', 'en');
assert.match(merchant.subject, /WEB-FD09-12/);
assert.match(merchant.body.toLowerCase(), /order/);

assert.equal(shopOrderTrackLabel('en'), 'Track your order');
assert.equal(shopOrderEmailLabels('fr').orderConfirmedBadge, 'COMMANDE CONFIRMÉE');

const html = buildShopOrderGuestEmailHtml({
  kind: 'confirmed',
  locale: 'fr',
  shopName: 'Tavannas Kebab',
  orderNumber: '6N6FZJ',
  customerName: 'Ihtsham',
  body: frConfirmed.body,
  fulfillmentChannel: 'takeaway',
  paymentMethod: 'pay_later',
  subtotal: '3.50',
  discountTotal: '0.25',
  total: '3.25',
  items: [{ quantity: '1', name: 'Fusetea citron', unitPrice: '3.50', totalPrice: '3.50' }],
  scheduledLabel: '20.08.2026 · 21:00',
  etaMinutes: 15,
  pickupLines: ['Tavannas Kebab', 'Grand-Rue 18, 2710 Tavannes, Switzerland'],
  merchantPhone: '+41 32 481 30 73',
  merchantEmail: 'ellis_23_2006@hotmail.com',
  notes: 'TEST TEST TEST TEST',
  trackingUrl: null,
  trackLabel: 'Suivre votre commande',
});
assert.match(html, /COMMANDE CONFIRMÉE|Acceptée/);
assert.match(html, /Récapitulatif/);
assert.match(html, /Besoin d'aide \?/);

console.log('transactional-email-labels.test.ts ok');
