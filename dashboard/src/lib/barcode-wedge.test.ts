/**
 * Barcode wedge + scanner sanitizers — run: npx tsx dashboard/src/lib/barcode-wedge.test.ts
 */
import assert from 'node:assert/strict';
import {
  sanitizeBarcodeFieldValue,
  sanitizeScanCode,
  stripScannerControlChars,
} from './product-scan-codes';

assert.equal(stripScannerControlChars('76\x1D0123456789012'), '760123456789012');
assert.equal(sanitizeScanCode(' 76\x1D0123456789012\r'), '760123456789012');
assert.equal(sanitizeBarcodeFieldValue('76\x1D0123456789012'), '760123456789012');
assert.equal(sanitizeBarcodeFieldValue('ABC-123\x04'), '123');

console.log('barcode-wedge.test.ts OK');
