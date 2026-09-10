/**
 * LuckyDoor / TSPL label helpers — run: npx tsx dashboard/src/lib/tspl-label.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildTsplCommandList,
  encodeTsplCommands,
  encodeWin1252,
  isTsplLabelPrinterName,
  tsplQuote,
} from './tspl-label-core';

assert.equal(isTsplLabelPrinterName('EML-400L (4inch)'), true);
assert.equal(isTsplLabelPrinterName('LuckyDoor LP-80H'), true);
assert.equal(isTsplLabelPrinterName('POS-80C'), false);
assert.equal(isTsplLabelPrinterName('NIIMBOT K3'), false);
assert.equal(isTsplLabelPrinterName('Microsoft Print to PDF'), false);

assert.equal(tsplQuote('Café "Special"\nLine'), "Café 'Special' Line");

const euro = encodeWin1252('CHF 2.50 €');
assert.equal(euro[euro.length - 1], 0x80);

const cmds = buildTsplCommandList({
  widthMm: 100,
  heightMm: 50,
  storeName: 'Chaslay',
  productName: 'Pain au chocolat',
  barcode: '7612345678901',
  copies: 2,
});
const joined = cmds.join('\n');
assert.match(joined, /SIZE 100 mm,50 mm/);
assert.match(joined, /CODEPAGE 1252/);
assert.match(joined, /BARCODE \d+,\d+,"128",/);
assert.match(joined, /"7612345678901"/);
assert.match(joined, /PRINT 1,2/);
assert.ok(!joined.includes('ESC'));

const bytes = encodeTsplCommands(cmds);
assert.equal(bytes[0], 0x53); // S of SIZE
assert.ok(bytes.includes(0x0d) && bytes.includes(0x0a));

console.log('tspl-label.test.ts ok');
