/**
 * Run: cd dashboard && npx tsx src/lib/webpos-receipt-online-payment.test.ts
 */
import assert from 'node:assert/strict';
import {
  generateWebPosReceiptText,
  isCashOnDeliveryReceipt,
  orderReceiptPaymentSettled,
  resolveReceiptTaxRateForOrder,
} from '@/lib/webpos-receipt';

const merchantTax = {
  taxDineInRate: 8.1,
  taxTakeawayRate: 2.6,
  taxDeliveryRate: 2.6,
};

assert.equal(
  resolveReceiptTaxRateForOrder(
    { subtotal: 26.5, taxAmount: 0.72, channel: 'delivery' },
    { vatIncludedInPrice: true, merchantTax }
  ),
  2.6
);

assert.equal(
  resolveReceiptTaxRateForOrder(
    { subtotal: 3.7, taxAmount: 0.1, taxRate: 2.7, channel: 'takeaway' },
    { vatIncludedInPrice: true, merchantTax }
  ),
  2.6
);

assert.equal(
  orderReceiptPaymentSettled({ paymentMethod: 'cash', paymentStatus: 'awaiting_payment' }),
  false
);
assert.equal(
  isCashOnDeliveryReceipt({ paymentMethod: 'cash', paymentStatus: 'awaiting_payment' }),
  true
);
assert.equal(
  orderReceiptPaymentSettled({ paymentMethod: 'card', paymentStatus: 'completed' }),
  true
);

const cashDeliveryReceipt = generateWebPosReceiptText(
  {
    businessName: 'Kebab du village',
    id: 'order-1',
    orderNumber: 'WEB-8DE1-5',
    completedAt: Date.now(),
    channel: 'delivery',
    orderSource: 'online_shop',
    paymentMethod: 'cash',
    paymentStatus: 'awaiting_payment',
    customerName: 'Test Guest',
    shippingAddress: 'Rue Test 1',
    items: [{ name: 'Menu', quantity: 1, unitPrice: 26.5, lineTotal: 26.5 }],
    subtotal: 26.5,
    taxAmount: 0.72,
    taxRate: 2.6,
    deliveryFee: 2,
    discount: 0,
    total: 28.5,
    vatIncludedInPrice: true,
    vatAfterDiscount: true,
    paperWidthMm: 80,
  },
  'fr'
);

assert.match(cashDeliveryReceipt, /IMPAYÉ/);
assert.match(cashDeliveryReceipt, /Paiement à la livraison/i);
assert.doesNotMatch(cashDeliveryReceipt, /Payé:\s*CHF/);
assert.match(cashDeliveryReceipt, /Livraison:\s*CHF 2\.00/);

const paidCardReceipt = generateWebPosReceiptText(
  {
    businessName: 'Kebab du village',
    id: 'order-2',
    orderNumber: 'WEB-PAID-1',
    completedAt: Date.now(),
    channel: 'delivery',
    orderSource: 'online_shop',
    paymentMethod: 'card',
    paymentStatus: 'completed',
    customerName: 'Test Guest',
    items: [{ name: 'Menu', quantity: 1, unitPrice: 26.5, lineTotal: 26.5 }],
    subtotal: 26.5,
    taxAmount: 0.72,
    taxRate: 2.6,
    deliveryFee: 2,
    discount: 0,
    total: 28.5,
    vatIncludedInPrice: true,
    vatAfterDiscount: true,
    paperWidthMm: 80,
  },
  'fr'
);

assert.match(paidCardReceipt, /PAYÉ/);
assert.match(paidCardReceipt, /Payé:\s*CHF/);

console.log('webpos-receipt-online-payment.test.ts ok');
