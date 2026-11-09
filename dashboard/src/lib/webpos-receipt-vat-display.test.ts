/**
 * Run: cd dashboard && npx vite-node src/lib/webpos-receipt-vat-display.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildDigitalReceiptTotals,
  resolveReceiptTaxRateForOrder,
} from '@/lib/webpos-receipt';

const merchantTax = {
  taxTakeawayRate: 2.6,
  taxDineInRate: 8.1,
  taxDeliveryRate: 2.6,
};

assert.equal(
  resolveReceiptTaxRateForOrder(
    { subtotal: 3.7, taxAmount: 0.1, taxRate: 2.7, channel: 'takeaway' },
    { vatIncludedInPrice: true, merchantTax }
  ),
  2.6
);

const beer = buildDigitalReceiptTotals({
  items: [{ name: 'Helvetic beer', quantity: 1, unitPrice: 3.8, lineTotal: 3.8 }],
  subtotal: 3.7,
  taxAmount: 0.1,
  taxRate: 2.6,
  total: 3.8,
  vatIncludedInPrice: true,
  vatAfterDiscount: true,
});

assert.equal(beer.taxRate, 2.6);
assert.equal(beer.net, 3.7);
assert.equal(beer.tax, 0.1);
assert.equal(beer.total, 3.8);

console.log('webpos-receipt-vat-display.test.ts ok');
