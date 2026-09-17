import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildNiimbotJobPackets,
  buildTestPatternBitmap,
  niimbotPacket,
  extractComPort,
  extractWindowsUsbPort,
  detectNiimbotProfile,
  chooseNiimbotTransport,
  describeSerialFailure,
  printNiimbotLabel,
  WAKE_BYTES,
  countPixelsForLine,
} = require("../niimbot-client.js");

const here = path.dirname(fileURLToPath(import.meta.url));
const VERSION = "1.10.4";

function read(rel) {
  return fs.readFileSync(path.join(here, rel), "utf8");
}

test("print-agent version is 1.10.4 in package.json, server.js, and download manifest", () => {
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
  assert.equal(JSON.parse(read("../package.json")).pkg.assets.includes("win-niimbot-print.ps1"), true);
});

test("K3 profile uses 1-byte START_PRINT and 4-byte SET_DIMENSION (niimprint USB captures)", () => {
  assert.equal(detectNiimbotProfile("NIIMBOT K3", "USB005"), "k3");
  const w = 64;
  const h = 32;
  const rowBytes = Math.ceil(w / 8);
  const bitmap = Buffer.alloc(rowBytes * h, 0xff);
  const { packets, profile } = buildNiimbotJobPackets(bitmap, w, h, 3, {
    printerName: "NIIMBOT K3",
  });
  assert.equal(profile, "k3");
  const start = packets.find((p) => p[2] === 0x01);
  assert.ok(start);
  assert.equal(start[3], 1);
  assert.equal(start[4], 1);
  const dim = packets.find((p) => p[2] === 0x13);
  assert.ok(dim);
  assert.equal(dim[3], 4);
});

test("B21 profile uses 2-byte START_PRINT and 6-byte SET_DIMENSION", () => {
  const w = 64;
  const h = 32;
  const rowBytes = Math.ceil(w / 8);
  const bitmap = Buffer.alloc(rowBytes * h, 0xff);
  const { packets, profile } = buildNiimbotJobPackets(bitmap, w, h, 3, {
    printerName: "Niimbot B21",
    profile: "b21",
  });
  assert.equal(profile, "b21");
  const start = packets.find((p) => p[2] === 0x01);
  assert.equal(start[3], 2);
  assert.deepEqual([start[4], start[5]], [0, 1]);
  const dim = packets.find((p) => p[2] === 0x13);
  assert.equal(dim[3], 6);
});

test("job includes status poll packets before END_PRINT", () => {
  const w = 32;
  const h = 16;
  const bitmap = buildTestPatternBitmap(w, h);
  const { packets } = buildNiimbotJobPackets(bitmap, w, h, 3, { printerName: "K3" });
  const endPageIdx = packets.findIndex((p) => p[2] === 0xe3);
  const endPrintIdx = packets.findIndex((p) => p[2] === 0xf3);
  assert.ok(endPageIdx >= 0);
  assert.ok(endPrintIdx > endPageIdx);
  const polls = packets.slice(endPageIdx + 1, endPrintIdx).filter((p) => p[2] === 0xa3);
  assert.ok(polls.length >= 6);
});

test("wake bytes are 0x54 0x01 per official NIIMBOT.exe captures", () => {
  assert.deepEqual([...WAKE_BYTES], [0x54, 0x01]);
});

test("win-niimbot-print.ps1 writes one packet per WritePrinter with dual wake bytes", () => {
  const src = read("../win-niimbot-print.ps1");
  assert.match(src, /Write-OnePacket/);
  assert.match(src, /0x54,\s*0x01/);
  assert.match(src, /0xA3/);
  assert.match(src, /Get-PacketDelayMs/);
  assert.equal(src.includes("Get-BtCutTrailer"), false);
  assert.match(src, /foreach \(\$pkt in \$packets\)/);
});

test("niimbot packets are framed and raster lines use type 0x85", () => {
  const w = 64;
  const h = 32;
  const rowBytes = Math.ceil(w / 8);
  const bitmap = Buffer.alloc(rowBytes * h, 0xff);
  const { packets } = buildNiimbotJobPackets(bitmap, w, h, 3, { printerName: "K3" });
  assert.ok(packets.length > h + 4);
  for (const pkt of packets) {
    assert.equal(pkt[0], 0x55);
    assert.equal(pkt[1], 0x55);
    assert.equal(pkt[pkt.length - 2], 0xaa);
    assert.equal(pkt[pkt.length - 1], 0xaa);
  }
  const raster = packets.filter((p) => p[2] === 0x85);
  assert.equal(raster.length, h);
});

test("countPixelsForLine encodes black pixel counts in header", () => {
  const line = Buffer.alloc(40, 0xff);
  const counts = countPixelsForLine(line, 384);
  assert.ok(counts[1] > 0 || counts[2] > 0 || counts[0] > 0);
});

test("port extractors recognize COM and USB spooler ports", () => {
  assert.equal(extractComPort("Niimbot K3 (COM7)"), "COM7");
  assert.equal(extractWindowsUsbPort("USB005"), "USB005");
  assert.equal(extractWindowsUsbPort("NIIMBOT K3 on USB005"), "USB005");
});

test("USB005 K3 is not hijacked by a discovered COM port (CH340 scale)", () => {
  const t = chooseNiimbotTransport({
    printerName: "NIIMBOT K3",
    portName: "USB005",
    resolvedCom: "COM3",
    resolvedUsb: "USB005",
  });
  assert.equal(t.mode, "windows");
  assert.equal(t.comPort, null);
  assert.equal(t.usbPort, "USB005");
});

test("explicit COM in printer name still uses serial", () => {
  const t = chooseNiimbotTransport({
    printerName: "NIIMBOT K3 (COM7)",
    portName: "",
    resolvedCom: "COM3",
    resolvedUsb: "",
  });
  assert.equal(t.mode, "com");
  assert.equal(t.comPort, "COM7");
});

test("COM-only B21 without USB port uses serial", () => {
  const t = chooseNiimbotTransport({
    printerName: "Niimbot B21",
    portName: "COM4",
    resolvedCom: "COM4",
    resolvedUsb: "",
  });
  assert.equal(t.mode, "com");
  assert.equal(t.comPort, "COM4");
});

test("describeSerialFailure maps access denied", () => {
  const msg = describeSerialFailure("COM3", {
    message: "UnauthorizedAccessException: Access to the port 'COM3' is denied.",
  });
  assert.match(msg, /COM3 is in use or access denied/i);
});

test("COM discovery does not match CH340 VID 1a86", () => {
  const server = read("../server.js");
  assert.equal(server.includes("3513|0483|1a86"), false);
  assert.match(server, /Name tokens only/);
});

test("printNiimbotLabel uses Windows when printer is USB005 even if COM is discovered", async () => {
  const bitmap = buildTestPatternBitmap(32, 16);
  let usedWindows = false;
  const result = await printNiimbotLabel({
    printerName: "NIIMBOT K3",
    portName: "USB005",
    bitmapBase64: bitmap.toString("base64"),
    widthPx: 32,
    heightPx: 16,
    resolveComPortFn: async () => "COM3",
    resolveWindowsUsbPortFn: async () => "USB005",
    printWindowsPacketsFn: async () => {
      usedWindows = true;
    },
  });
  assert.equal(usedWindows, true);
  assert.equal(result.path, "usb:USB005");
});

test("printNiimbotLabel falls back to Windows when COM serial fails", async () => {
  const bitmap = buildTestPatternBitmap(32, 16);
  let usedWindows = false;
  const result = await printNiimbotLabel({
    printerName: "NIIMBOT K3",
    portName: "COM7",
    bitmapBase64: bitmap.toString("base64"),
    widthPx: 32,
    heightPx: 16,
    printWindowsPacketsFn: async () => {
      usedWindows = true;
    },
  });
  assert.equal(usedWindows, true);
  assert.equal(result.printer, "NIIMBOT K3");
});

test("server wires Niimbot diagnostics and packet print path", () => {
  const server = read("../server.js");
  assert.match(server, /printNiimbotWindows/);
  assert.match(server, /win-niimbot-print\.ps1/);
  assert.match(server, /discoverNiimbotComPorts/);
  assert.match(server, /niimbot-label\/diagnostics/);
  assert.match(server, /testPattern/);
});
