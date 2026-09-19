/**
 * LuckyDoor / TSPL label helpers — run: npx tsx dashboard/src/lib/tspl-label.test.ts
 */
import assert from 'node:assert/strict';
import {
  buildTsplBitmapLabel,
  buildTsplCommandList,
  encodeTsplCommands,
  encodeWin1252,
  isTsplLabelPrinterName,
  tsplBarcodeFits,
  tsplCode128BBarcode,
  tsplQuote,
} from './tspl-label-core';

assert.equal(isTsplLabelPrinterName('EML-400L (4inch)'), true);
assert.equal(isTsplLabelPrinterName('LuckyDoor LP-80H'), true);
assert.equal(isTsplLabelPrinterName('XP-365B'), true);
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
assert.match(joined, /BARCODE \d+,\d+,"128M",/);
assert.match(joined, /">:7612345678901"/);
assert.match(joined, /PRINT 1,2/);
assert.ok(!joined.includes('ESC'));
assert.ok(!joined.includes('"128",'));

const numericEven = buildTsplCommandList({
  widthMm: 40,
  heightMm: 20,
  barcode: '200000000001',
  showBarcodeNumber: true,
});
const numericJoined = numericEven.join('\n');
assert.match(numericJoined, /">:200000000001"/);
assert.match(numericJoined, /TEXT \d+,\d+,"2",0,1,1,"200000000001"/);
assert.equal(
  tsplCode128BBarcode(8, 10, 56, 1, 2, '200000000001'),
  'BARCODE 8,10,"128M",56,0,0,1,2,">:200000000001"'
);

const bytes = encodeTsplCommands(cmds);
assert.equal(bytes[0], 0x53); // S of SIZE
assert.ok(bytes.includes(0x0d) && bytes.includes(0x0a));

assert.equal(tsplBarcodeFits('7612345678901', 40), true);
assert.equal(tsplBarcodeFits('TEST1234', 40), true);
assert.equal(tsplBarcodeFits('REBORN:O:a1b2c3d4-e5f6-7890-abcd-ef1234567890', 40), false);
assert.equal(tsplBarcodeFits('REBORN:O:a1b2c3d4-e5f6-7890-abcd-ef1234567890', 100), false);

const packed = new Uint8Array(40 * 20);
packed.fill(0xff);
const bmp = buildTsplBitmapLabel({
  widthMm: 40,
  heightMm: 20,
  bitmap: packed,
  widthPx: 320,
  heightPx: 20,
  copies: 1,
});
const bmpText = Buffer.from(bmp).toString('latin1');
assert.match(bmpText, /BITMAP 0,0,40,20,0,/);
assert.match(bmpText, /PRINT 1,1/);
assert.ok(bmp.length > 800);

console.log('tspl-label.test.ts ok');
