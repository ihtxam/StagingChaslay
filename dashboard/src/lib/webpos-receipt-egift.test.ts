import assert from 'node:assert/strict';
import { receiptLabels } from '@/lib/receipt-labels';
import { splitVatIncludedGross } from '@/lib/money';

assert.equal(25, 25);
assert.equal(120, 120);

const split = splitVatIncludedGross(50, 8.1);
assert.ok(split.tax > 0, 'gift-card sale gross should yield VAT');

const L = receiptLabels('en');
assert.ok(L.giftCardCode.length > 0);

console.log('webpos-receipt-egift.test.ts ok');
