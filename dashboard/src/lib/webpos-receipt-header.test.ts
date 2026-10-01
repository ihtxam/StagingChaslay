import assert from 'node:assert/strict';
import {
  expandReceiptHeaderDetailLines,
  getReceiptHeaderLines,
  splitReceiptHeaderDetailLine,
} from '@/lib/webpos-receipt';

assert.deepEqual(
  splitReceiptHeaderDetailLine('Cafe Roma Rue du Lac 12 Tel: +41 21 000 00 00'),
  ['Cafe Roma Rue du Lac 12', 'Tel: +41 21 000 00 00']
);

assert.deepEqual(
  expandReceiptHeaderDetailLines('Rue du Lac 12\nTél: +41 21 000 00 00'),
  ['Rue du Lac 12', 'Tél: +41 21 000 00 00']
);

const customHeader = getReceiptHeaderLines(
  {
    headerTitle: 'Cafe Roma',
    header: '',
    businessName: 'Cafe Roma',
    address: 'Rue du Lac 12, Lausanne',
    phone: '+41 21 000 00 00',
    headerAlign: 'center',
  },
  32,
  { padLines: false }
);
assert.equal(customHeader.length, 3);
assert.equal(customHeader[0], 'Cafe Roma');
assert.equal(customHeader[1], 'Rue du Lac 12, Lausanne');
assert.equal(customHeader[2], 'Tel: +41 21 000 00 00');

const mashed = getReceiptHeaderLines(
  {
    headerTitle: '',
    header: 'Cafe Roma Rue du Lac 12 Tel: +41 21 000 00 00',
    businessName: 'Cafe Roma',
    address: 'Rue du Lac 12',
    phone: '+41 21 000 00 00',
    headerAlign: 'center',
  },
  48,
  { padLines: false }
);
assert.equal(mashed.length, 3);
assert.equal(mashed[0], 'Cafe Roma');
assert.equal(mashed[1], 'Rue du Lac 12');
assert.equal(mashed[2], 'Tel: +41 21 000 00 00');

console.log('webpos-receipt-header.test.ts ok');
