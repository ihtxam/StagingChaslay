import assert from 'node:assert/strict';
import {
  decodeHtmlEntities,
  receiptHeaderContentToLines,
  receiptHeaderContentToPlainText,
  receiptHeaderHtmlForEditor,
  isReceiptHeaderContentConfigured,
} from '@/lib/receipt-header-html';
import { receiptHeaderLinesFromPrintSettings } from '@/lib/webpos-receipt';
import { getReceiptHeaderLines } from '@/lib/webpos-receipt';

assert.deepEqual(
  receiptHeaderContentToLines('<p>Shop Name</p><p>Rue 1</p><p>Tel: 032 000 00 00</p>'),
  ['Shop Name', 'Rue 1', 'Tel: 032 000 00 00']
);

assert.equal(decodeHtmlEntities('adresse h&egrave;re'), 'adresse hère');

assert.deepEqual(
  receiptHeaderLinesFromPrintSettings({
    receiptHeader: '<p>adresse h&egrave;re food truck</p><p>2000 Neuchâtel</p>',
    receiptHeaderLines: ['adresse h&egrave;re food truck2000Neuchatel------'],
  }),
  ['adresse hère food truck', '2000 Neuchâtel']
);

const mashedHtml = getReceiptHeaderLines(
  {
    headerTitle: '',
    header: '<p>adresse h&egrave;re food truck2000 Neuchâtel</p>',
    headerLines: receiptHeaderLinesFromPrintSettings({
      receiptHeader: '<p>adresse h&egrave;re food truck2000 Neuchâtel</p>',
    }),
    businessName: 'Food Truck',
    headerAlign: 'center',
  },
  48,
  { padLines: false }
);
assert.ok(mashedHtml.some((l) => /hère/i.test(l) && !/&egrave;/.test(l)));
assert.ok(mashedHtml.some((l) => /2000/.test(l) && /Neuch/i.test(l)));

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
assert.equal(defaultHeader[0], 'Demo Cafe');
assert.ok(defaultHeader.includes('Rue du Lac 12'));
assert.ok(defaultHeader.includes('Lausanne'));
assert.ok(defaultHeader.some((l) => /Tel:/i.test(l)));
assert.ok(defaultHeader.some((l) => /VAT:/i.test(l)));

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
