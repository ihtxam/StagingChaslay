/**
 * Label protocol picker — run: npx tsx dashboard/src/lib/label-print-protocol.test.ts
 */
import assert from 'node:assert/strict';
import { isTsplLabelPrinterName } from './tspl-label-core';
import { pickPreferredLabelPrinter, printerUsesLabelProtocol, resolveLabelPrintProtocol } from './label-print-protocol';

assert.equal(isTsplLabelPrinterName('XP-365B'), true);
assert.equal(isTsplLabelPrinterName('HPRT HD42'), true);
assert.equal(isTsplLabelPrinterName('USB Label Printer'), true);
assert.equal(isTsplLabelPrinterName('POS-80C'), false);

assert.equal(
  resolveLabelPrintProtocol(
    { printers: [{ name: 'XP-365B', printLabels: true, enabled: true }] },
    'XP-365B'
  ),
  'tspl'
);

assert.equal(
  resolveLabelPrintProtocol(
    { printers: [{ name: 'NIIMBOT B3S', printLabels: true, enabled: true }] },
    'NIIMBOT B3S'
  ),
  'niimbot'
);

assert.equal(
  resolveLabelPrintProtocol(
    {
      printers: [{ name: 'USB004', printLabels: true, enabled: true, portName: 'USB005' }],
    },
    'USB004'
  ),
  'tspl'
);

assert.equal(
  resolveLabelPrintProtocol(
    { printers: [{ name: 'POS-80C', printLabels: true, enabled: true }] },
    'POS-80C'
  ),
  'escpos'
);

assert.equal(
  pickPreferredLabelPrinter({
    printers: [
      { name: 'POS-80C', printLabels: true, enabled: true },
      { name: 'USB004', printLabels: true, enabled: true, portName: 'USB005' },
    ],
  })?.name,
  'USB004'
);

assert.equal(
  resolveLabelPrintProtocol(
    {
      printers: [
        { name: 'POS-80C', printLabels: true, enabled: true },
        { name: 'USB004', printLabels: true, enabled: true, portName: 'USB005' },
      ],
    },
    'USB004'
  ),
  'tspl'
);

assert.equal(
  printerUsesLabelProtocol(
    { printers: [{ name: 'USB004', printLabels: true, enabled: true, portName: 'USB005' }] },
    'USB004'
  ),
  true
);
assert.equal(
  printerUsesLabelProtocol({ printers: [{ name: 'POS-80C', printReceipts: true, enabled: true }] }, 'POS-80C'),
  false
);
assert.equal(
  printerUsesLabelProtocol({ printers: [{ name: 'NIIMBOT K3', printLabels: true, enabled: true }] }, 'NIIMBOT K3'),
  true
);

console.log('label-print-protocol.test.ts ok');
