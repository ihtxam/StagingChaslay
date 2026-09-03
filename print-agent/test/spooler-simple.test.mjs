import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const VERSION = "1.10.3";

function read(rel) {
  return fs.readFileSync(path.join(here, rel), "utf8");
}

test("print-agent version is 1.10.3 in package.json, server.js, and download manifest", () => {
  const pkg = JSON.parse(read("../package.json"));
  const server = read("../server.js");
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(here, "..", "..", "backend", "public", "downloads", "reborn-print-agent.json"),
      "utf8"
    )
  );
  assert.equal(pkg.version, VERSION);
  assert.match(server, new RegExp(`const VERSION = "${VERSION}"`));
  assert.equal(manifest.version, VERSION);
  assert.equal(manifest.name, "reborn-print-agent");
  assert.equal(manifest.setupFile, "reborn-print-agent-setup.exe");
  assert.match(server, /spooler-only-writeprinter/);
  assert.match(server, /cloud-relay/);
  assert.match(server, /bt-com-paced-spooler/);
  assert.match(server, /com-serial-write-fallback/);
  assert.match(server, /ensurePrintWorker/);
  assert.match(server, /bt-cut-trailer/);
  assert.match(server, /usb-unpaced-raw/);
  assert.match(server, /printViaWorker/);
  assert.match(server, /enqueuePrint/);
  assert.match(server, /timeout: 180000/);
});

function extractPsFunction(src, name) {
  const m = src.match(new RegExp(`function ${name}[\\s\\S]*?(?=\\r?\\nfunction )`));
  return m ? m[0] : "";
}

test("win-raw-print.ps1 is self-contained spooler-only (no COM helper, no slow-mode)", () => {
  const src = read("../win-raw-print.ps1");
  const cutTrailer = extractPsFunction(src, "Get-BtCutTrailer");
  assert.equal(src.includes("win-com-raw-print"), false);
  assert.equal(src.includes("Invoke-ComDirectOrSpooler"), false);
  assert.equal(src.includes("Send-RawViaComPort"), false);
  assert.equal(src.includes("System.IO.Ports.SerialPort"), false);
  assert.equal(src.includes("Resolve-BtSlowMode"), false);
  assert.match(src, /Split-CutSuffix/);
  assert.equal(src.includes("Wait-PrinterDrain"), false);
  assert.match(src, /chunkSize = 4096/);
  assert.match(src, /Test-NeedsPacedWrite/);
  assert.match(src, /Test-ComSerialPort/);
  assert.match(src, /ComSerialPort:\$isComPort/);
  assert.match(src, /writeChunk = if \(\$isComPort\) \{ 32 \} else \{ 96 \}/);
  assert.match(src, /\$DelayMs -eq 0 -and -not \$ComSerialPort/);
  assert.match(src, /elseif \(\$DelayMs -gt 0\) \{ 6 \}/);
  assert.match(src, /FlushPrinter/);
  assert.match(src, /Get-BtCutTrailer/);
  assert.match(cutTrailer, /0x1D, 0x56, 0x00/);
  assert.doesNotMatch(cutTrailer, /0x1D, 0x56, 0x01/);
  assert.doesNotMatch(cutTrailer, /0x1B, 0x6D/);
  assert.match(src, /\$cutSuffix/);
  assert.match(src, /Start-Sleep -Milliseconds \$drainMs/);
  assert.match(src, /usb\\d\+\|usb00\|usbprint/);
  assert.doesNotMatch(extractPsFunction(src, "Test-NeedsPacedWrite"), /xprinter\|gprinter/);
  assert.doesNotMatch(extractPsFunction(src, "Test-NeedsPacedWrite"), /ByteCount -ge 1800/);
  assert.equal(/ChunkSize\s*=\s*64/.test(src), false);
  assert.equal(/ChunkSize\s*=\s*128/.test(src), false);
  assert.match(src, /Send-RawToPrinter -Printer \$PrinterName -Data \$bytes/);
  assert.match(src, /\$err -eq 1801/);
  assert.match(src, /\$err -eq 1905/);
});

test("win-raw-print-worker.ps1 is self-contained spooler-only", () => {
  const src = read("../win-raw-print-worker.ps1");
  const cutTrailer = extractPsFunction(src, "Get-BtCutTrailer");
  assert.equal(src.includes("win-com-raw-print"), false);
  assert.equal(src.includes("Invoke-ComDirectOrSpooler"), false);
  assert.equal(src.includes("System.IO.Ports.SerialPort"), false);
  assert.equal(src.includes("Resolve-BtSlowMode"), false);
  assert.equal(src.includes("btSlowMode"), false);
  assert.match(src, /chunkSize = 4096/);
  assert.match(src, /Test-NeedsPacedWrite/);
  assert.match(src, /Split-CutSuffix/);
  assert.match(src, /Test-ComSerialPort/);
  assert.match(src, /ComSerialPort:\$isComPort/);
  assert.match(src, /writeChunk = if \(\$isComPort\) \{ 32 \} else \{ 96 \}/);
  assert.match(src, /\$DelayMs -eq 0 -and -not \$ComSerialPort/);
  assert.match(src, /elseif \(\$DelayMs -gt 0\) \{ 6 \}/);
  assert.match(src, /FlushPrinter/);
  assert.match(src, /Get-BtCutTrailer/);
  assert.match(cutTrailer, /0x1D, 0x56, 0x00/);
  assert.doesNotMatch(cutTrailer, /0x1D, 0x56, 0x01/);
  assert.doesNotMatch(cutTrailer, /0x1B, 0x6D/);
  assert.match(src, /\$cutSuffix/);
  assert.match(src, /Start-Sleep -Milliseconds \$drainMs/);
  assert.match(src, /usb\\d\+\|usb00\|usbprint/);
  assert.doesNotMatch(extractPsFunction(src, "Test-NeedsPacedWrite"), /xprinter\|gprinter/);
  assert.doesNotMatch(extractPsFunction(src, "Test-NeedsPacedWrite"), /ByteCount -ge 1800/);
});

test("server.js does not copy or invoke COM-direct / BT slow-mode", () => {
  const src = read("../server.js");
  assert.equal(src.includes("win-com-raw-print.ps1"), false);
  assert.equal(src.includes("normalizeComDirectMode"), false);
  assert.equal(src.includes("normalizeBtSlowMode"), false);
  assert.equal(src.includes("bt-com-direct-serial"), false);
  assert.equal(src.includes("bt-com-chunked-raw"), false);
  assert.equal(src.includes("-BtSlowMode"), false);
  assert.equal(src.includes("-ComDirectMode"), false);
  assert.equal(JSON.parse(read("../package.json")).pkg.assets.includes("win-com-raw-print.ps1"), false);
});

test("win-com-raw-print.ps1 is removed", () => {
  assert.equal(fs.existsSync(path.join(here, "..", "win-com-raw-print.ps1")), false);
});
