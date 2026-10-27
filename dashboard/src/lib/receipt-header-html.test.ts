import assert from 'node:assert/strict';
import {
  receiptHeaderContentToLines,
  receiptHeaderContentToPlainText,
  receiptHeaderHtmlForEditor,
  isReceiptHeaderContentConfigured,
} from '@/lib/receipt-header-html';
import { getReceiptHeaderLines } from '@/lib/webpos-receipt';

assert.deepEqual(
  receiptHeaderContentToLines('<p>Shop Name</p><p>Rue 1</p><p>Tel: 032 000 00 00</p>'),
  ['Shop Name', 'Rue 1', 'Tel: 032 000 00 00']
);

assert.equal(
  isReceiptHeaderContentConfigured('', '<p><br></p>'),
  false
);

const defaultHeader = getReceiptHeaderLines(
  {
    headerTitle: '',
    header: '',
    headerLines: [],
    businessName: 'Demo Cafe',
    address: 'Rue du Lac 12',
    city: 'Lausanne',
    phone: '+41 21 000 00 00',
    vatNumber: 'CHE-123.456.789',
    headerAlign: 'center',
  },
  48,
  { padLines: false }
);
assert.ok(defaultHeader.includes('Rue du Lac 12'));
assert.ok(defaultHeader.includes('Lausanne'));
assert.ok(defaultHeader.some((l) => /Tel:/i.test(l)));
assert.ok(defaultHeader.some((l) => /VAT:/i.test(l)));
assert.equal(defaultHeader.includes('Demo Cafe'), false, 'empty custom header uses shop details, not name');

const htmlHeader = getReceiptHeaderLines(
  {
    headerTitle: '',
    header: '<p>My Shop</p><p>Street 2</p>',
    headerLines: ['My Shop', 'Street 2'],
    businessName: 'Demo Cafe',
    address: 'Rue du Lac 12',
    phone: '+41 21 000 00 00',
    headerAlign: 'center',
  },
  48,
  { padLines: false }
);
assert.deepEqual(htmlHeader, ['My Shop', 'Street 2']);
assert.equal(
  htmlHeader.some((l) => /Rue du Lac/i.test(l)),
  false,
  'custom header must not append shop address'
);

assert.ok(receiptHeaderHtmlForEditor('Line A\nLine B').includes('<p>Line A</p>'));

console.log('receipt-header-html.test.ts ok');
