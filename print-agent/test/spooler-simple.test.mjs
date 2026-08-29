import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const VERSION = "1.9.0";

function read(rel) {
  return fs.readFileSync(path.join(here, rel), "utf8");
}

test("print-agent version is 1.9.0 in package.json, server.js, and download manifests", () => {
  const pkg = JSON.parse(read("../package.json"));
  const server = read("../server.js");
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(here, "..", "..", "backend", "public", "downloads", "reborn-print-agent.json"),
      "utf8"
    )
  );
  const legacy = JSON.parse(
    fs.readFileSync(
      path.join(here, "..", "..", "backend", "public", "downloads", "chaslayreborn-print-agent.json"),
      "utf8"
    )
  );
  assert.equal(pkg.version, VERSION);
  assert.match(server, new RegExp(`const VERSION = "${VERSION}"`));
  assert.equal(manifest.version, VERSION);
  assert.equal(legacy.version, VERSION);
  assert.match(server, /spooler-only-writeprinter/);
  assert.match(server, /cloud-relay/);
});

test("win-raw-print.ps1 is self-contained spooler-only (no COM helper, no slow-mode)", () => {
  const src = read("../win-raw-print.ps1");
  assert.equal(src.includes("win-com-raw-print"), false);
  assert.equal(src.includes("Invoke-ComDirectOrSpooler"), false);
  assert.equal(src.includes("Send-RawViaComPort"), false);
  assert.equal(src.includes("System.IO.Ports.SerialPort"), false);
  assert.equal(src.includes("Resolve-BtSlowMode"), false);
  assert.equal(src.includes("Split-CutSuffix"), false);
  assert.equal(src.includes("Wait-PrinterDrain"), false);
  assert.equal(src.includes("SlowBluetooth"), false);
  assert.match(src, /chunkSize = 4096/);
  assert.equal(/ChunkSize\s*=\s*64/.test(src), false);
  assert.equal(/ChunkSize\s*=\s*128/.test(src), false);
  assert.match(src, /Send-RawToPrinter -Printer \$PrinterName -Data \$bytes/);
  assert.match(src, /\$err -eq 1801/);
  assert.match(src, /\$err -eq 1905/);
});

test("win-raw-print-worker.ps1 is self-contained spooler-only", () => {
  const src = read("../win-raw-print-worker.ps1");
  assert.equal(src.includes("win-com-raw-print"), false);
  assert.equal(src.includes("Invoke-ComDirectOrSpooler"), false);
  assert.equal(src.includes("System.IO.Ports.SerialPort"), false);
  assert.equal(src.includes("Resolve-BtSlowMode"), false);
  assert.equal(src.includes("btSlowMode"), false);
  assert.match(src, /chunkSize = 4096/);
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
