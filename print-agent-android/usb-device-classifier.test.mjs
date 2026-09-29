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

/** Mirror of UsbDeviceClassifier.NETWORK_PRODUCT_NAME (permission-gated name check). */
function looksLikeNetworkProductName(productName) {
  return /ethernet|802\.11|wi-?fi|rndis|usb\s*network|(^|[^a-z0-9])lan([^a-z0-9]|$)/i.test(productName);
}

const REALTEK_VENDOR_ID = 0x0bda;
function isNetworkAdapter({ vendorId, interfaceClass, productName, hasPermission }) {
  if (interfaceClass === 7) return false; // USB_CLASS_PRINTER
  if (vendorId === REALTEK_VENDOR_ID) return true;
  if (hasPermission && productName && looksLikeNetworkProductName(productName)) return true;
  return false;
}

assert.equal(looksLikeNetworkProductName('USB 10/100 LAN'), true);
assert.equal(looksLikeNetworkProductName('USB Ethernet Adapter'), true);
assert.equal(looksLikeNetworkProductName('Remote NDIS'), false);
assert.equal(looksLikeNetworkProductName('RNDIS Gadget'), true);
assert.equal(looksLikeNetworkProductName('802.11n NIC'), true);
assert.equal(looksLikeNetworkProductName('USB Network Adapter'), true);
assert.equal(looksLikeNetworkProductName('80mm Thermal Receipt Printer'), false);
assert.equal(isNetworkAdapter({ vendorId: 0x0bda, interfaceClass: 255, productName: 'USB 10/100 LAN', hasPermission: true }), true);
assert.equal(isNetworkAdapter({ vendorId: 0x0bda, interfaceClass: 255, productName: null, hasPermission: false }), true);
assert.equal(isNetworkAdapter({ vendorId: 0x0bda, interfaceClass: 7, productName: 'USB 10/100 LAN', hasPermission: true }), false);
assert.equal(isNetworkAdapter({ vendorId: 0x04b8, interfaceClass: 255, productName: 'USB 10/100 LAN', hasPermission: true }), true);
assert.equal(isNetworkAdapter({ vendorId: 0x04b8, interfaceClass: 255, productName: 'USB 10/100 LAN', hasPermission: false }), false);

/** Mirror of Sunmi internal USB shadow name check (AX8772B on D3 Mini). */
function isSunmiInternalUsbShadowName(productName, isSunmiDevice = true) {
  if (!isSunmiDevice) return false;
  if (!productName) return false;
  return /ax8772|built-?in|internal\s*print|sunmi\s*print/i.test(productName);
}

assert.equal(isSunmiInternalUsbShadowName('AX8772B'), true);
assert.equal(isSunmiInternalUsbShadowName('USB Printer'), false);
assert.equal(isSunmiInternalUsbShadowName('AX8772B', false), false);

console.log('usb-device-classifier.test.mjs: ok');
