/**
 * Sanity-check receipt thermal QR ESC/POS bytes (module 2 + EC-L).
 * Run: node scripts/verify-receipt-qr-size.mjs
 */

const ESCPOS_EC_BYTE = { L: 0x30, M: 0x31, Q: 0x32, H: 0x33 };

function escposQrCode(data, moduleSize = 4, errorCorrection = 'M') {
  const payload = new TextEncoder().encode(data);
  const storeLen = payload.length + 3;
  const pL = storeLen & 0xff;
  const pH = (storeLen >> 8) & 0xff;
  const cn = 0x31;
  const model = [0x1d, 0x28, 0x6b, 0x04, 0x00, cn, 0x41, 0x32, 0x00];
  const sizeCmd = [0x1d, 0x28, 0x6b, 0x03, 0x00, cn, 0x43, Math.max(1, Math.min(16, moduleSize))];
  const errorLevel = [0x1d, 0x28, 0x6b, 0x03, 0x00, cn, 0x45, ESCPOS_EC_BYTE[errorCorrection]];
  const storeHeader = [0x1d, 0x28, 0x6b, pL, pH, cn, 0x50, 0x30];
  const print = [0x1d, 0x28, 0x6b, 0x03, 0x00, cn, 0x51, 0x30];
  return Uint8Array.from([...model, ...sizeCmd, ...errorLevel, ...storeHeader, ...payload, ...print]);
}

const RECEIPT_QR_MODULE_SIZE = 2;
const RECEIPT_QR_ERROR_CORRECTION = 'L';
const sampleUrl = 'https://pay.chaslay.com/receipt/abc123';

const bytes = escposQrCode(sampleUrl, RECEIPT_QR_MODULE_SIZE, RECEIPT_QR_ERROR_CORRECTION);

function findSubarray(haystack, needle) {
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    if (needle.every((b, j) => haystack[i + j] === b)) return i;
  }
  return -1;
}

const sizeIdx = findSubarray(bytes, [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43]);
const ecIdx = findSubarray(bytes, [0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45]);

const moduleByte = sizeIdx >= 0 ? bytes[sizeIdx + 7] : null;
const ecByte = ecIdx >= 0 ? bytes[ecIdx + 7] : null;

const ok =
  moduleByte === RECEIPT_QR_MODULE_SIZE &&
  ecByte === ESCPOS_EC_BYTE[RECEIPT_QR_ERROR_CORRECTION];

console.log('Receipt QR ESC/POS check:', ok ? 'PASS' : 'FAIL');
console.log(`  module size: ${moduleByte} (expected ${RECEIPT_QR_MODULE_SIZE})`);
console.log(`  error correction: 0x${ecByte?.toString(16)} (expected 0x30 = L)`);
console.log(`  payload bytes: ${bytes.length}`);

if (!ok) process.exit(1);
