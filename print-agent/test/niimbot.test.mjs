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
  describeSpoolerUncertainty,
  rawSerialError,
  printNiimbotLabel,
  countPixelsForLine,
  buildSerialJobScript,
  buildComProbeScript,
  buildUsbDeviceScript,
  USBPRINT_INTERFACE_GUID,
  classifyProbedPort,
  formatComProbeReport,
  summarizeComProbe,
  probeNiimbotComPorts,
  PROTOCOL_PROFILES,
  SERIAL_BAUDS,
  buildNiimbotJobSteps,
  describeHandshake,
  describeForeignComPort,
  recommendNiimbotPort,
  parseHandshakeOutput,
  serialPayloadLines,
} = require("../niimbot-client.js");

const here = path.dirname(fileURLToPath(import.meta.url));
const VERSION = "1.10.14";

function read(rel) {
  return fs.readFileSync(path.join(here, rel), "utf8");
}

test("print-agent version is 1.10.14 in package.json, server.js, and download manifest", () => {
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

test("no 0x54 prologue bytes are sent before the first 55 55 frame", () => {
  // 0x54 is RfidSuccessTimes in https://printers.niim.blue/interfacing/proto/,
  // not a wake command. niimgo (K3) and our Android SPP client send nothing first.
  const client = read("../niimbot-client.js");
  assert.equal(/0x54,\s*0x01/.test(client), false);
  assert.equal(client.includes("WAKE_BYTES"), false);
  const ps1 = read("../win-niimbot-print.ps1");
  assert.equal(/0x54,\s*0x01/.test(ps1), false);
  const bitmap = buildTestPatternBitmap(32, 16);
  const { packets } = buildNiimbotJobPackets(bitmap, 32, 16, 3, { printerName: "NIIMBOT K3" });
  assert.equal(packets[0][2], 0x21);
});

test("win-niimbot-print.ps1 writes one packet per WritePrinter", () => {
  const src = read("../win-niimbot-print.ps1");
  assert.match(src, /Write-OnePacket/);
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

test("raster rows leave the black-pixel-count bytes at zero", () => {
  // "Usually the printer works correctly when all three bytes are 0x00" —
  // printers.niim.blue/interfacing/proto. Chunked counts depend on the exact
  // printhead width, which is one more way to get a row rejected.
  const w = 320;
  const h = 8;
  const bitmap = Buffer.alloc(Math.ceil(w / 8) * h, 0xff);
  const { packets } = buildNiimbotJobPackets(bitmap, w, h, 3, { printerName: "NIIMBOT K3" });
  const raster = packets.filter((p) => p[2] === 0x85);
  assert.equal(raster.length, h);
  for (const row of raster) {
    assert.deepEqual([row[6], row[7], row[8]], [0, 0, 0]);
    assert.equal(row[9], 1);
  }
});

test("countPixelsForLine is still available for the documented split mode", () => {
  const counts = countPixelsForLine(Buffer.alloc(40, 0xff), 384);
  assert.ok(counts[0] > 0 || counts[1] > 0 || counts[2] > 0);
});

test("K3 printhead is 640 dots (80 mm at 203 dpi), not the B21 384", () => {
  assert.equal(PROTOCOL_PROFILES.k3.printheadPixels, 640);
  assert.equal(PROTOCOL_PROFILES.b21.printheadPixels, 384);
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

test("describeSerialFailure maps access denied and keeps the raw reason", () => {
  const msg = describeSerialFailure("COM3", {
    stderr: "Access to the port 'COM3' is denied.",
  });
  assert.match(msg, /already open/i);
  assert.match(msg, /close NIIMBOT\.exe/i);
  assert.match(msg, /Access to the port 'COM3' is denied\./);
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
  assert.match(server, /niimbot-label\/com-probe/);
  assert.match(server, /probeNiimbotComPorts/);
  assert.match(server, /testPattern/);
});

/*
 * P0 gate — PowerShell error-string safety.
 *
 * This bug shipped twice and cost a week of blank labels, because the user-facing
 * text was assembled inside PowerShell from a JS template literal:
 *   1.10.x  ->  "... failed: ${$_.Exception.Message}"
 *   1.10.12 ->  throw ("... Open() failed @ 19200 baud: " + $_.Exception.Message)
 * Both leaked literal script source into the UI instead of the exception, so the
 * real reason COM6 would not open was never seen. Messages are now built in Node
 * from the script's stderr, and these tests fail if that regresses.
 */

/** The two exact forms that shipped broken, plus the unterminated-interpolation form. */
const FORBIDDEN_PS_PATTERNS = [
  { label: 'JS-interpolated automatic variable "${$_"', re: /\$\{\$_/ },
  { label: 'string concatenation \'" + $_\'', re: /"\s*\+\s*\$_/ },
  { label: '"$_.Exception.Message}" with a stray closing brace', re: /\$_\.Exception\.Message\}/ },
];

function doubleQuotedStrings(source) {
  return source.match(/"[^"\n]*"/g) || [];
}

/** Strips `$(...)` subexpressions, the only place a string may reference $_. */
function withoutSubexpressions(literal) {
  return literal.replace(/\$\([^)]*\)/g, "");
}

function assertSafePowerShellSource(label, source) {
  for (const { label: name, re } of FORBIDDEN_PS_PATTERNS) {
    assert.equal(re.test(source), false, `${label} must not contain ${name}`);
  }
  for (const literal of doubleQuotedStrings(source)) {
    assert.equal(
      /\$_\./.test(withoutSubexpressions(literal)),
      false,
      `${label} references $_ inside a double-quoted string outside a $(...) subexpression: ${literal}`
    );
  }
}

test("P0: generated PowerShell never formats an exception inside a string", () => {
  assertSafePowerShellSource("serial job script", buildSerialJobScript());
  assertSafePowerShellSource("com probe script", buildComProbeScript());
});

test("P0: every bundled .ps1 is free of the broken error patterns", () => {
  const dir = path.join(here, "..");
  const scripts = fs.readdirSync(dir).filter((f) => f.endsWith(".ps1"));
  assert.ok(scripts.length >= 4, "expected the bundled PowerShell scripts to be present");
  for (const name of scripts) {
    assertSafePowerShellSource(name, fs.readFileSync(path.join(dir, name), "utf8"));
  }
});

test("P0: the JS sources cannot re-introduce either shipped bug", () => {
  for (const file of ["../niimbot-client.js", "../server.js"]) {
    const source = read(file);
    for (const { label, re } of FORBIDDEN_PS_PATTERNS) {
      assert.equal(re.test(source), false, `${file} must not contain ${label}`);
    }
  }
});

test("P0: the serial script reports failures on stderr with distinct exit codes", () => {
  const ps = buildSerialJobScript();
  assert.match(ps, /\[Console\]::Error\.WriteLine\(\$Record\.Exception\.Message\)/);
  assert.match(ps, /exit 20/);
  assert.match(ps, /exit 21/);
  // Values arrive as parameters, never interpolated into the script body.
  assert.match(ps, /\[Parameter\(Mandatory = \$true\)\]\[string\]\$PortPath/);
  assert.match(ps, /\[Parameter\(Mandatory = \$true\)\]\[int\]\$Baud/);
  assert.equal(ps.includes("throw ("), false);
});

test("P0: PowerShell runs from a file, not -Command (the source of the mangling)", () => {
  const client = read("../niimbot-client.js");
  assert.match(client, /"-File",\s*\n?\s*scriptPath/);
  assert.equal(/"-Command",\s*ps\b/.test(client), false);
});

test("P0: describeSerialFailure builds the message in Node from stderr", () => {
  const missing = describeSerialFailure("COM6", {
    stderr: "The port 'COM6' does not exist.",
  });
  assert.match(missing, /does not exist on this PC/i);
  assert.match(missing, /The port 'COM6' does not exist\./);

  const dead = describeSerialFailure("COM6", {
    stderr: "The semaphore timeout period has expired.",
  });
  assert.match(dead, /outgoing port/i);
  assert.match(dead, /The semaphore timeout period has expired\./);

  // Anything we have no rule for still shows the raw exception verbatim.
  const odd = describeSerialFailure("COM6", { stderr: "Some brand new .NET error" }, 19200);
  assert.match(odd, /Some brand new \.NET error/);
  assert.match(odd, /19200 baud/);

  // And no message ever contains PowerShell source.
  for (const msg of [missing, dead, odd]) {
    assert.equal(msg.includes("$_"), false);
    assert.equal(msg.includes("Exception.Message"), false);
  }
});

test("P0: the PowerShell method-invocation wrapper is stripped from the reason", () => {
  // Real stderr captured from `$port.Open()` on a port that cannot be opened.
  const stderr =
    'Exception calling "Open" with "0" argument(s): "Access to the port \'COM6\' is denied."';
  assert.equal(rawSerialError({ stderr }), "Access to the port 'COM6' is denied.");
  const msg = describeSerialFailure("COM6", { stderr }, 19200);
  assert.match(msg, /Access to the port 'COM6' is denied\./);
  assert.equal(msg.includes("Exception calling"), false);
});

test("P1: com probe enumerates ports, queues and per-baud open attempts", () => {
  const ps = buildComProbeScript();
  assert.match(ps, /Win32_SerialPort/);
  assert.match(ps, /Get-PnpDevice -Class Ports/);
  assert.match(ps, /Win32_Printer/);
  assert.match(ps, /GetPortNames/);
  assert.match(ps, /ConvertTo-Json/);
  assert.match(ps, /\$sp\.Open\(\)/);
  // Must not stop at the first failure: the point is a full report.
  assert.match(ps, /\$ErrorActionPreference = 'Continue'/);
  assert.deepEqual(SERIAL_BAUDS, [115200, 9600, 19200]);
});

test("P1: probe classifies a Bluetooth incoming port and says to use the outgoing one", () => {
  const row = classifyProbedPort({
    port: "COM6",
    caption: "Standard Serial over Bluetooth link (COM6)",
    pnpDeviceId: "BTHENUM\\{00001101-0000-1000-8000-00805F9B34FB}_LOCALMFG&0000",
    sources: ["Win32_SerialPort"],
    opens: [
      { baud: 115200, opened: false, error: "The semaphore timeout period has expired." },
      { baud: 9600, opened: false, error: "The semaphore timeout period has expired." },
    ],
  });
  assert.equal(row.verdict, "not-connected");
  assert.equal(row.bluetoothIncoming, true);
  assert.match(row.advice.join(" "), /outgoing port/i);
});

test("P1: probe tells a busy port from a missing one, and a scale from a printer", () => {
  const busy = classifyProbedPort({
    port: "COM7",
    caption: "NIIMBOT K3 (COM7)",
    opens: [{ baud: 115200, opened: false, error: "Access to the port 'COM7' is denied." }],
  });
  assert.equal(busy.verdict, "busy");
  assert.equal(busy.looksNiimbot, true);
  assert.match(busy.advice.join(" "), /Close NIIMBOT\.exe/i);

  const scale = classifyProbedPort({
    port: "COM3",
    caption: "USB-SERIAL CH340 (COM3)",
    opens: [{ baud: 9600, opened: true, error: "" }],
  });
  assert.equal(scale.verdict, "opened");
  assert.equal(scale.looksScale, true);
  assert.match(scale.advice.join(" "), /scale, not the printer/i);

  const gone = classifyProbedPort({
    port: "COM9",
    caption: "",
    opens: [{ baud: 115200, opened: false, error: "The port 'COM9' does not exist." }],
  });
  assert.equal(gone.verdict, "missing");
});

test("P1: probe report is readable text with the real errors in it", () => {
  const probe = {
    ok: true,
    supported: true,
    platform: "win32",
    agentVersion: VERSION,
    generatedAt: "2026-09-07T00:00:00.000Z",
    ports: [
      classifyProbedPort({
        port: "COM6",
        caption: "Standard Serial over Bluetooth link (COM6)",
        pnpDeviceId: "BTHENUM\\LOCALMFG&0000",
        opens: [{ baud: 115200, opened: false, error: "The semaphore timeout period has expired." }],
      }),
    ],
    printers: [
      { name: "NIIMBOT K3", port: "USB005", driver: "NIIMBOT K3", offline: false, status: "3" },
    ],
    bluetooth: [{ name: "K3-1234", status: "OK", instanceId: "BTHLE\\DEV" }],
    warnings: [],
    summary: [],
  };
  probe.summary = summarizeComProbe(probe.ports, probe.printers);
  const text = formatComProbeReport(probe);
  assert.match(text, /COM6/);
  assert.match(text, /The semaphore timeout period has expired\./);
  assert.match(text, /NIIMBOT K3 \| port=USB005/);
  assert.match(text, /write-only/i);
  assert.match(text, /WHAT THIS MEANS/);
});

test("P1: probe never throws off Windows", async () => {
  const probe = await probeNiimbotComPorts({ agentVersion: VERSION });
  if (process.platform !== "win32") {
    assert.equal(probe.supported, false);
    assert.equal(probe.ok, true);
    assert.match(probe.text, /only runs on Windows/i);
  }
  assert.equal(typeof probe.text, "string");
});

test("P3: a USB spooler job is reported as unconfirmed, never as success", async () => {
  const bitmap = buildTestPatternBitmap(320, 160);
  const result = await printNiimbotLabel({
    printerName: "NIIMBOT K3",
    portName: "USB005",
    bitmapBase64: bitmap.toString("base64"),
    widthPx: 320,
    heightPx: 160,
    printWindowsPacketsFn: async () => {},
  });
  assert.equal(result.unconfirmed, true);
  assert.match(result.warning, /USB005 spooler queue/);
  assert.match(result.warning, /cannot confirm the label printed/i);
  assert.match(result.warning, /Bluetooth COM port or the Android Print Bridge/);
  // The fingerprint the merchant can quote back to us.
  assert.match(result.warning, /profile=k3/);
  assert.match(result.warning, /inkBytes=\d+/);
  assert.match(result.warning, /dim=00a00140/);
});

test("P3: every spooler job carries the fingerprint, whichever queue it went to", () => {
  const diag = {
    profile: "k3",
    packetCount: 9,
    rasterLines: 4,
    bitmapNonZeroBytes: 40,
    dimensionHex: "00a00140",
  };
  const fingerprint = /Fingerprint: profile=k3 packets=9 rasterLines=4 inkBytes=40 dim=00a00140/;
  assert.match(describeSpoolerUncertainty("USB005", "NIIMBOT K3", diag), fingerprint);
  // A queue on a non-USB port is just as blind, so it must warn just as loudly.
  const plain = describeSpoolerUncertainty(null, "NIIMBOT K3", diag);
  assert.match(plain, /Windows print queue/);
  assert.match(plain, /cannot confirm the label printed/i);
  assert.match(plain, fingerprint);
});

test("P3: the bar test can invert the bitmap, and the row width is reported", async () => {
  const bitmap = Buffer.alloc(40 * 4, 0);
  bitmap[0] = 0x0f;
  const seen = [];
  const opts = {
    printerName: "NIIMBOT K3",
    portName: "USB005",
    widthPx: 320,
    heightPx: 4,
    bitmapBase64: bitmap.toString("base64"),
    printWindowsPacketsFn: async ({ packetsBase64 }) => {
      seen.push(packetsBase64.map((p) => Buffer.from(p, "base64")));
    },
  };
  const plain = await printNiimbotLabel(opts);
  const inverted = await printNiimbotLabel({ ...opts, invertBitmap: true });

  assert.equal(plain.rasterRowBytes, 40);
  assert.equal(inverted.rasterRowBytes, 40);
  // Earlier builds accepted the flag and printed the same bitmap regardless.
  assert.equal(plain.bitmapNonZeroBytes, 1);
  assert.equal(inverted.bitmapNonZeroBytes, bitmap.length);

  // 55 55 85 LEN, then a 6-byte row header, then the 40 bytes of the row.
  const firstRowOf = (packets) => packets.find((p) => p[2] === 0x85).subarray(10, 50);
  const firstRow = firstRowOf(seen[0]);
  const firstInvertedRow = firstRowOf(seen[1]);
  for (let i = 0; i < firstRow.length; i++) {
    assert.equal(firstInvertedRow[i], firstRow[i] ^ 0xff);
  }
});

test("dashboard requires the agent build that can actually diagnose this", () => {
  const src = fs.readFileSync(
    path.join(here, "..", "..", "dashboard", "src", "lib", "print-agent.ts"),
    "utf8"
  );
  assert.match(src, new RegExp(`MIN_NIIMBOT_AGENT_VERSION = '${VERSION}'`));
  assert.match(src, /niimbot-label\/com-probe/);
  assert.match(src, /export async function probeNiimbotComPorts/);
});

/*
 * P2 — the USBPRINT device interface.
 *
 * niimgo, the only reference implementation that covers the K3, requires the USB
 * printer-class interface (/dev/usb/lp*) and states the Niimbot protocol does
 * not work over the K3's CDC-ACM serial interface. On Windows that interface is
 * GUID_DEVINTERFACE_USBPRINT, which CreateFile can open for read AND write —
 * unlike the spooler, whose standard USB port monitor is not bidirectional.
 */

test("P2: the USBPRINT device interface GUID and path shape are correct", () => {
  assert.equal(USBPRINT_INTERFACE_GUID, "28d78fad-5a12-11d1-ae5b-0000f803a8c2");
  const ps = buildUsbDeviceScript();
  assert.match(ps, /CreateFileW/);
  // GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, OPEN_EXISTING
  assert.match(ps, /0xC0000000, 3, \[IntPtr\]::Zero, 3/);
  assert.match(ps, new RegExp(`#\\{${USBPRINT_INTERFACE_GUID}\\}`));
  assert.match(ps, /\$_\.Service -eq 'usbprint'/);
  assert.match(ps, /ReadAsync/);
  // Reads must be bounded so a silent printer cannot hang the job.
  assert.match(ps, /\$task\.Wait\(\$ReadTimeoutMs\)/);
  assertSafePowerShellSource("usb device script", ps);
});

test("P2: only the acknowledging commands are read back, never raster rows", () => {
  const ps = buildUsbDeviceScript();
  const guard = ps.match(/if \(\$type -in ([^)]*)\) \{\n\s*\$buffer/);
  assert.ok(guard, "expected the reply guard to list the command types");
  assert.equal(guard[1].includes("0x85"), false);
  for (const cmd of ["0x21", "0x23", "0x01", "0x03", "0x13", "0xA3", "0xE3", "0xF3"]) {
    assert.ok(guard[1].includes(cmd), `${cmd} should be read back`);
  }
});

test("P2: probe reports whether the USB interface can be opened directly", () => {
  const probe = {
    ok: true,
    supported: true,
    platform: "win32",
    agentVersion: VERSION,
    generatedAt: "2026-09-07T00:00:00.000Z",
    ports: [],
    printers: [{ name: "NIIMBOT K3", port: "USB005", driver: "NIIMBOT K3", offline: false, status: "3" }],
    bluetooth: [],
    usbPrintDevices: [
      {
        name: "NIIMBOT K3",
        instanceId: "USB\\VID_3513&PID_0002\\5&2a1b&0&2",
        status: "OK",
        devicePath: `\\\\?\\usb#vid_3513&pid_0002#5&2a1b&0&2#{${USBPRINT_INTERFACE_GUID}}`,
        open: { opened: true, error: "" },
      },
    ],
    usbPrintError: null,
    warnings: [],
    summary: [],
  };
  probe.summary = summarizeComProbe(probe.ports, probe.printers, probe.usbPrintDevices);
  const text = formatComProbeReport(probe);
  assert.match(text, /USB PRINTER-CLASS INTERFACES \(1\)/);
  assert.match(text, /direct open: OK/);
  assert.match(text, /not bidirectional/);
  assert.match(text, /reference implementation requires/);

  probe.usbPrintDevices[0].open = { opened: false, error: "Access is denied" };
  probe.summary = summarizeComProbe(probe.ports, probe.printers, probe.usbPrintDevices);
  const denied = formatComProbeReport(probe);
  assert.match(denied, /direct open: FAILED — Access is denied/);
  assert.match(denied, /Close NIIMBOT\.exe and retry/);
});

test("P2: the scale opening its own port is not reported as a usable printer port", () => {
  const scale = classifyProbedPort({
    port: "COM3",
    caption: "USB-SERIAL CH340 (COM3)",
    opens: [{ baud: 9600, opened: true, error: "" }],
  });
  const summary = summarizeComProbe([scale], [], []);
  assert.match(summary.join(" "), /No COM port that could be the printer opened/);
  assert.equal(summary.join(" ").includes("COM3 @"), false);
});

/*
 * P0 — the port the queue is really bound to.
 *
 * The merchant's till: the NIIMBOT K3 queue prints to COM8 ("Port série"),
 * while USB005 is only still listed against it in the Ports dialog. Eight days
 * of blank labels are explained by writing to USB005 or to the spooler, which
 * relays to COM8 at the rate Windows has configured for that port — 9600 by
 * default, against a printer that only speaks 115200.
 */

/** The queues on the merchant's till, exactly as Windows reports them. */
const TILL_QUEUES = [
  { name: "GLPrinter80", port: "USB003", driver: "GLPrinter80" },
  { name: "K3-I527190103", port: "COM9:", driver: "", driverMissing: true },
  { name: "NIIMBOT K3", port: "COM8:", driver: "NIIMBOT K3", isDefault: true },
  { name: "POS-80C (copy 2)", port: "COM7:", driver: "POS-80C" },
  { name: "POS-80C (copy 3)", port: "COM6:", driver: "POS-80C" },
];

test("P0: the port the queue is bound to beats a stale USB005 association", () => {
  const t = chooseNiimbotTransport({
    printerName: "NIIMBOT K3",
    portName: "",
    boundPort: "COM8:",
    resolvedCom: null,
    resolvedUsb: "USB005",
  });
  assert.equal(t.mode, "com");
  assert.equal(t.comPort, "COM8");
  assert.equal(t.portSource, "queue");

  // A queue genuinely on USB005 still takes the USB path.
  const usb = chooseNiimbotTransport({
    printerName: "NIIMBOT K3",
    portName: "",
    boundPort: "USB005",
    resolvedUsb: "USB005",
  });
  assert.equal(usb.mode, "windows");
  assert.equal(usb.usbPort, "USB005");
  assert.equal(usb.portSource, "queue");

  // And a merely discovered COM port never outranks a real USB port.
  const guessed = chooseNiimbotTransport({
    printerName: "NIIMBOT K3",
    portName: "USB005",
    resolvedCom: "COM3",
    resolvedUsb: "USB005",
  });
  assert.equal(guessed.mode, "windows");
});

test("P0: every command carries the reply the printer owes us", () => {
  const bitmap = buildTestPatternBitmap(320, 4);
  const { steps } = buildNiimbotJobSteps(bitmap, 320, 4, 3, { printerName: "NIIMBOT K3" });
  const named = steps.filter((s) => s.name !== "Row").map((s) => [s.name, s.type, s.expect]);
  assert.deepEqual(named, [
    ["SetDensity", 0x21, 0x31],
    ["SetLabelType", 0x23, 0x33],
    ["PrintStart", 0x01, 0x02],
    ["PageStart", 0x03, 0x04],
    ["SetPageSize", 0x13, 0x14],
    ["PageEnd", 0xe3, 0xe4],
    ["PrintEnd", 0xf3, 0xf4],
  ]);
  // Raster rows are not acknowledged; waiting on them would stall every job.
  for (const row of steps.filter((s) => s.name === "Row")) {
    assert.equal(row.expect, -1);
  }
  // Only PrintEnd is repeated, and only until it answers 01.
  assert.equal(steps.find((s) => s.name === "PrintEnd").until, 0x01);
  assert.equal(steps.filter((s) => s.until >= 0).length, 1);

  // The flattened packet list the write-only transports use is unchanged.
  const { packets } = buildNiimbotJobPackets(bitmap, 320, 4, 3, { printerName: "NIIMBOT K3" });
  assert.equal(packets.filter((p) => p[2] === 0xa3).length, PROTOCOL_PROFILES.k3.statusPollCount);
  assert.ok(packets.findIndex((p) => p[2] === 0xf3) > packets.findIndex((p) => p[2] === 0xe3));

  // One payload line per step, so the script can never lose the pairing.
  const lines = serialPayloadLines(steps).split("\n");
  assert.equal(lines.length, steps.length);
  assert.deepEqual(lines[0].split("\t").slice(0, 3), ["SetDensity", "49", "-1"]);
});

test("P0: the serial script opens at the given baud and reads real frames", () => {
  const ps = buildSerialJobScript();
  assert.equal(SERIAL_BAUDS[0], 115200, "115200 must be tried first");
  assert.match(ps, /\$port\.DtrEnable = \$true/);
  assert.match(ps, /\$port\.RtsEnable = \$true/);
  assert.match(ps, /\$port\.DiscardInBuffer\(\)/);
  // 55 55 CMD LEN DATA CHK AA AA, parsed rather than read blindly.
  assert.match(ps, /function Split-NiimbotFrame/);
  assert.match(ps, /function Read-NiimbotFrame/);
  assert.match(ps, /-ne 0x55/);
  assert.match(ps, /-ne 0xAA/);
  // The rate Windows itself uses on the port is reported, not guessed at.
  assert.match(ps, /function Get-OsConfiguredBaud/);
  assert.match(ps, /Win32_SerialPortConfiguration/);
  assert.match(ps, /osConfiguredBaud/);
  assert.match(ps, /printed = \$printed/);
  assertSafePowerShellSource("serial handshake script", ps);
});

test("P0: a handshake result is only a success when 0xf4 answered 01", () => {
  const ok = parseHandshakeOutput(
    JSON.stringify({
      portPath: "COM8",
      baud: 115200,
      osConfiguredBaud: "9600 baud (mode)",
      bytesWritten: 6400,
      printed: true,
      steps: [
        { step: "SetDensity", request: 33, expect: 49, replyCmd: 49, replyHex: "01", ok: true },
        { step: "PrintEnd", request: 243, expect: 244, replyCmd: 244, replyHex: "01", ok: true, done: true },
      ],
    }),
    "COM8",
    115200
  );
  assert.equal(ok.printed, true);
  assert.equal(ok.answered, true);
  assert.equal(ok.osConfiguredBaud, "9600 baud (mode)");
  assert.match(describeHandshake(ok), /physically printed/);

  // Refused step: name it, with the bytes that came back.
  const refused = {
    comPort: "COM8",
    baud: 115200,
    bytesWritten: 12,
    printed: false,
    answered: true,
    replies: ["SetDensity=0x31:01"],
    steps: [
      { step: "SetDensity", expect: 0x31, replyCmd: 0x31, replyHex: "01", rawHex: "5555310101aaaa", ok: true },
      { step: "PrintStart", expect: 0x02, replyCmd: 0xdb, replyHex: "ff", rawHex: "5555db01ff24aaaa", ok: false },
    ],
  };
  const message = describeHandshake(refused);
  assert.match(message, /refused PrintStart/);
  assert.match(message, /expected 0x02, answered 0xdb/);
  assert.match(message, /5555db01ff24aaaa/);

  // Silence is a wrong port, and must say so instead of claiming anything.
  const silent = describeHandshake({
    comPort: "COM8",
    baud: 115200,
    bytesWritten: 6400,
    printed: false,
    answered: false,
    osConfiguredBaud: "9600 baud (mode)",
    replies: [],
    steps: [{ step: "SetDensity", expect: 0x31, replyCmd: -1, replyHex: "", rawHex: "", ok: false }],
  });
  assert.match(silent, /never answered/);
  assert.match(silent, /9600 baud/);
  assert.match(silent, /Diagnose Niimbot ports/);

  // Answered everything but never confirmed the label: say exactly that.
  const unfinished = describeHandshake({
    comPort: "COM8",
    baud: 115200,
    printed: false,
    answered: true,
    replies: ["PrintEnd=0xf4:00"],
    steps: [{ step: "PrintEnd", expect: 0xf4, replyCmd: 0xf4, replyHex: "00", attempts: 12, ok: true, done: false }],
  });
  assert.match(unfinished, /never returned 01 after 12 tries/);

  // A link that drops mid-job is a fourth outcome, and not a refusal.
  const dropped = describeHandshake({
    comPort: "COM8",
    baud: 115200,
    printed: false,
    answered: true,
    writeError: "The device does not recognize the command.",
    replies: ["SetDensity=0x31:01"],
    steps: [{ step: "SetDensity", expect: 0x31, replyCmd: 0x31, replyHex: "01", ok: true }],
  });
  assert.match(dropped, /answered at 115200 baud and then the port failed mid-job/);
  assert.match(dropped, /The device does not recognize the command\./);
  assert.match(dropped, /Replies before it dropped: SetDensity=0x31:01/);
});

test("P0: replies collected before a write failed are not lost with the exception", () => {
  // The script prints its JSON and *then* exits non-zero, so the failure
  // carries the answers on stdout. Those answers are the whole diagnosis.
  const stdout = JSON.stringify({
    portPath: "COM8",
    baud: 115200,
    osConfiguredBaud: "9600 baud (Win32_SerialPortConfiguration)",
    bytesWritten: 96,
    printed: false,
    writeError: "The I/O operation has been aborted.",
    steps: [{ step: "SetDensity", request: 33, expect: 49, replyCmd: 49, replyHex: "01", ok: true }],
  });
  const recovered = parseHandshakeOutput(stdout, "COM8", 115200);
  assert.equal(recovered.answered, true);
  assert.equal(recovered.printed, false);
  assert.equal(recovered.writeError, "The I/O operation has been aborted.");

  // An open failure prints nothing, so it must stay an exception.
  const client = read("../niimbot-client.js");
  assert.match(client, /function recoverHandshakeOutput/);
  assert.match(client, /return parsed\.steps\.length \? parsed : null/);
  const ps = buildSerialJobScript();
  const jsonIdx = ps.indexOf("ConvertTo-Json -Depth 5");
  assert.ok(jsonIdx > 0);
  assert.ok(
    ps.indexOf("exit 21", jsonIdx) > jsonIdx,
    "the write-failure exit must come after the JSON is emitted"
  );
});

test("P0: a confirmed serial print is the only result reported as printed", async () => {
  const bitmap = buildTestPatternBitmap(320, 8);
  const base = {
    printerName: "NIIMBOT K3",
    bitmapBase64: bitmap.toString("base64"),
    widthPx: 320,
    heightPx: 8,
    // The queue is bound to COM8 while USB005 is still associated with it.
    resolveQueuePortFn: async () => ({ name: "NIIMBOT K3", portName: "COM8:", driverName: "NIIMBOT K3" }),
    resolveWindowsUsbPortFn: async () => "USB005",
    printWindowsPacketsFn: async () => {
      throw new Error("the spooler must not be used when the queue is on a COM port");
    },
  };

  const printed = await printNiimbotLabel({
    ...base,
    printSerialFn: async () => ({
      comPort: "COM8",
      baud: 115200,
      osConfiguredBaud: "9600 baud (mode)",
      bytesWritten: 6400,
      printed: true,
      answered: true,
      replies: ["PrintEnd=0xf4:01"],
      steps: [{ step: "PrintEnd", expect: 0xf4, replyCmd: 0xf4, replyHex: "01", ok: true, done: true }],
    }),
  });
  assert.equal(printed.path, "com");
  assert.equal(printed.printer, "COM8");
  assert.equal(printed.portSource, "queue");
  assert.equal(printed.confirmed, true);
  assert.equal(printed.unconfirmed, false);
  assert.equal(printed.baud, 115200);
  assert.equal(printed.queuePort, "COM8:");
  assert.match(printed.detail, /physically printed/);

  // The printer answered and refused: report it, never fall back to the spooler.
  const refused = await printNiimbotLabel({
    ...base,
    printSerialFn: async () => ({
      comPort: "COM8",
      baud: 115200,
      bytesWritten: 12,
      printed: false,
      answered: true,
      replies: ["SetDensity=0x31:01"],
      steps: [
        { step: "SetDensity", expect: 0x31, replyCmd: 0x31, replyHex: "01", ok: true },
        { step: "SetPageSize", expect: 0x14, replyCmd: 0xdb, replyHex: "", rawHex: "5555db00dbaaaa", ok: false },
      ],
    }),
  });
  assert.equal(refused.unconfirmed, true);
  assert.equal(refused.confirmed, false);
  assert.match(refused.warning, /refused SetPageSize/);
  assert.match(refused.warning, /inkBytes=\d+/);
  assert.match(refused.warning, /rowBytes=40/);

  // Silence on a COM-bound queue must fail loudly, not go to the spooler.
  await assert.rejects(
    printNiimbotLabel({
      ...base,
      printSerialFn: async () => ({
        comPort: "COM8",
        baud: 115200,
        bytesWritten: 6400,
        printed: false,
        answered: false,
        replies: [],
        steps: [{ step: "SetDensity", expect: 0x31, replyCmd: -1, replyHex: "", rawHex: "", ok: false }],
      }),
    }),
    /never answered/
  );
});

test("P1: a COM port owned by a receipt printer is refused before any bytes go out", async () => {
  const owners = {
    byPort: { COM6: ["POS-80C (copy 3)"], COM8: ["NIIMBOT K3"] },
    recommended: recommendNiimbotPort(TILL_QUEUES),
  };
  const message = describeForeignComPort({
    comPort: "COM6",
    owners: owners.byPort,
    printerName: "POS-80C (copy 3)",
    recommended: owners.recommended,
  });
  assert.match(message, /COM6 belongs to POS-80C \(copy 3\), a receipt printer/);
  assert.match(message, /will not print a label/);
  assert.match(message, /COM8/);

  // The Niimbot's own port is not foreign.
  assert.equal(
    describeForeignComPort({
      comPort: "COM8",
      owners: owners.byPort,
      printerName: "NIIMBOT K3",
      recommended: owners.recommended,
    }),
    ""
  );
  // Neither is a port no queue claims.
  assert.equal(
    describeForeignComPort({ comPort: "COM5", owners: owners.byPort, printerName: "NIIMBOT K3" }),
    ""
  );

  let serialUsed = false;
  await assert.rejects(
    printNiimbotLabel({
      printerName: "POS-80C (copy 3)",
      portName: "COM6",
      bitmapBase64: buildTestPatternBitmap(320, 8).toString("base64"),
      widthPx: 320,
      heightPx: 8,
      resolveComOwnersFn: async () => owners,
      printSerialFn: async () => {
        serialUsed = true;
        return { comPort: "COM6", printed: true, answered: true, steps: [], replies: [] };
      },
      printWindowsPacketsFn: async () => {},
    }),
    /COM6 belongs to POS-80C \(copy 3\)/
  );
  assert.equal(serialUsed, false, "no Niimbot frames may reach a receipt printer's port");
});

test("P1: the recommended port is the one bound to the Niimbot queue", () => {
  const recommended = recommendNiimbotPort(TILL_QUEUES);
  assert.equal(recommended.port, "COM8");
  assert.equal(recommended.queue, "NIIMBOT K3");
  assert.equal(recommended.reason, "bound-to-queue");

  // No COM-bound queue: fall back to a Bluetooth outgoing port for the printer.
  const spp = recommendNiimbotPort(
    [{ name: "NIIMBOT K3", port: "USB005", driver: "NIIMBOT K3" }],
    [
      classifyProbedPort({
        port: "COM4",
        caption: "Standard Serial over Bluetooth link (COM4)",
        pnpDeviceId: "BTHENUM\\{00001101-0000-1000-8000-00805F9B34FB}_VID&00010075_PID&0001",
        queues: ["K3-I527190103"],
        opens: [{ baud: 115200, opened: true, error: "" }],
      }),
    ]
  );
  assert.equal(spp.port, "COM4");
  assert.equal(spp.reason, "bluetooth-outgoing");
  assert.equal(recommendNiimbotPort([], []), null);
});

test("P1: a bound port the probe could not open is not the recommendation", () => {
  // The K3-* pairing sits on the Bluetooth *incoming* port, which Windows can
  // never send on. Recommending it would send the merchant back to a dead port.
  const dead = classifyProbedPort({
    port: "COM9",
    caption: "Standard Serial over Bluetooth link (COM9)",
    pnpDeviceId: "BTHENUM\\{00001101-0000-1000-8000-00805F9B34FB}_LOCALMFG&0000",
    queues: ["K3-I527190103"],
    opens: [{ baud: 115200, opened: false, error: "The semaphore timeout period has expired." }],
  });
  const live = classifyProbedPort({
    port: "COM4",
    caption: "Standard Serial over Bluetooth link (COM4)",
    pnpDeviceId: "BTHENUM\\{00001101-0000-1000-8000-00805F9B34FB}_VID&0001",
    opens: [{ baud: 115200, opened: true, error: "" }],
  });
  const queues = [{ name: "K3-I527190103", port: "COM9:", driver: "", driverMissing: true }];

  // With nothing else, the dead port is still named so the report says what to fix.
  assert.deepEqual(recommendNiimbotPort(queues, [dead]), {
    port: "COM9",
    queue: "K3-I527190103",
    reason: "bound-to-driverless-queue",
  });
  // A port that actually opens wins, even though no queue is bound to it.
  const better = recommendNiimbotPort(queues, [dead, { ...live, looksNiimbot: true }]);
  assert.equal(better.port, "COM4");
  assert.equal(better.reason, "bluetooth-outgoing");

  // And the summary must not call a port it could not open "the transport to use".
  const text = summarizeComProbe([dead], queues, []).join(" ");
  assert.match(text, /'K3-I527190103' prints to COM9, but COM9 could not be opened — nothing answered on it/);
  assert.match(text, /Bluetooth incoming port, which Windows can never send on/);
  assert.equal(text.includes("COM9 itself at 115200"), false);
});

/*
 * P3 — one report that is enough to configure the printer.
 *
 * Everything the merchant's three screenshots revealed has to be in the text:
 * which port each queue is bound to, which queue owns each COM port, whether a
 * driver is missing, the rate Windows has the port configured at, whether a
 * Bluetooth port is the incoming or the outgoing one, and the port to pick.
 */
test("P3: the probe report answers every question the screenshots raised", () => {
  const ports = [
    classifyProbedPort({
      port: "COM6",
      caption: "Standard Serial over Bluetooth link (COM6)",
      pnpDeviceId: "BTHENUM\\{00001101-0000-1000-8000-00805F9B34FB}_VID&00010075_PID&0001",
      configuredBaud: "9600 baud (mode)",
      queues: ["POS-80C (copy 3)"],
      opens: [{ baud: 115200, opened: true, error: "" }],
    }),
    classifyProbedPort({
      port: "COM8",
      caption: "Standard Serial over Bluetooth link (COM8)",
      pnpDeviceId: "BTHENUM\\{00001101-0000-1000-8000-00805F9B34FB}_VID&00010075_PID&0002",
      configuredBaud: "9600 baud (mode)",
      queues: ["NIIMBOT K3"],
      opens: [{ baud: 115200, opened: true, error: "" }],
    }),
  ];
  const printers = TILL_QUEUES.map((q) => ({ ...q, offline: false, status: "3" }));
  const probe = {
    ok: true,
    supported: true,
    platform: "win32",
    agentVersion: VERSION,
    generatedAt: "2026-09-07T00:00:00.000Z",
    ports,
    printers,
    bluetooth: [{ name: "K3-I527190103", status: "OK", instanceId: "BTHENUM\\DEV" }],
    usbPrintDevices: [],
    usbPrintError: null,
    warnings: [],
    recommendedPort: recommendNiimbotPort(printers, ports),
    summary: summarizeComProbe(ports, printers, []),
  };
  const text = formatComProbeReport(probe);

  // The queue -> port binding, for every queue, with the missing driver named.
  assert.match(text, /NIIMBOT K3 \| port=COM8: \| driver=NIIMBOT K3/);
  assert.match(text, /K3-I527190103 \| port=COM9: \| driver=none \| DRIVER MISSING/);
  assert.match(text, /Pilote indisponible/);

  // Per port: who owns it, what Windows has it configured at, its BT direction.
  assert.match(text, /COM6 —[\s\S]*?owned by print queue: POS-80C \(copy 3\)/);
  assert.match(text, /COM8 —[\s\S]*?owned by print queue: NIIMBOT K3/);
  assert.match(text, /Windows baud on this port: 9600 baud \(mode\)/);
  assert.match(text, /bluetooth outgoing/);

  // The one line that ends the guessing.
  assert.match(text, /RECOMMENDED PORT FOR NIIMBOT: COM8 \(bound to queue 'NIIMBOT K3'\)/);

  // COM6 must be called out as another printer's port, not offered as a choice.
  assert.match(text, /Do not select COM6 \(POS-80C \(copy 3\)\)/);
  assert.match(
    text,
    /'NIIMBOT K3' prints to COM8, a serial port\. The agent opens COM8 itself at 115200/
  );
  // And the 9600-vs-115200 mismatch that explains the blank labels.
  assert.match(text, /Windows has COM8 configured at 9600 baud[\s\S]*?a Niimbot cannot read/);
});

test("P3: a port bound to a foreign queue is flagged on the port itself", () => {
  const row = classifyProbedPort({
    port: "COM6",
    caption: "Standard Serial over Bluetooth link (COM6)",
    pnpDeviceId: "BTHENUM\\{00001101-0000-1000-8000-00805F9B34FB}_VID&0001",
    configuredBaud: "9600 baud (mode)",
    queues: ["POS-80C (copy 3)"],
    opens: [{ baud: 115200, opened: true, error: "" }],
  });
  assert.deepEqual(row.foreignQueues, ["POS-80C (copy 3)"]);
  assert.equal(row.bluetoothOutgoing, true);
  assert.equal(row.bluetoothIncoming, false);
  assert.match(row.advice.join(" "), /not a Niimbot/);
  assert.match(row.advice.join(" "), /configured at 9600 baud/);

  // A port bound to the Niimbot queue is recognised even when its caption is
  // the generic Bluetooth one, which is all Windows gives us for an SPP port.
  const niimbot = classifyProbedPort({
    port: "COM8",
    caption: "Standard Serial over Bluetooth link (COM8)",
    queues: ["NIIMBOT K3"],
    opens: [{ baud: 115200, opened: true, error: "" }],
  });
  assert.equal(niimbot.looksNiimbot, true);
  assert.deepEqual(niimbot.foreignQueues, []);
});

test("P2: the direct USB path is preferred over the spooler and is skippable", async () => {
  const bitmap = buildTestPatternBitmap(320, 160);
  let spoolerUsed = false;
  // directUsb:false keeps the old spooler behaviour available as a fallback.
  const viaSpooler = await printNiimbotLabel({
    printerName: "NIIMBOT K3",
    portName: "USB005",
    bitmapBase64: bitmap.toString("base64"),
    widthPx: 320,
    heightPx: 160,
    directUsb: false,
    printWindowsPacketsFn: async () => {
      spoolerUsed = true;
    },
  });
  assert.equal(spoolerUsed, true);
  assert.equal(viaSpooler.path, "usb:USB005");
  assert.equal(viaSpooler.unconfirmed, true);
});
