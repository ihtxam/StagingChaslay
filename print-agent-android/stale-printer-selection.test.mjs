import assert from 'node:assert/strict';

/** Mirror of StalePrinterSelection (no Android runtime). */
function isStaleRealtek(value) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  if (/0BDA\s*:\s*8152/i.test(raw)) return true;
  if (/3034\s*:\s*33106/.test(raw)) return true;
  if (/10\s*\/\s*100\s*LAN/i.test(raw)) return true;
  return false;
}

function usbVidPid(id) {
  if (!id.startsWith('usb:')) return null;
  const parts = id.slice(4).split(':');
  if (parts.length < 2) return null;
  const vid = Number(parts[0]);
  const pid = Number(parts[1]);
  if (!Number.isInteger(vid) || !Number.isInteger(pid)) return null;
  return `${vid}:${pid}`;
}

const SUNMI_INTERNAL_ID = 'sunmi:internal';

function chooseDefaultId(currentId, endpoints) {
  const current = String(currentId || '').trim() || null;
  const matchLive = (id) => {
    const exact = endpoints.find((ep) => ep.id === id);
    if (exact) return exact;
    const key = usbVidPid(id);
    if (!key) return null;
    return endpoints.find((ep) => usbVidPid(ep.id) === key) || null;
  };
  const liveMatch = current ? matchLive(current) : null;
  const sunmiInternal = endpoints.find((ep) => ep.id === SUNMI_INTERNAL_ID) || null;
  const printerClass = endpoints.find((ep) => ep.usbPrinterClass) || null;
  const replace = current == null || isStaleRealtek(current) || liveMatch == null;
  if (sunmiInternal && (replace || (current && current.startsWith('usb:')))) {
    return sunmiInternal.id;
  }
  if (printerClass && replace) return printerClass.id;
  return (liveMatch && liveMatch.id) || current;
}

const printer = { id: 'usb:1046:20497', usbPrinterClass: true };
const lan = { id: 'lan:192.168.1.50', usbPrinterClass: false };
const realtekId = 'usb:3034:33106';

assert.equal(isStaleRealtek('USB printer 0BDA:8152'), true);
assert.equal(isStaleRealtek('0bda:8152'), true);
assert.equal(isStaleRealtek('3034:33106'), true);
assert.equal(isStaleRealtek('USB 10/100 LAN'), true);
assert.equal(isStaleRealtek(realtekId), true);
assert.equal(isStaleRealtek('USB Printer Port'), false);
assert.equal(isStaleRealtek(''), false);

assert.equal(chooseDefaultId(null, [printer]), printer.id);
assert.equal(chooseDefaultId(realtekId, [printer]), printer.id);
assert.equal(chooseDefaultId('USB printer 0BDA:8152', [printer, lan]), printer.id);
assert.equal(chooseDefaultId('USB 10/100 LAN', [printer]), printer.id);
assert.equal(chooseDefaultId('usb:999:1', [printer, lan]), printer.id);
assert.equal(chooseDefaultId(lan.id, [printer, lan]), lan.id);
assert.equal(chooseDefaultId(printer.id, [printer, lan]), printer.id);
assert.equal(chooseDefaultId('usb:1046:20497', [{ id: 'usb:1046:20497:SN1', usbPrinterClass: true }]), 'usb:1046:20497:SN1');
assert.equal(chooseDefaultId(realtekId, [lan]), realtekId);

const sunmi = { id: SUNMI_INTERNAL_ID, usbPrinterClass: false };
const sunmiUsbShadow = { id: 'usb:9999:1', usbPrinterClass: false };
assert.equal(chooseDefaultId(null, [sunmi, sunmiUsbShadow]), SUNMI_INTERNAL_ID);
assert.equal(chooseDefaultId(sunmiUsbShadow.id, [sunmi, sunmiUsbShadow]), SUNMI_INTERNAL_ID);
assert.equal(chooseDefaultId(sunmi.id, [sunmi, printer]), sunmi.id);

console.log('stale-printer-selection.test.mjs: ok');
