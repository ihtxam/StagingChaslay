/**
 * Sanity-check receipt thermal QR raster size + ECC-M.
 * Run: node scripts/verify-receipt-qr-size.mjs
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const qrTs = readFileSync(join(root, 'dashboard/src/lib/qr.ts'), 'utf8');
const androidKt = readFileSync(
  join(root, 'app/src/main/java/com/chaslay/pos/printer/BluetoothPrinterService.kt'),
  'utf8'
);

function readConst(source, name) {
  const m = source.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
  return m ? Number(m[1]) : null;
}

/** Expected sizes after +20% scale (Nov 2026). */
const EXPECT = {
  RECEIPT_QR_RASTER_PX_80: 144,
  RECEIPT_QR_RASTER_PX_58: 120,
  GIFT_CARD_REDEEM_QR_RASTER_PX_80: 144,
  GIFT_CARD_REDEEM_QR_RASTER_PX_58: 115,
  RECEIPT_DUAL_QR_RASTER_PX_80: 35,
  RECEIPT_DUAL_QR_RASTER_PX_58: 28,
  RECEIPT_QR_CANVAS_PX_80: 193,
  RECEIPT_QR_CANVAS_PX_58: 121,
  RECEIPT_QR_ESCPOS_MODULE_SIZE: 2,
  GIFT_CARD_REDEEM_QR_ESCPOS_MODULE_SIZE: 5,
  DELIVERY_SLIP_QR_RASTER_PX_80: 384,
  DELIVERY_SLIP_QR_RASTER_PX_58: 336,
};

const webEccM = /ecc:\s*'M'/.test(qrTs) || /ecc = opts\?\.ecc \?\? 'M'/.test(qrTs);
const androidEccM = /ErrorCorrectionLevel\.M/.test(
  readFileSync(join(root, 'app/src/main/java/com/chaslay/pos/receipt/ReceiptQrGenerator.kt'), 'utf8')
);

let ok = webEccM && androidEccM;
console.log('Receipt QR size check:', ok ? 'PASS' : 'FAIL');
console.log(`  WebPOS ECC-M: ${webEccM}`);
console.log(`  Android ECC-M: ${androidEccM}`);

for (const [name, expected] of Object.entries(EXPECT)) {
  const web = readConst(qrTs, name);
  const and = name.startsWith('RECEIPT_QR_RASTER')
    ? readConst(androidKt, name)
    : null;
  const match = web === expected && (and === null || and === expected);
  if (!match) ok = false;
  console.log(`  ${name}: web=${web} android=${and ?? 'n/a'} (expected ${expected}) ${match ? 'OK' : 'FAIL'}`);
}

if (!ok) process.exit(1);
