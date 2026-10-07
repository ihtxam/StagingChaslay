"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Shop order email copy — run: npx tsx backend/src/lib/transactional-email-labels.test.ts
 */
const strict_1 = __importDefault(require("node:assert/strict"));
const transactional_email_labels_1 = require("./transactional-email-labels");
const shop_order_email_template_1 = require("./shop-order-email-template");
const confirmed = (0, transactional_email_labels_1.shopOrderEmailCopy)('confirmed', 'Cafe Gandhi', 'WEB-FD09-12', 'en');
strict_1.default.match(confirmed.subject, /WEB-FD09-12/);
strict_1.default.match(confirmed.body.toLowerCase(), /kitchen/);
const frConfirmed = (0, transactional_email_labels_1.shopOrderEmailCopy)('confirmed', 'Tavannas Kebab', '6N6FZJ', 'fr');
strict_1.default.equal(frConfirmed.subject, 'Commande #6N6FZJ acceptée');
strict_1.default.match(frConfirmed.body, /cuisine a commencé/i);
const frReceived = (0, transactional_email_labels_1.shopOrderEmailCopy)('received', 'Tavannas Kebab', '6N6FZJ', 'fr');
strict_1.default.match(frReceived.subject, /confirmée/i);
const merchant = (0, transactional_email_labels_1.merchantNewOrderEmailCopy)('Cafe Gandhi', 'WEB-FD09-12', 'en');
strict_1.default.match(merchant.subject, /WEB-FD09-12/);
strict_1.default.match(merchant.body.toLowerCase(), /order/);
strict_1.default.equal((0, transactional_email_labels_1.shopOrderTrackLabel)('en'), 'Track your order');
strict_1.default.equal((0, transactional_email_labels_1.shopOrderEmailLabels)('fr').orderConfirmedBadge, 'COMMANDE CONFIRMÉE');
const html = (0, shop_order_email_template_1.buildShopOrderGuestEmailHtml)({
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
strict_1.default.match(html, /COMMANDE CONFIRMÉE|Acceptée/);
strict_1.default.match(html, /Récapitulatif/);
strict_1.default.match(html, /Besoin d'aide \?/);
console.log('transactional-email-labels.test.ts ok');
//# sourceMappingURL=transactional-email-labels.test.js.map