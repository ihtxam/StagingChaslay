/**
 * Receipt QR must not fall back to native ESC/POS QR on Android (bridge garbles GS ( k).
 * Run: npx tsx dashboard/src/lib/webpos-receipt-qr.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const receiptSrc = fs.readFileSync(path.join(dir, 'webpos-receipt.ts'), 'utf8');

assert.match(receiptSrc, /function nativeEscposQrFallback/);
assert.match(receiptSrc, /isAndroidDevice\(\)\) return null/);
assert.doesNotMatch(
  receiptSrc,
  /buildReceiptEscPos[\s\S]*?\|\|\s*escposQrCode\(/,
  'buildReceiptEscPos should not call escposQrCode directly'
);

console.log('webpos-receipt-qr.test.ts: ok');
