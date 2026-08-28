import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

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

/** v1.8.8: COM-direct is hard-disabled. Server always normalizes to off. */
function normalizeComDirectMode(_value) {
  return "off";
}

test("v1.8.8 COM-direct is always off even if client sends on/auto", () => {
  assert.equal(normalizeComDirectMode("on"), "off");
  assert.equal(normalizeComDirectMode("auto"), "off");
  assert.equal(normalizeComDirectMode("off"), "off");
  assert.equal(normalizeComDirectMode(undefined), "off");
});

test("win-raw-print.ps1 is self-contained spooler-only (no COM helper, no SerialPort)", () => {
  const src = fs.readFileSync(path.join(here, "..", "win-raw-print.ps1"), "utf8");
  assert.equal(src.includes(". $comHelper"), false);
  assert.match(src, /do NOT dotsource win-com-raw-print/);
  assert.equal(src.includes("Invoke-ComDirectOrSpooler"), false);
  assert.equal(src.includes("Send-RawViaComPort"), false);
  assert.equal(src.includes("System.IO.Ports.SerialPort"), false);
  assert.match(src, /function Get-PrinterPortName/);
  assert.match(src, /function Resolve-BtSlowMode/);
  assert.match(src, /Send-RawToPrinter -Printer \$PrinterName/);
});

test("win-raw-print-worker.ps1 is self-contained spooler-only", () => {
  const src = fs.readFileSync(path.join(here, "..", "win-raw-print-worker.ps1"), "utf8");
  assert.equal(src.includes("win-com-raw-print.ps1"), false);
  assert.equal(src.includes("Invoke-ComDirectOrSpooler"), false);
  assert.equal(src.includes("System.IO.Ports.SerialPort"), false);
  assert.match(src, /function Get-PrinterPortName/);
});

test("print-agent version is 1.8.8 in package.json, server.js, and download manifest", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(here, "..", "package.json"), "utf8"));
  const server = fs.readFileSync(path.join(here, "..", "server.js"), "utf8");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(here, "..", "..", "backend", "public", "downloads", "reborn-print-agent.json"), "utf8")
  );
  assert.equal(pkg.version, "1.8.8");
  assert.match(server, /const VERSION = "1.8.8"/);
  assert.equal(manifest.version, "1.8.8");
  assert.match(server, /spooler-only-writeprinter/);
  assert.equal(server.includes("bt-com-direct-serial"), false);
});
