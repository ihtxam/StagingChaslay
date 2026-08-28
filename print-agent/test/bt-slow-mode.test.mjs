import assert from "node:assert/strict";
import test from "node:test";

/** Mirror of Test-ComPortPrinter in win-com-raw-print.ps1 */
function extractComPort(text) {
  if (!text || !String(text).trim()) return "";
  const t = String(text).trim();
  let m = t.match(/\(COM(\d+)\)/i);
  if (m) return `COM${m[1]}`;
  m = t.match(/[·•\u00B7]\s*(COM\d+)\s*:?\s*$/i);
  if (m) return m[1].toUpperCase();
  m = t.match(/(?:^|\\\\\.\\)(COM\d+)\s*:?\s*$/i);
  if (m) return m[1].toUpperCase();
  m = t.match(/\b(COM\d+)\b/i);
  if (m) return m[1].toUpperCase();
  return "";
}

function testComPortPrinter(printer, portName) {
  if (extractComPort(portName)) return true;
  if (extractComPort(printer)) return true;
  if (/^COM\d+$/i.test(portName)) return true;
  if (/\(COM\d+\)/i.test(printer)) return true;
  const lower = `${printer} ${portName}`.toLowerCase();
  if (/bluetooth|bt spp|serial|rfcomm/.test(lower)) return true;
  return false;
}

/** Mirror of Resolve-BtSlowMode in win-com-raw-print.ps1 */
function resolveBtSlowMode(mode, printer, portName) {
  const isComBt = testComPortPrinter(printer, portName);
  switch (mode) {
    case "on":
      return isComBt;
    case "off":
      return false;
    default:
      return isComBt;
  }
}

test("Resolve-BtSlowMode on does not slow USB/LPT/network printers", () => {
  const fastPorts = [
    ["Receipt USB", "USB001"],
    ["Kitchen", "LPT1"],
    ["Network printer", "IP_192.168.1.50"],
    ["Receipt", "WSD-1234"],
  ];
  for (const [printer, port] of fastPorts) {
    assert.equal(
      resolveBtSlowMode("on", printer, port),
      false,
      `mode=on printer=${printer} port=${port}`
    );
    assert.equal(
      resolveBtSlowMode("auto", printer, port),
      false,
      `mode=auto printer=${printer} port=${port}`
    );
  }
});

test("Resolve-BtSlowMode on enables slow path for COM/BT printers", () => {
  const slowPorts = [
    ["cuisine · COM4", "COM4"],
    ["RPP02 (COM7)", "COM7"],
    ["BT Kitchen", "Bluetooth serial · COM5"],
    ["Bluetooth receipt", "USB001"],
  ];
  for (const [printer, port] of slowPorts) {
    assert.equal(
      resolveBtSlowMode("on", printer, port),
      true,
      `mode=on printer=${printer} port=${port}`
    );
  }
});

test("Resolve-BtSlowMode off disables slow path even for COM printers", () => {
  assert.equal(resolveBtSlowMode("off", "cuisine · COM4", "COM4"), false);
});
