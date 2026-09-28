import assert from 'node:assert/strict';

/** Mirror of UsbDeviceClassifier keyword rules for regression tests (no Android runtime). */
function shouldExcludeByName(productName, manufacturerName = '') {
  const blob = `${productName} ${manufacturerName}`.toLowerCase();
  const keywords = [
    'barcode',
    'scanner',
    'rfid',
    'mifare',
    'card reader',
    'ccid',
    'keyboard',
    'wedge',
  ];
  return keywords.some((k) => blob.includes(k));
}

function looksLikePrinterName(productName) {
  const blob = productName.toLowerCase();
  return ['print', 'receipt', 'thermal', 'xprinter', 'epson'].some((k) => blob.includes(k));
}

assert.equal(shouldExcludeByName('USB Barcode Scanner'), true);
assert.equal(shouldExcludeByName('RFID Card Reader'), true);
assert.equal(shouldExcludeByName('2D Barcode Scanner', 'Generic'), true);
assert.equal(shouldExcludeByName('USB Serial'), false);
assert.equal(looksLikePrinterName('80mm Thermal Receipt Printer'), true);
assert.equal(looksLikePrinterName('USB Barcode Scanner'), false);

console.log('usb-device-classifier.test.mjs: ok');
