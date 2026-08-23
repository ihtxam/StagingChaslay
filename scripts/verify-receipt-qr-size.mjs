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

const EXPECT_80 = 180;
const EXPECT_58 = 136;

const web80 = readConst(qrTs, 'RECEIPT_QR_RASTER_PX_80');
const web58 = readConst(qrTs, 'RECEIPT_QR_RASTER_PX_58');
const and80 = readConst(androidKt, 'RECEIPT_QR_RASTER_PX_80');
const and58 = readConst(androidKt, 'RECEIPT_QR_RASTER_PX_58');
const webEccM = /ecc:\s*'M'/.test(qrTs) || /ecc = opts\?\.ecc \?\? 'M'/.test(qrTs);
const androidEccM = /ErrorCorrectionLevel\.M/.test(
  readFileSync(join(root, 'app/src/main/java/com/chaslay/pos/receipt/ReceiptQrGenerator.kt'), 'utf8')
);

const ok =
  web80 === EXPECT_80 &&
  web58 === EXPECT_58 &&
  and80 === EXPECT_80 &&
  and58 === EXPECT_58 &&
  webEccM &&
  androidEccM;

console.log('Receipt QR size check:', ok ? 'PASS' : 'FAIL');
console.log(`  WebPOS 80mm: ${web80} (expected ${EXPECT_80})`);
console.log(`  WebPOS 58mm: ${web58} (expected ${EXPECT_58})`);
console.log(`  Android 80mm: ${and80} (expected ${EXPECT_80})`);
console.log(`  Android 58mm: ${and58} (expected ${EXPECT_58})`);
console.log(`  WebPOS ECC-M: ${webEccM}`);
console.log(`  Android ECC-M: ${androidEccM}`);

const slip80 = readConst(qrTs, 'DELIVERY_SLIP_QR_RASTER_PX_80');
const slip58 = readConst(qrTs, 'DELIVERY_SLIP_QR_RASTER_PX_58');
const slipOk = slip80 === 384 && slip58 === 280;
console.log(`  Delivery slip QR 80mm: ${slip80} (expected 384)`);
console.log(`  Delivery slip QR 58mm: ${slip58} (expected 280)`);

if (!ok || !slipOk) process.exit(1);
