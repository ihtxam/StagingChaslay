/**
 * Run: cd backend && npx tsx src/lib/money-order-tax-rate.test.ts
 */
import assert from 'node:assert/strict';
import { impliedVatRatePercent, resolveOrderListTaxRate } from './money';

assert.equal(impliedVatRatePercent(3.7, 0.1), 2.7);

assert.equal(
  resolveOrderListTaxRate({
    subtotal: 3.7,
    taxAmount: 0.1,
    taxIncludedInPrice: true,
    channelTaxRate: 2.6,
  }),
  2.6
);

assert.equal(
  resolveOrderListTaxRate({
    subtotal: 10,
    taxAmount: 0.81,
    taxIncludedInPrice: false,
    channelTaxRate: 8.1,
  }),
  8.1
);

// Label follows merchant takeaway rate even when stored HT/TVA lines imply dine-in VAT.
assert.equal(
  resolveOrderListTaxRate({
    subtotal: 7.96,
    taxAmount: 0.64,
    taxIncludedInPrice: true,
    channelTaxRate: 2.6,
  }),
  2.6
);

console.log('money-order-tax-rate.test.ts ok');
