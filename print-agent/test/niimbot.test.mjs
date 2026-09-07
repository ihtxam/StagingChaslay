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
  isNiimbotPrinterName,
  detectNiimbotProfile,
  detectNiimbotProfileCandidates,
  chooseNiimbotTransport,
  describeSerialFailure,
  printNiimbotLabel,
  CONNECT_BYTES,
  WAKE_BYTES,
  alignBitmapCols,
  padBitmapToPrinthead,
  invertBitmap,
  estimateJobDelayMs,
  packetDelayMs,
  lineBlackCounts,
  summarizePacketTypes,
} = require("../niimbot-client.js");

const here = path.dirname(fileURLToPath(import.meta.url));
const VERSION = "1.10.11";

function read(rel) {
  return fs.readFileSync(path.join(here, rel), "utf8");
}

test("print-agent version is 1.10.11 in package.json, server.js, and download manifest", () => {
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

test("niimbotPacket XOR checksum is type ^ len ^ data", () => {
  const row = Buffer.concat([Buffer.alloc(6), Buffer.alloc(40, 0xff)]);
  const pkt = niimbotPacket(0x85, row);
  const type = pkt[2];
  const len = pkt[3];
  let cs = type ^ len;
  for (let i = 0; i < len; i++) cs ^= pkt[4 + i];
  assert.equal(pkt[4 + len], cs);
  assert.equal(pkt[pkt.length - 2], 0xaa);
  assert.equal(pkt.length, 4 + 6 + 40 + 3);
});

test("USB K3 defaults to b21 2-byte start, 6-byte dim, no 384 pad", () => {
  assert.equal(detectNiimbotProfile("NIIMBOT K3", "USB005"), "b21");
  const w = 320;
  const h = 160;
  const rowBytes = Math.ceil(w / 8);
  const bitmap = Buffer.alloc(rowBytes * h, 0xff);
  const { packets, profile, widthPx, rasterRowBytes, setDimensionBytes, setDimensionHex, startPrintBytes } =
    buildNiimbotJobPackets(bitmap, w, h, 3, {
      printerName: "NIIMBOT K3",
      portName: "USB005",
      transport: "windows",
    });
  assert.equal(profile, "b21");
  assert.equal(widthPx, 320);
  assert.equal(rasterRowBytes, 40);
  assert.equal(setDimensionBytes, 6);
  assert.equal(setDimensionHex, "00a001400001");
  assert.equal(startPrintBytes, 2);
  const dim = packets.find((p) => p[2] === 0x13);
  assert.ok(dim);
  assert.equal(dim[3], 6);
  const dimData = dim.subarray(4, 4 + dim[3]);
  assert.equal(dimData.readUInt16BE(0), h);
  assert.equal(dimData.readUInt16BE(2), 320);
  assert.equal(dimData.readUInt16BE(4), 1);
  const start = packets.find((p) => p[2] === 0x01);
  assert.equal(start[3], 2);
  assert.deepEqual([...start.subarray(4, 6)], [0, 1]);
  const raster = packets.find((p) => p[2] === 0x85);
  assert.equal(raster.length, 4 + 6 + 40 + 3);
});

test("explicit k3 profile still pads 320x160 to 48-byte rows and SET_DIMENSION width 384", () => {
  const w = 320;
  const h = 160;
  const rowBytes = Math.ceil(w / 8);
  const bitmap = Buffer.alloc(rowBytes * h, 0xff);
  const { packets, profile, widthPx, rasterRowBytes, setDimensionBytes, setDimensionHex } =
    buildNiimbotJobPackets(bitmap, w, h, 3, {
      printerName: "NIIMBOT K3",
      profile: "k3",
      transport: "windows",
    });
  assert.equal(profile, "k3");
  assert.equal(widthPx, 384);
  assert.equal(rasterRowBytes, 48);
  assert.equal(setDimensionBytes, 4);
  assert.equal(setDimensionHex, "00a00180");
  const start = packets.find((p) => p[2] === 0x01);
  assert.equal(start[3], 1);
});

test("Niimbus auto-detects b1 profile (2024 B21S print task)", () => {
  assert.equal(detectNiimbotProfile("Niimbus Label", "USB005"), "b1");
  const candidates = detectNiimbotProfileCandidates("Niimbus Label", "USB005");
  assert.deepEqual(candidates, ["b1", "b21", "k3"]);
});

test("B21 profile uses 2-byte PrintStart [0,1] and 6-byte SetPageSize like official B21", () => {
  const w = 64;
  const h = 32;
  const rowBytes = Math.ceil(w / 8);
  const bitmap = Buffer.alloc(rowBytes * h, 0xff);
  const { packets, profile, setDimensionBytes, setDimensionHex } = buildNiimbotJobPackets(bitmap, w, h, 3, {
    printerName: "Niimbot B21",
    profile: "b21",
  });
  assert.equal(profile, "b21");
  const start = packets.find((p) => p[2] === 0x01);
  assert.equal(start[3], 2);
  assert.deepEqual([...start.subarray(4, 6)], [0, 1]);
  assert.equal(setDimensionBytes, 6);
  assert.equal(setDimensionHex, "002000400001");
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

test("raster packet is 40-byte row for USB K3 320px labels (B21 logical width)", () => {
  const w = 320;
  const h = 8;
  const bitmap = buildTestPatternBitmap(w, h);
  const { rasterRowBytes, packets } = buildNiimbotJobPackets(bitmap, w, h, 3, {
    printerName: "NIIMBOT K3",
    portName: "USB005",
  });
  assert.equal(rasterRowBytes, 40);
  const raster = packets.find((p) => p[2] === 0x85);
  assert.equal(raster.length, 4 + 6 + 40 + 3);
});

test("win-niimbot-print.ps1 defaults to one RAW concat document (no ESC/POS cut)", () => {
  const src = read("../win-niimbot-print.ps1");
  assert.match(src, /0x03,\s*0x55,\s*0x55,\s*0xc1/);
  assert.match(src, /0x54,\s*0x01/);
  assert.match(src, /WriteMode/);
  assert.match(src, /\[string\]\$WriteMode = "concat"/);
  assert.match(src, /concatBytes=/);
  assert.match(src, /\[System\.Buffer\]::BlockCopy/);
  assert.match(src, /Write-OnePacket -Handle \$handle -Data \$blob/);
  assert.equal(src.includes("Get-BtCutTrailer"), false);
  assert.equal(/0x1D,\s*0x56/.test(src), false);
  assert.equal(/0x1B,\s*0x69/.test(src), false);
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

test("invertBitmap flips raster bits in the job", () => {
  const w = 32;
  const h = 8;
  const src = buildTestPatternBitmap(w, h);
  const plain = buildNiimbotJobPackets(src, w, h, 3, { profile: "b21" });
  const inverted = buildNiimbotJobPackets(src, w, h, 3, { profile: "b21", invertBitmap: true });
  assert.equal(inverted.invertBitmap, true);
  const a = plain.packets.find((p) => p[2] === 0x85);
  const b = inverted.packets.find((p) => p[2] === 0x85);
  assert.equal(a.length, b.length);
  assert.notEqual(a.subarray(10, 14).equals(b.subarray(10, 14)), true);
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

test("padBitmapToPrinthead left-aligns 320px into 384-dot rows", () => {
  const w = 320;
  const h = 10;
  const rowBytes = Math.ceil(w / 8);
  const bitmap = Buffer.alloc(rowBytes * h, 0xff);
  const padded = padBitmapToPrinthead(bitmap, w, h, 384);
  assert.equal(padded.widthPx, 384);
  assert.equal(padded.bitmap.length, 48 * h);
  for (let y = 0; y < h; y++) {
    assert.equal(padded.bitmap.subarray(y * 48, y * 48 + 40).every((b) => b === 0xff), true);
    assert.equal(padded.bitmap.subarray(y * 48 + 40, y * 48 + 48).every((b) => b === 0), true);
  }
});

test("buildOfficialPacketExpectations documents b21 6-byte dim vs k3 4-byte pad", () => {
  const official = buildOfficialPacketExpectations(320, 160);
  assert.equal(official.k3.setDimensionBytes, 4);
  assert.equal(official.b21.setDimensionBytes, 6);
  assert.equal(official.b1.setDimensionBytes, 6);
  assert.equal(official.k3.rasterRowBytes, 48);
  assert.equal(official.b21.rasterRowBytes, 40);
  assert.equal(official.k3.setDimensionHex, "00a00180");
  assert.equal(official.b21.setDimensionHex, "00a001400001");
  assert.equal(official.k3.colsPx, 384);
  assert.equal(official.b21.colsPx, 320);
  assert.equal(official.b21.startPrintBytes, 2);
});

test("Niimbus and NIIMBOT names route as Niimbot printers", () => {
  assert.equal(isNiimbotPrinterName("Niimbus"), true);
  assert.equal(isNiimbotPrinterName("Niimbus Label"), true);
  assert.equal(isNiimbotPrinterName("NIIMBOT K3"), true);
  assert.equal(isNiimbotPrinterName("XP-80"), false);
  const dash = fs.readFileSync(
    path.join(here, "..", "..", "dashboard", "src", "lib", "niimbot-label.ts"),
    "utf8"
  );
  assert.match(dash, /niimbot\|niimbus/);
});

test("port extractors recognize COM and USB spooler ports", () => {
  assert.equal(extractComPort("Niimbot K3 (COM7)"), "COM7");
  assert.equal(extractComPort("COM6"), "COM6");
  assert.equal(extractComPort("\\\\.\\COM6"), "COM6");
  assert.equal(extractComPort("Bluetooth (COM6)"), "COM6");
  assert.equal(extractWindowsUsbPort("USB005"), "USB005");
  assert.equal(extractWindowsUsbPort("NIIMBOT K3 on USB005"), "USB005");
});

test("named Niimbot prefers discovered COM over USB005 (USBPRINT blank-feed)", () => {
  const t = chooseNiimbotTransport({
    printerName: "NIIMBOT K3",
    portName: "USB005",
    resolvedCom: "COM7",
    resolvedUsb: "USB005",
  });
  assert.equal(t.mode, "com");
  assert.equal(t.comPort, "COM7");
  assert.equal(t.usbPort, "USB005");
  assert.equal(t.requireCom, true);
});

test("explicit COM6 in port or name requires serial and does not USB-fallback", () => {
  const byPort = chooseNiimbotTransport({
    printerName: "NIIMBOT K3",
    portName: "COM6",
    resolvedCom: "COM6",
    resolvedUsb: "USB005",
  });
  assert.equal(byPort.mode, "com");
  assert.equal(byPort.comPort, "COM6");
  assert.equal(byPort.requireCom, true);

  const byName = chooseNiimbotTransport({
    printerName: "NIIMBOT K3 (COM6)",
    portName: "USB005",
    resolvedCom: null,
    resolvedUsb: "USB005",
  });
  assert.equal(byName.mode, "com");
  assert.equal(byName.comPort, "COM6");
  assert.equal(byName.requireCom, true);
});

test("receipt/scale USB queue is not hijacked by a guessed COM port", () => {
  const t = chooseNiimbotTransport({
    printerName: "XP-80",
    portName: "USB001",
    resolvedCom: "COM3",
    resolvedUsb: "USB001",
  });
  assert.equal(t.mode, "windows");
  assert.equal(t.comPort, null);
  assert.equal(t.usbPort, "USB001");
});

test("printNiimbotLabel uses COM first for NIIMBOT K3 even when USB005 is listed", async () => {
  const bitmap = buildTestPatternBitmap(32, 16);
  let usedCom = "";
  let usedWindows = false;
  const result = await printNiimbotLabel({
    printerName: "NIIMBOT K3",
    portName: "USB005",
    bitmapBase64: bitmap.toString("base64"),
    widthPx: 32,
    heightPx: 16,
    resolveComPortFn: async () => "COM7",
    resolveWindowsUsbPortFn: async () => "USB005",
    printSerialFn: async (port) => {
      usedCom = port;
    },
    printWindowsPacketsFn: async () => {
      usedWindows = true;
    },
  });
  assert.equal(usedCom, "COM7");
  assert.equal(usedWindows, false);
  assert.equal(result.path, "com");
  assert.ok(result.bitmapNonZeroBytes > 0);
  assert.ok(result.packetTypeSequence.includes("PrintBitmapRow"));
});

test("printNiimbotLabel uses COM when portName is COM6 and does not USB-fallback", async () => {
  const bitmap = buildTestPatternBitmap(32, 16);
  let usedCom = "";
  let usedWindows = false;
  const result = await printNiimbotLabel({
    printerName: "NIIMBOT K3",
    portName: "COM6",
    bitmapBase64: bitmap.toString("base64"),
    widthPx: 32,
    heightPx: 16,
    resolveComPortFn: async () => "COM6",
    resolveWindowsUsbPortFn: async () => "USB005",
    printSerialFn: async (port) => {
      usedCom = port;
    },
    printWindowsPacketsFn: async () => {
      usedWindows = true;
    },
  });
  assert.equal(usedCom, "COM6");
  assert.equal(usedWindows, false);
  assert.equal(result.path, "com");
  assert.ok(result.bitmapNonZeroBytes > 0);
});

test("printNiimbotLabel COM6 serial failure does not USB-fallback", async () => {
  const bitmap = buildTestPatternBitmap(32, 16);
  let usedWindows = false;
  await assert.rejects(
    () =>
      printNiimbotLabel({
        printerName: "NIIMBOT K3",
        portName: "COM6",
        bitmapBase64: bitmap.toString("base64"),
        widthPx: 32,
        heightPx: 16,
        printSerialFn: async () => {
          throw new Error("Niimbot COM6 is in use or access denied (close NIIMBOT.exe)");
        },
        printWindowsPacketsFn: async () => {
          usedWindows = true;
        },
      }),
    /COM6 is in use or access denied/
  );
  assert.equal(usedWindows, false);
});

test("printNiimbotLabel USB005 defaults to one RAW concat document", async () => {
  const bitmap = buildTestPatternBitmap(32, 16);
  let writeMode = "";
  const result = await printNiimbotLabel({
    printerName: "Niimbus",
    portName: "USB005",
    bitmapBase64: bitmap.toString("base64"),
    widthPx: 32,
    heightPx: 16,
    resolveComPortFn: async () => null,
    resolveWindowsUsbPortFn: async () => "USB005",
    printWindowsPacketsFn: async (opts) => {
      writeMode = opts.writeMode;
    },
  });
  assert.equal(writeMode, "concat");
  assert.equal(result.path, "usb:USB005");
  assert.equal(result.usbWriteMode, "concat");
  assert.equal(result.rasterRowBytes, 4);
  assert.ok(result.bitmapNonZeroBytes > 0);
});

test("discovered COM for named K3 does not USB-fallback on Open failure", async () => {
  const bitmap = buildTestPatternBitmap(32, 16);
  let usedWindows = false;
  await assert.rejects(
    () =>
      printNiimbotLabel({
        printerName: "NIIMBOT K3",
        portName: "USB005",
        bitmapBase64: bitmap.toString("base64"),
        widthPx: 32,
        heightPx: 16,
        resolveComPortFn: async () => "COM6",
        resolveWindowsUsbPortFn: async () => "USB005",
        printSerialFn: async () => {
          throw new Error("Niimbot COM6 Open() failed @ 115200 baud: Access to the port 'COM6' is denied.");
        },
        printWindowsPacketsFn: async () => {
          usedWindows = true;
        },
      }),
    /Open\(\) failed/
  );
  assert.equal(usedWindows, false);
});

test("server wires Niimbot diagnostics compare=official and invertBitmap", () => {
  const server = read("../server.js");
  assert.match(server, /compare=official|compareOfficial/);
  assert.match(server, /buildOfficialPacketExpectations/);
  assert.match(server, /invertBitmap/);
  assert.match(server, /niimbot-label\/diagnostics/);
  assert.match(server, /niimbot-com-prefer/);
  assert.match(server, /niimbot-usb-packets/);
  assert.match(server, /niimbot-usb-b21-default/);
  assert.match(server, /usbWriteMode/);
  assert.match(server, /bitmapNonZeroBytes/);
});

test("COM serial enables DTR/RTS and retries 9600 after 115200", () => {
  const src = read("../niimbot-client.js");
  assert.match(src, /DtrEnable/);
  assert.match(src, /RtsEnable/);
  assert.match(src, /\[115200,\s*9600\]/);
  assert.match(src, /requireCom/);
  assert.match(src, /Open\(\) failed/);
});

test("Settings Test Niimbot bars sends selected printer name and portName", () => {
  const settings = fs.readFileSync(
    path.join(here, "..", "..", "dashboard", "src", "pages", "merchant", "Settings.tsx"),
    "utf8"
  );
  assert.match(settings, /printNiimbotLabelViaAgent/);
  assert.match(settings, /resolveNiimbotTestPortName/);
  assert.match(settings, /shouldTestNiimbotBars/);
  assert.match(settings, /protocol: 'b21'/);
  assert.match(settings, /testNiimbotBarsInvert/);
  assert.match(settings, /invertBitmap: invert/);
  assert.match(settings, /findPrinterBySelectValue/);
  assert.match(settings, /toast\.error\(msg \|\| t\('testNiimbotBarsFailed'\)\)/);
  const dash = fs.readFileSync(
    path.join(here, "..", "..", "dashboard", "src", "lib", "niimbot-label.ts"),
    "utf8"
  );
  assert.match(dash, /resolveNiimbotTestPortName/);
  assert.match(dash, /COM6/);
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
