/**
 * Run: npx tsx dashboard/src/lib/printer-kind.test.ts
 */
import assert from 'node:assert/strict';
import { looksLikeLabelPrinterName } from './printer-kind';

assert.equal(looksLikeLabelPrinterName('XP-365B'), true);
assert.equal(looksLikeLabelPrinterName('NIIMBOT K3'), true);
assert.equal(looksLikeLabelPrinterName('LuckyDoor EML-400L'), true);
assert.equal(looksLikeLabelPrinterName('USB Label Printer'), true);
assert.equal(looksLikeLabelPrinterName('POS-80C'), false);
assert.equal(looksLikeLabelPrinterName('XP-80'), false);
assert.equal(looksLikeLabelPrinterName('chaslay80'), false);
assert.equal(looksLikeLabelPrinterName('RPP02 (COM7)'), false);
assert.equal(looksLikeLabelPrinterName(''), false);

console.log('printer-kind.test.ts ok');
