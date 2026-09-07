import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildNiimbotJobPackets,
  buildOfficialPacketExpectations,
  buildTestPatternBitmap,
  niimbotPacket,
  extractComPort,
  extractWindowsUsbPort,
  detectNiimbotProfile,
  detectNiimbotProfileCandidates,
  chooseNiimbotTransport,
  describeSerialFailure,
  printNiimbotLabel,
  CONNECT_BYTES,
  WAKE_BYTES,
  alignBitmapCols,
  invertBitmap,
  estimateJobDelayMs,
  packetDelayMs,
  lineBlackCounts,
  summarizePacketTypes,
} = require("../niimbot-client.js");

const here = path.dirname(fileURLToPath(import.meta.url));
const VERSION = "1.10.8";

function read(rel) {
  return fs.readFileSync(path.join(here, rel), "utf8");
}

test("print-agent version is 1.10.8 in package.json, server.js, and download manifest", () => {
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

test("CONNECT packet uses 0x03 prefix per official NIIMBOT app captures", () => {
  assert.deepEqual([...CONNECT_BYTES], [0x03, 0x55, 0x55, 0xc1, 0x01, 0x01, 0xc1, 0xaa, 0xaa]);
  assert.deepEqual([...WAKE_BYTES], [0x54, 0x01]);
});

test("K3 profile uses 4-byte SET_DIMENSION (rows, cols) per niimprint set_dimension", () => {
  assert.equal(detectNiimbotProfile("NIIMBOT K3", "USB005"), "k3");
  const w = 320;
  const h = 160;
  const rowBytes = Math.ceil(w / 8);
  const bitmap = Buffer.alloc(rowBytes * h, 0xff);
  const { packets, profile, widthPx, rasterRowBytes, setDimensionBytes } = buildNiimbotJobPackets(
    bitmap,
    w,
    h,
    3,
    { printerName: "NIIMBOT K3", transport: "windows" }
  );
  assert.equal(profile, "k3");
  assert.equal(widthPx, 320);
  assert.equal(rasterRowBytes, 40);
  assert.equal(setDimensionBytes, 4);
  const dim = packets.find((p) => p[2] === 0x13);
  assert.ok(dim);
  assert.equal(dim[3], 4);
  const dimData = dim.subarray(4, 4 + dim[3]);
  assert.equal(dimData.readUInt16BE(0), h);
  assert.equal(dimData.readUInt16BE(2), w);
});

test("Niimbus auto-detects b1 profile (2024 B21S print task)", () => {
  assert.equal(detectNiimbotProfile("Niimbus Label", "USB005"), "b1");
  const candidates = detectNiimbotProfileCandidates("Niimbus Label", "USB005");
  assert.deepEqual(candidates, ["b1", "b21", "k3"]);
});

test("B21 profile uses 1-byte PrintStart and 4-byte SetPageSize like B21_V1", () => {
  const w = 64;
  const h = 32;
  const rowBytes = Math.ceil(w / 8);
  const bitmap = Buffer.alloc(rowBytes * h, 0xff);
  const { packets, profile, setDimensionBytes } = buildNiimbotJobPackets(bitmap, w, h, 3, {
    printerName: "Niimbot B21",
    profile: "b21",
  });
  assert.equal(profile, "b21");
  const start = packets.find((p) => p[2] === 0x01);
  assert.equal(start[3], 1);
  assert.equal(start[4], 1);
  assert.equal(setDimensionBytes, 4);
});

test("B1 profile uses 7-byte PrintStart and 6-byte SetPageSize", () => {
  const w = 64;
  const h = 32;
  const rowBytes = Math.ceil(w / 8);
  const bitmap = Buffer.alloc(rowBytes * h, 0xff);
  const { packets, setDimensionBytes } = buildNiimbotJobPackets(bitmap, w, h, 3, { profile: "b1" });
  const start = packets.find((p) => p[2] === 0x01);
  assert.equal(start[3], 7);
  assert.equal(setDimensionBytes, 6);
});

test("job includes Connect preamble types, status poll after START_PRINT, and C1 in transport", () => {
  const w = 32;
  const h = 16;
  const bitmap = buildTestPatternBitmap(w, h);
  const { packets, packetTypeSequence } = buildNiimbotJobPackets(bitmap, w, h, 3, {
    printerName: "K3",
  });
  const seq = summarizePacketTypes(packets, { includePreamble: true });
  assert.equal(seq[0], "Connect(0x03+C1)");
  assert.equal(seq[1], "Wake(0x54 0x01)");
  assert.ok(packetTypeSequence.includes("PrintStatus"));
  const startIdx = packets.findIndex((p) => p[2] === 0x01);
  const pageIdx = packets.findIndex((p) => p[2] === 0x03);
  assert.ok(startIdx >= 0);
  assert.ok(pageIdx > startIdx);
  assert.equal(packets[startIdx + 1][2], 0xa3);
});

test("raster lines use total-mode black counts for K3 (B21L2BPrintTask)", () => {
  const line = Buffer.from([0xff, 0x00, 0xdf, 0x0f]);
  const counts = lineBlackCounts(line, 384, "total");
  assert.deepEqual(counts, [0, 19, 0]);
  const w = 64;
  const h = 4;
  const bitmap = buildTestPatternBitmap(w, h);
  const { packets } = buildNiimbotJobPackets(bitmap, w, h, 3, { profile: "k3" });
  const raster = packets.find((p) => p[2] === 0x85);
  assert.equal(raster[6], 0);
  assert.ok(raster[7] > 0 || raster[8] > 0);
});

test("raster packet is 48-byte row only when label width is 384px", () => {
  const w = 384;
  const h = 8;
  const bitmap = buildTestPatternBitmap(w, h);
  const { rasterRowBytes, packets } = buildNiimbotJobPackets(bitmap, w, h, 3, { profile: "k3" });
  assert.equal(rasterRowBytes, 48);
  const raster = packets.find((p) => p[2] === 0x85);
  assert.equal(raster.length, 4 + 6 + 48 + 3);
});

test("win-niimbot-print.ps1 sends CONNECT then wake before packets", () => {
  const src = read("../win-niimbot-print.ps1");
  assert.match(src, /0x03,\s*0x55,\s*0x55,\s*0xc1/);
  assert.match(src, /0x54,\s*0x01/);
  assert.match(src, /Write-OnePacket/);
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

test("invertBitmap flips all row bytes", () => {
  const w = 32;
  const h = 4;
  const src = buildTestPatternBitmap(w, h);
  const inv = invertBitmap(src, w, h);
  for (let i = 0; i < inv.length; i++) {
    assert.equal(inv[i], src[i] ^ 0xff);
  }
});

test("alignBitmapCols pads to byte boundary not printhead width", () => {
  const w = 50;
  const h = 10;
  const rowBytes = Math.ceil(w / 8);
  const bitmap = Buffer.alloc(rowBytes * h, 0xff);
  const aligned = alignBitmapCols(bitmap, w, h);
  assert.equal(aligned.widthPx, 56);
  assert.equal(Math.ceil(aligned.widthPx / 8), Math.ceil(aligned.bitmap.length / h));
});

test("buildOfficialPacketExpectations documents k3 vs b1 dimension sizes", () => {
  const official = buildOfficialPacketExpectations(320, 160);
  assert.equal(official.k3.setDimensionBytes, 4);
  assert.equal(official.b1.setDimensionBytes, 6);
  assert.equal(official.k3.rasterRowBytes, 40);
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

test("server wires Niimbot diagnostics compare=official and invertBitmap", () => {
  const server = read("../server.js");
  assert.match(server, /compare=official|compareOfficial/);
  assert.match(server, /buildOfficialPacketExpectations/);
  assert.match(server, /invertBitmap/);
  assert.match(server, /niimbot-label\/diagnostics/);
});

test("packetDelayMs and estimateJobDelayMs stay bounded for USB jobs", () => {
  const w = 320;
  const h = 160;
  const { packets } = buildNiimbotJobPackets(buildTestPatternBitmap(w, h), w, h, 3, {
    transport: "windows",
  });
  const ms = estimateJobDelayMs(packets, "windows");
  assert.ok(ms > 500);
  assert.ok(ms < 120000);
  assert.equal(packetDelayMs(packets.find((p) => p[2] === 0x85), "windows"), 12);
});
