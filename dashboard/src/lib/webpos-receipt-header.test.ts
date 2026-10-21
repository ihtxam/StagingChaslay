import assert from 'node:assert/strict';
import {
  expandReceiptHeaderDetailLines,
  getReceiptHeaderLines,
  healLegacyMashedReceiptHeaderFields,
  receiptHeaderLinesFromPrintSettings,
  receiptHeaderTxFromPrintSettings,
  splitMerchantAddressLines,
  splitReceiptHeaderDetailLine,
  splitStreetAndLocality,
  wrapReceiptHeaderLine,
} from '@/lib/webpos-receipt';

assert.deepEqual(
  splitReceiptHeaderDetailLine('Cafe Roma Rue du Lac 12 Tel: +41 21 000 00 00'),
  ['Cafe Roma', 'Rue du Lac 12', 'Tel: +41 21 000 00 00']
);

assert.deepEqual(
  expandReceiptHeaderDetailLines('Rue du Lac 12\nTél: +41 21 000 00 00'),
  ['Rue du Lac 12', 'Tel: +41 21 000 00 00']
);

assert.deepEqual(splitStreetAndLocality('Rue du Lac 12, Lausanne'), [
  'Rue du Lac 12',
  'Lausanne',
]);
assert.deepEqual(splitStreetAndLocality('Rua das Portas 150 1150-269 Lisboa'), [
  'Rua das Portas 150',
  '1150-269 Lisboa',
]);
assert.deepEqual(splitStreetAndLocality('Hauptstrasse 5 8001 Zürich'), [
  'Hauptstrasse 5',
  '8001 Zürich',
]);

assert.deepEqual(splitMerchantAddressLines('Rue du Lac 12', 'Lausanne'), [
  'Rue du Lac 12',
  'Lausanne',
]);
assert.deepEqual(
  splitMerchantAddressLines('Rue du Lac 12, Lausanne', 'Lausanne'),
  ['Rue du Lac 12', 'Lausanne']
);

assert.deepEqual(
  wrapReceiptHeaderLine('Rua das Portas de Santo Antao 150', 20),
  ['Rua das Portas de', 'Santo Antao 150']
);

const customHeader = getReceiptHeaderLines(
  {
    headerTitle: 'Cafe Roma',
    header: '',
    businessName: 'Cafe Roma',
    address: 'Rue du Lac 12',
    city: 'Lausanne',
    phone: '+41 21 000 00 00',
    headerAlign: 'center',
  },
  32,
  { padLines: false }
);
assert.deepEqual(customHeader, ['Cafe Roma']);

const mashed = getReceiptHeaderLines(
  {
    headerTitle: '',
    header: 'Cafe Roma\nRue du Lac 12\nTel: +41 21 000 00 00',
    businessName: 'Cafe Roma',
    address: 'Rue du Lac 12',
    city: 'Lausanne',
    phone: '+41 21 000 00 00',
    headerAlign: 'center',
  },
  48,
  { padLines: false }
);
assert.equal(mashed[0], 'Cafe Roma');
assert.ok(mashed.includes('Rue du Lac 12'));
assert.ok(mashed.includes('Tel: +41 21 000 00 00'));
assert.equal(
  mashed.some((line) => /tel/i.test(line) && /rue du lac/i.test(line)),
  false,
  'Tel must not stay on the same line as the street'
);

const novva = getReceiptHeaderLines(
  {
    headerTitle: '',
    header:
      'Novva Portugalia\nRua das Portas 150\n1150-269 Lisboa\nTel: +351 21 000 00 00\nVAT: CHE-123.456.789',
    businessName: 'Novva Portugalia',
    address: 'Rua das Portas 150 1150-269 Lisboa',
    phone: '+351 21 000 00 00',
    vatNumber: 'CHE-123.456.789',
    headerAlign: 'center',
  },
  42,
  { padLines: false }
);
assert.equal(novva[0], 'Novva Portugalia');
assert.ok(novva.includes('Rua das Portas 150'));
assert.ok(novva.includes('1150-269 Lisboa'));
assert.ok(novva.includes('Tel: +351 21 000 00 00'));
assert.ok(novva.includes('VAT: CHE-123.456.789'));
assert.equal(
  novva.some((line) => /tel/i.test(line) && /lisboa/i.test(line)),
  false,
  'city and Tel must be on separate lines'
);

const longStreet = getReceiptHeaderLines(
  {
    headerTitle: 'Cafe Roma',
    header: 'Rua das Portas de Santo Antao 150\nLisboa',
    businessName: 'Cafe Roma',
    address: 'Rua das Portas de Santo Antao 150',
    city: 'Lisboa',
    headerAlign: 'left',
  },
  20,
  { padLines: false }
);
assert.ok(longStreet.includes('Rua das Portas de'));
assert.ok(longStreet.includes('Santo Antao 150'));
assert.ok(longStreet.includes('Lisboa'));
assert.equal(
  longStreet.some((line) => line.length > 20),
  false,
  'overflow wraps to the next line instead of slicing'
);

const polaCustom = getReceiptHeaderLines(
  {
    headerTitle: 'pola pola',
    header: 'rue des saars 115\n2000 Neuchâtel',
    businessName: 'KABUL',
    address: 'Bahnhofstrasse 1, Zürich',
    city: 'Zürich',
    phone: '+41 79 000 00 00',
    vatNumber: 'CHE-123.321.432',
    headerAlign: 'center',
  },
  48,
  { padLines: false }
);
assert.deepEqual(polaCustom, ['pola pola', 'rue des saars 115', '2000 Neuchâtel']);

assert.deepEqual(
  receiptHeaderLinesFromPrintSettings({
    receiptHeaderLines: ['pola pola', 'rue des saars 115', '2000 Neuchâtel'],
  }),
  ['pola pola', 'rue des saars 115', '2000 Neuchâtel']
);

const polaFromArray = getReceiptHeaderLines(
  {
    headerTitle: '',
    header: '',
    headerLines: ['pola pola', 'rue des saars 115', '2000 Neuchâtel'],
    businessName: 'KABUL',
    headerAlign: 'center',
  },
  48,
  { padLines: false }
);
assert.deepEqual(polaFromArray, ['pola pola', 'rue des saars 115', '2000 Neuchâtel']);

const polaLiteral = getReceiptHeaderLines(
  {
    headerTitle: '',
    header: 'pola pola\nrue des saars 115\n2000 Neuchâtel',
    businessName: 'KABUL',
    address: 'rue des saars 115',
    city: '2000 Neuchâtel',
    phone: '+41 79 000 00 00',
    vatNumber: 'CHE-123.321.432',
    headerAlign: 'center',
  },
  48,
  { padLines: false }
);
assert.deepEqual(polaLiteral, ['pola pola', 'rue des saars 115', '2000 Neuchâtel']);

const novaGluedNoSpaces = splitReceiptHeaderDetailLine(
  'Rue des Draizes 22SuisseRue des Draizes 44NeuchâtelTel: 032 558 45 65VAT: CHE-131.903.128'
);
assert.ok(novaGluedNoSpaces.some((l) => /Rue des Draizes 22/i.test(l)));
assert.ok(novaGluedNoSpaces.some((l) => /Tel:\s*032/.test(l)));
assert.ok(novaGluedNoSpaces.some((l) => /VAT:\s*CHE-131/.test(l)));
assert.ok(novaGluedNoSpaces.includes('Suisse'));
assert.ok(novaGluedNoSpaces.some((l) => /Rue des Draizes 44/i.test(l)));

const nova = getReceiptHeaderLines(
  {
    headerTitle: '',
    header:
      'NOVA PORTUGALIA\nRue des Draizes 22, Neuchâtel\nTel: 032 558 45 65\nVAT: CHE-131.903.128',
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

const polacafeGlued = splitReceiptHeaderDetailLine(
  'POLACAFEBahnhofstrasse 1, ZürichTel: +41 79 000 00 00VAT: CHE-123.321.432 MWST'
);
assert.ok(polacafeGlued[0]?.includes('POLACAFE'));
assert.ok(polacafeGlued.some((l) => l.includes('Bahnhofstrasse')));
assert.ok(polacafeGlued.some((l) => /Tel:\s*\+41/.test(l)));

const polacafe = getReceiptHeaderLines(
  {
    headerTitle: '',
    header:
      'POLACAFE\nBahnhofstrasse 1, Zürich\nTel: +41 79 000 00 00\nVAT: CHE-123.321.432 MWST',
    businessName: 'POLACAFE',
    address: 'Bahnhofstrasse 1, Zürich',
    phone: '+41 79 000 00 00',
    vatNumber: 'CHE-123.321.432',
    headerAlign: 'center',
  },
  48,
  { padLines: false }
);
assert.ok(polacafe.length >= 4);
assert.equal(polacafe[0], 'POLACAFE');
assert.ok(polacafe.some((l) => l.includes('Bahnhofstrasse 1')));
assert.ok(polacafe.some((l) => /Tel:\s*\+41/.test(l)));
assert.ok(polacafe.some((l) => /VAT:\s*CHE-123/.test(l)));

const melimelo = splitReceiptHeaderDetailLine(
  'MELIMELORue Jaquet-Droz 2Neuchâtel Tel: 0793150600VAT: CHE-123.456.789'
);
assert.equal(melimelo[0], 'MELIMELO');
assert.ok(melimelo.some((l) => l.includes('Rue Jaquet-Droz')));
assert.ok(melimelo.some((l) => /Neuch/i.test(l)));
assert.ok(melimelo.some((l) => /Tel:\s*079/.test(l)));

const melimeloLines = getReceiptHeaderLines(
  {
    headerTitle: 'MELIMELO',
    header: 'Rue Jaquet-Droz 2\nNeuchâtel',
    businessName: 'MELIMELO',
    address: 'Rue Jaquet-Droz 2',
    city: 'Neuchâtel',
    phone: '0793150600',
    vatNumber: 'CHE-123.456.789',
    headerAlign: 'center',
  },
  32,
  { padLines: false, titleScale: 3 }
);
assert.equal(melimeloLines[0], 'MELIMELO');

const lowercaseRue = getReceiptHeaderLines(
  {
    headerTitle: '',
    header:
      'Le Bistrot Voyageur\n12 rue de la Gare\n2000 Neuchâtel\nTel: 032 000 00 00\nVAT: CHE-111.222.333',
    businessName: 'Le Bistrot Voyageur',
    address: '12 rue de la Gare',
    city: 'Neuchâtel',
    phone: '032 000 00 00',
    vatNumber: 'CHE-111.222.333',
    headerAlign: 'center',
  },
  32,
  { padLines: false }
);
assert.equal(lowercaseRue[0], 'Le Bistrot Voyageur');
assert.ok(lowercaseRue.some((l) => /rue de la Gare/i.test(l)));
assert.ok(lowercaseRue.some((l) => /Tel:\s*032/.test(l)));
assert.equal(
  lowercaseRue.some((l) => /tel/i.test(l) && /bistrot/i.test(l)),
  false,
  'store name and Tel must not share one line'
);

const longMashedBody = getReceiptHeaderLines(
  {
    headerTitle: '',
    header:
      'POLACAFE\nBahnhofstrasse 1 Zürich Tel: +41 79 000 00 00 VAT: CHE-123.321.432 MWST extra padding',
    businessName: 'POLACAFE',
    address: 'Bahnhofstrasse 1, Zürich',
    phone: '+41 79 000 00 00',
    vatNumber: 'CHE-123.321.432',
    headerAlign: 'center',
  },
  32,
  { padLines: false }
);
assert.equal(longMashedBody[0], 'POLACAFE');
assert.ok(longMashedBody.some((l) => /Bahnhofstrasse/i.test(l)));
assert.ok(longMashedBody.some((l) => /Tel:\s*\+41/.test(l)));

const emptyHeaderDefault = getReceiptHeaderLines(
  {
    headerTitle: '',
    header: '',
    businessName: 'KABUL',
    address: 'Bahnhofstrasse 1, Zürich',
    city: 'Zürich',
    phone: '+41 79 000 00 00',
    vatNumber: 'CHE-123.321.432',
    headerAlign: 'center',
  },
  48,
  { padLines: false }
);
assert.deepEqual(emptyHeaderDefault, ['KABUL']);

assert.deepEqual(
  healLegacyMashedReceiptHeaderFields(
    '',
    'POLACAFE Bahnhofstrasse 1, Zürich Tel: +41 79 000 00 00 VAT: CHE-123.321.432 MWST'
  ),
  { headerTitle: '', header: '' }
);

const healedDemoPrint = getReceiptHeaderLines(
  {
    ...receiptHeaderTxFromPrintSettings({
      receiptHeader:
        'POLACAFE Bahnhofstrasse 1, Zürich Tel: +41 79 000 00 00 VAT: CHE-123.321.432 MWST',
    }),
    businessName: 'KABUL',
    address: 'Bahnhofstrasse 1, Zürich',
    city: 'Zürich',
    phone: '+41 79 000 00 00',
    vatNumber: 'CHE-123.321.432',
    headerAlign: 'center',
  },
  48,
  { padLines: false }
);
assert.deepEqual(healedDemoPrint, ['KABUL']);

console.log('webpos-receipt-header.test.ts ok');
