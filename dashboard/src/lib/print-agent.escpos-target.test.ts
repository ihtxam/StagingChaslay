/**
 * Kitchen/receipt ESC/POS must not target label printers.
 * Run: npx tsx dashboard/src/lib/print-agent.escpos-target.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { looksLikeLabelPrinterName } from './printer-kind';

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'print-agent.ts'), 'utf8');

assert.match(src, /looksLikeLabelPrinterName/);
assert.match(src, /export function resolveEscPosPrinterName/);
assert.match(src, /isEscPosTicketPrinterName/);
assert.match(src, /looksLikeThermal80mm[\s\S]*looksLikeLabelPrinterName/);

assert.equal(looksLikeLabelPrinterName('XP-365B'), true);
assert.equal(looksLikeLabelPrinterName('POS-80C'), false);

console.log('print-agent.escpos-target.test.ts ok');
