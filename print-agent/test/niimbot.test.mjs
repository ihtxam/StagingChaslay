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
  classifyProbedPort,
  formatComProbeReport,
  summarizeComProbe,
  probeNiimbotComPorts,
  PROTOCOL_PROFILES,
  SERIAL_BAUDS,
} = require("../niimbot-client.js");

const here = path.dirname(fileURLToPath(import.meta.url));
const VERSION = "1.10.13";

function read(rel) {
  return fs.readFileSync(path.join(here, rel), "utf8");
}

test("print-agent version is 1.10.13 in package.json, server.js, and download manifest", () => {
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

test("P3: a COM job carries no warning and reports the baud that worked", () => {
  assert.equal(describeSpoolerUncertainty(null, "NIIMBOT K3", {}), "");
  assert.match(
    describeSpoolerUncertainty("USB005", "NIIMBOT K3", {
      profile: "k3",
      packetCount: 9,
      rasterLines: 4,
      bitmapNonZeroBytes: 40,
      dimensionHex: "00a00140",
    }),
    /Fingerprint: profile=k3 packets=9 rasterLines=4 inkBytes=40 dim=00a00140/
  );
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
