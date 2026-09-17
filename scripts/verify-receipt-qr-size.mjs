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

const EXPECT_MAX = 170;

const webMax = readConst(qrTs, 'RECEIPT_QR_RASTER_PX_MAX');
const web80 = readConst(qrTs, 'RECEIPT_QR_RASTER_PX_80') ?? webMax;
const web58 = readConst(qrTs, 'RECEIPT_QR_RASTER_PX_58') ?? webMax;
const and80 = readConst(androidKt, 'RECEIPT_QR_RASTER_PX_80');
const and58 = readConst(androidKt, 'RECEIPT_QR_RASTER_PX_58');
const webEccM = /ecc:\s*'M'/.test(qrTs) || /ecc = opts\?\.ecc \?\? 'M'/.test(qrTs);
const androidEccM = /ErrorCorrectionLevel\.M/.test(
  readFileSync(join(root, 'app/src/main/java/com/chaslay/pos/receipt/ReceiptQrGenerator.kt'), 'utf8')
);

const webOk = webMax === EXPECT_MAX && web80 <= EXPECT_MAX && web58 <= EXPECT_MAX;
const androidOk =
  (and80 == null || and80 <= EXPECT_MAX) && (and58 == null || and58 <= EXPECT_MAX);
const ok = webOk && androidOk && webEccM && androidEccM;

console.log('Receipt QR size check:', ok ? 'PASS' : 'FAIL');
console.log(`  WebPOS max: ${webMax} (expected ${EXPECT_MAX})`);
console.log(`  WebPOS 80mm: ${web80} (cap ${EXPECT_MAX})`);
console.log(`  WebPOS 58mm: ${web58} (cap ${EXPECT_MAX})`);
if (and80 != null) console.log(`  Native Android 80mm: ${and80} (cap ${EXPECT_MAX})`);
if (and58 != null) console.log(`  Native Android 58mm: ${and58} (cap ${EXPECT_MAX})`);
console.log(`  WebPOS ECC-M: ${webEccM}`);
console.log(`  Android ECC-M: ${androidEccM}`);

const slip80 = readConst(qrTs, 'DELIVERY_SLIP_QR_RASTER_PX_80');
const slip58 = readConst(qrTs, 'DELIVERY_SLIP_QR_RASTER_PX_58');
const slipOk = slip80 === 384 && slip58 === 280;
console.log(`  Delivery slip QR 80mm: ${slip80} (expected 384)`);
console.log(`  Delivery slip QR 58mm: ${slip58} (expected 280)`);

if (!ok || !slipOk) process.exit(1);
