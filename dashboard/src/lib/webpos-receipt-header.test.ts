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

const nova = getReceiptHeaderLines(
  {
    headerTitle: 'NOVA PORTUGALIA',
    header:
      'Rue des Draizes 22, NeuchâtelSuisse Rue des Draizes 44, Neuchâtel Tel: 032 558 45 65 VAT: CHE-131.903.128',
    businessName: 'NOVA PORTUGALIA',
    address: 'Rue des Draizes 22',
    phone: '032 558 45 65',
    vatNumber: 'CHE-131.903.128',
    headerAlign: 'center',
  },
  48,
  { padLines: false }
);
assert.ok(nova.length >= 4);
assert.equal(nova[0], 'NOVA PORTUGALIA');
assert.ok(nova.some((l) => l.includes('Rue des Draizes 22')));
assert.ok(nova.some((l) => /Tel:\s*032/.test(l)));
assert.ok(nova.some((l) => /VAT:\s*CHE-131/.test(l)));

console.log('webpos-receipt-header.test.ts ok');
