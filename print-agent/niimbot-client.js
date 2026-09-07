/**
 * Niimbot label printer protocol (K3 / B21 / D11 / B1).
 * Ported from https://github.com/AndBondStyle/niimprint
 * Protocol variants per https://printers.niim.blue/interfacing/proto/
 */
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const RequestCode = {
  SET_LABEL_DENSITY: 0x21,
  SET_LABEL_TYPE: 0x23,
  START_PRINT: 0x01,
  END_PRINT: 0xf3,
  START_PAGE_PRINT: 0x03,
  END_PAGE_PRINT: 0xe3,
  SET_DIMENSION: 0x13,
  GET_PRINT_STATUS: 0xa3,
  CONNECT: 0xc1,
};

/** Official app resets the firmware state machine before each job (0x03 prefix + Connect). */
const CONNECT_BYTES = Buffer.from([0x03, 0x55, 0x55, 0xc1, 0x01, 0x01, 0xc1, 0xaa, 0xaa]);

/** Wake bytes before framed packets — official NIIMBOT.exe sends 0x54 0x01 after Connect. */
const WAKE_BYTES = Buffer.from([0x54, 0x01]);

/**
 * Print-task aligned profiles (niimprint + niimbluelib print_tasks/*).
 * K3/B21_V1: printStart1b + setPageSize4b(rows, cols) — niimprint printer.py L89-95.
 * B21L2B: same + countsMode total — B21L2BPrintTask.ts L45.
 * B1/B21S/Niimbus (2024): printStart7b + setPageSize6b — B1PrintTask.ts L12-18.
 */
const PROTOCOL_PROFILES = {
  k3: {
    task: "K3_USB",
    startPrint: [1],
    dimensionBytes(rowsPx, colsPx) {
      const dim = Buffer.alloc(4);
      dim.writeUInt16BE(rowsPx, 0);
      dim.writeUInt16BE(colsPx, 2);
      return dim;
    },
    countsMode: "total",
    statusPollCount: 8,
    statusPollCountUsb: 3,
    printheadPixels: 384,
  },
  b21: {
    task: "B21_V1",
    startPrint: [1],
    dimensionBytes(rowsPx, colsPx) {
      const dim = Buffer.alloc(4);
      dim.writeUInt16BE(rowsPx, 0);
      dim.writeUInt16BE(colsPx, 2);
      return dim;
    },
    countsMode: "total",
    statusPollCount: 10,
    statusPollCountUsb: 4,
    printheadPixels: 384,
  },
  b1: {
    task: "B1",
    startPrint: [0, 1, 0, 0, 0, 0, 0],
    dimensionBytes(rowsPx, colsPx) {
      const dim = Buffer.alloc(6);
      dim.writeUInt16BE(rowsPx, 0);
      dim.writeUInt16BE(colsPx, 2);
      dim.writeUInt16BE(1, 4);
      return dim;
    },
    countsMode: "auto",
    statusPollCount: 10,
    statusPollCountUsb: 4,
    printheadPixels: 384,
  },
};

const PACKET_TYPE_NAMES = {
  0x21: "SetDensity",
  0x23: "SetLabelType",
  0x01: "PrintStart",
  0x03: "PageStart",
  0x13: "SetPageSize",
  0x85: "PrintBitmapRow",
  0xe3: "PageEnd",
  0xa3: "PrintStatus",
  0xf3: "PrintEnd",
  0xc1: "Connect",
};

function niimbotPacket(type, data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
  const len = buf.length;
  let checksum = type ^ len;
  for (let i = 0; i < len; i++) checksum ^= buf[i];
  return Buffer.concat([Buffer.from([0x55, 0x55, type, len]), buf, Buffer.from([checksum, 0xaa, 0xaa])]);
}

function isNiimbotPrinterName(name) {
  const n = String(name || "").toLowerCase();
  return /niimbot|niimbus|\bk3\b|\bb21\b|\bd11\b|\bb1\b|\bd110\b/.test(n);
}

function detectNiimbotProfile(printerName, portName, explicit) {
  const want = String(explicit || "").trim().toLowerCase();
  if (want && PROTOCOL_PROFILES[want]) return want;
  const blob = `${printerName || ""} ${portName || ""}`.toLowerCase();
  if (/\bb1\b/.test(blob)) return "b1";
  // Niimbus / B21S use the 2024 B1 print task (7-byte start + 6-byte page size).
  if (/niimbus|b21s/.test(blob)) return "b1";
  if (/\bb21\b|\bd11\b|\bd110\b/.test(blob)) return "b21";
  if (/\bk3\b|k3w|b3s/.test(blob)) return "k3";
  return "k3";
}

function detectNiimbotProfileCandidates(printerName, portName) {
  const primary = detectNiimbotProfile(printerName, portName);
  const blob = `${printerName || ""} ${portName || ""}`.toLowerCase();
  const candidates = [primary];
  if (/niimbus|b21s/.test(blob)) {
    for (const p of ["b1", "b21", "k3"]) {
      if (!candidates.includes(p)) candidates.push(p);
    }
  }
  return candidates;
}

/** Pad cols to a multiple of 8 px (niimbluelib ImageEncoder — not forced to 384). */
function alignBitmapCols(bitmap, widthPx, heightPx) {
  const srcW = Math.max(1, Number(widthPx) || 1);
  const alignedW = Math.ceil(srcW / 8) * 8;
  const rows = Math.max(1, Number(heightPx) || 1);
  const srcRowBytes = Math.ceil(srcW / 8);
  const rowBytes = Math.ceil(alignedW / 8);
  const src = Buffer.isBuffer(bitmap) ? bitmap : Buffer.from(bitmap || []);
  if (alignedW === srcW && src.length >= srcRowBytes * rows) {
    return { bitmap: src.subarray(0, srcRowBytes * rows), widthPx: alignedW, heightPx: rows };
  }
  const out = Buffer.alloc(rowBytes * rows);
  for (let y = 0; y < rows; y++) {
    const srcOff = y * srcRowBytes;
    if (srcOff < src.length) {
      src.copy(out, y * rowBytes, srcOff, srcOff + Math.min(srcRowBytes, src.length - srcOff));
    }
  }
  return { bitmap: out, widthPx: alignedW, heightPx: rows };
}

/** @deprecated alias — kept for diagnostics imports */
function padBitmapToPrinthead(bitmap, widthPx, heightPx) {
  return alignBitmapCols(bitmap, widthPx, heightPx);
}

function invertBitmap(bitmap, widthPx, heightPx) {
  const rowBytes = Math.ceil(Math.max(1, widthPx) / 8);
  const rows = Math.max(1, heightPx);
  const src = Buffer.isBuffer(bitmap) ? bitmap : Buffer.from(bitmap || []);
  const out = Buffer.alloc(rowBytes * rows);
  const len = Math.min(src.length, out.length);
  for (let i = 0; i < len; i++) out[i] = src[i] ^ 0xff;
  return out;
}

function countPixelsForLine(lineData, printheadPixels) {
  let total = 0;
  for (let i = 0; i < lineData.length; i++) {
    let value = lineData[i];
    for (let bit = 0; bit < 8; bit++) {
      if (value & (1 << bit)) total++;
    }
  }
  const chunkSize = Math.floor(printheadPixels / 8 / 3);
  if (lineData.length <= chunkSize * 3) {
    const parts = [0, 0, 0];
    for (let byteN = 0; byteN < lineData.length; byteN++) {
      const chunkIdx = Math.floor(byteN / chunkSize);
      let value = lineData[byteN];
      for (let bit = 0; bit < 8; bit++) {
        if (value & (1 << bit) && chunkIdx <= 2) parts[chunkIdx]++;
      }
    }
    return parts;
  }
  return [0, total & 0xff, (total >> 8) & 0xff];
}

function lineBlackCounts(lineData, printheadPixels, countsMode) {
  if (countsMode === "zero") return [0, 0, 0];
  if (countsMode === "total") {
    let total = 0;
    for (let i = 0; i < lineData.length; i++) {
      let value = lineData[i];
      for (let bit = 0; bit < 8; bit++) {
        if (value & (1 << bit)) total++;
      }
    }
    return [0, total & 0xff, (total >> 8) & 0xff];
  }
  return countPixelsForLine(lineData, printheadPixels);
}

function encodeBitmapLines(bitmap, widthPx, heightPx, profile) {
  const rowBytes = Math.ceil(widthPx / 8);
  const packets = [];
  for (let y = 0; y < heightPx; y++) {
    const rowStart = y * rowBytes;
    const lineData = bitmap.subarray(rowStart, rowStart + rowBytes);
    const counts = lineBlackCounts(lineData, profile.printheadPixels, profile.countsMode);
    const header = Buffer.alloc(6);
    header.writeUInt16BE(y, 0);
    header[2] = counts[0];
    header[3] = counts[1];
    header[4] = counts[2];
    header[5] = 1;
    packets.push(niimbotPacket(0x85, Buffer.concat([header, lineData])));
  }
  return packets;
}

function buildStatusPollPackets(count) {
  const packets = [];
  for (let i = 0; i < count; i++) {
    packets.push(niimbotPacket(RequestCode.GET_PRINT_STATUS, [1]));
  }
  return packets;
}

function summarizePacketTypes(packets, { includePreamble = false } = {}) {
  const seq = [];
  if (includePreamble) {
    seq.push("Connect(0x03+C1)", "Wake(0x54 0x01)");
  }
  for (const p of packets || []) {
    const t = p[2];
    if (t === 0x85) {
      seq.push("PrintBitmapRow");
      continue;
    }
    seq.push(PACKET_TYPE_NAMES[t] || `0x${t.toString(16)}`);
  }
  return seq;
}

function buildNiimbotJobPackets(bitmap, widthPx, heightPx, density = 3, options = {}) {
  const profileName = detectNiimbotProfile(
    options.printerName,
    options.portName,
    options.profile
  );
  const profile = PROTOCOL_PROFILES[profileName];
  let working = Buffer.isBuffer(bitmap) ? bitmap : Buffer.from(bitmap || []);
  if (options.invertBitmap === true) {
    working = invertBitmap(working, widthPx, heightPx);
  }
  const aligned = alignBitmapCols(working, widthPx, heightPx);
  const d = Math.min(5, Math.max(1, Number(density) || 3));
  const usbPath = options.transport === "windows" || options.transport === "usb";
  const pollCount = usbPath
    ? profile.statusPollCountUsb || 3
    : profile.statusPollCount;
  const packets = [];
  const push = (type, data) => packets.push(niimbotPacket(type, Buffer.from(data)));

  push(RequestCode.SET_LABEL_DENSITY, [d]);
  push(RequestCode.SET_LABEL_TYPE, [1]);
  push(RequestCode.START_PRINT, profile.startPrint);
  // USB spooler is one-way — status after PrintStart matches official app / b1 v4 captures.
  push(RequestCode.GET_PRINT_STATUS, [1]);
  push(RequestCode.START_PAGE_PRINT, [1]);
  // rows = height (feed axis), cols = width (printhead axis) — niimprint set_dimension L212-214.
  push(
    RequestCode.SET_DIMENSION,
    profile.dimensionBytes(aligned.heightPx, aligned.widthPx)
  );
  packets.push(...encodeBitmapLines(aligned.bitmap, aligned.widthPx, aligned.heightPx, profile));
  push(RequestCode.END_PAGE_PRINT, [1]);
  packets.push(...buildStatusPollPackets(pollCount));
  push(RequestCode.END_PRINT, [1]);

  const dimPkt = packets.find((p) => p[2] === RequestCode.SET_DIMENSION);
  const setDimensionHex = dimPkt ? dimPkt.subarray(4, 4 + dimPkt[3]).toString("hex") : "";
  const raster = packets.find((p) => p[2] === 0x85);

  return {
    packets,
    profile: profileName,
    task: profile.task,
    bitmap: aligned.bitmap,
    widthPx: aligned.widthPx,
    heightPx: aligned.heightPx,
    setDimensionBytes: dimPkt ? dimPkt[3] : 0,
    setDimensionHex,
    rasterRowBytes: Math.ceil(aligned.widthPx / 8),
    rasterPacketLen: raster ? raster.length : 0,
    packetTypeSequence: summarizePacketTypes(packets),
    countsMode: profile.countsMode,
  };
}

function buildOfficialPacketExpectations(widthPx, heightPx) {
  const aligned = alignBitmapCols(buildTestPatternBitmap(widthPx, heightPx), widthPx, heightPx);
  const out = {};
  for (const name of Object.keys(PROTOCOL_PROFILES)) {
    const sample = buildNiimbotJobPackets(aligned.bitmap, widthPx, heightPx, 3, { profile: name });
    out[name] = {
      task: PROTOCOL_PROFILES[name].task,
      packetTypeSequence: summarizePacketTypes(sample.packets, { includePreamble: true }),
      setDimensionBytes: sample.setDimensionBytes,
      setDimensionHex: sample.setDimensionHex,
      startPrintBytes: PROTOCOL_PROFILES[name].startPrint.length,
      rasterRowBytes: sample.rasterRowBytes,
      rasterPacketLen: sample.rasterPacketLen,
      countsMode: PROTOCOL_PROFILES[name].countsMode,
      colsPx: sample.widthPx,
      rowsPx: sample.heightPx,
    };
  }
  return out;
}

/** Solid horizontal bars for protocol smoke-test (verifies thermal head fires). */
function buildTestPatternBitmap(widthPx, heightPx) {
  const rowBytes = Math.ceil(widthPx / 8);
  const bitmap = Buffer.alloc(rowBytes * heightPx, 0);
  for (let y = 0; y < heightPx; y++) {
    if (y % 8 < 4) {
      bitmap.fill(0xff, y * rowBytes, (y + 1) * rowBytes);
    }
  }
  return bitmap;
}

function isComPort(name) {
  return /^COM\d+$/i.test(String(name || "").trim());
}

function isWindowsUsbPort(name) {
  return /^USB\d+$/i.test(String(name || "").trim());
}

function extractComPort(...values) {
  for (const raw of values) {
    const text = String(raw || "").trim();
    if (!text) continue;
    if (isComPort(text)) return text.toUpperCase();
    const paren = text.match(/\((COM\d+)\)/i);
    if (paren) return paren[1].toUpperCase();
    const inline = text.match(/\b(COM\d+)\b/i);
    if (inline) return inline[1].toUpperCase();
  }
  return null;
}

function extractWindowsUsbPort(...values) {
  for (const raw of values) {
    const text = String(raw || "").trim();
    if (!text) continue;
    if (isWindowsUsbPort(text)) return text.toUpperCase();
    const inline = text.match(/\b(USB\d+)\b/i);
    if (inline) return inline[1].toUpperCase();
  }
  return null;
}

function normalizeComPort(port) {
  const raw = String(port || "").trim();
  if (!raw) return "";
  const stripped = raw.replace(/^\\\\\.\\/i, "").toUpperCase();
  const m = stripped.match(/^COM(\d+)$/);
  if (!m) return raw;
  const num = parseInt(m[1], 10);
  const com = `COM${num}`;
  return num >= 10 ? `\\\\.\\${com}` : com;
}

function packetDelayMs(packet, transport = "windows") {
  if (!packet || packet.length < 3) return transport === "com" ? 80 : 50;
  const type = packet[2];
  if (type === 0x85) return 12;
  if (type === RequestCode.GET_PRINT_STATUS) return transport === "com" ? 150 : 80;
  if (type === RequestCode.END_PAGE_PRINT || type === RequestCode.END_PRINT) return 200;
  return transport === "com" ? 80 : 50;
}

function estimateJobDelayMs(packets, transport = "windows") {
  let ms = 160; // CONNECT + wake + tail settle
  for (const pkt of packets || []) {
    ms += packetDelayMs(pkt, transport);
  }
  return ms;
}

function describeJob(bitmap, packets, profile, path, extra = {}) {
  const nonZero = bitmap ? [...bitmap].filter((b) => b !== 0).length : 0;
  const first3 = (packets || []).slice(0, 3).map((p) => p.subarray(0, Math.min(16, p.length)).toString("hex"));
  const dim = (packets || []).find((p) => p[2] === RequestCode.SET_DIMENSION);
  const transport = path === "com" ? "com" : path && String(path).startsWith("usb:") ? "windows-usb" : "windows";
  return {
    path,
    transport,
    profile,
    packetCount: packets.length,
    bitmapBytes: bitmap ? bitmap.length : 0,
    bitmapNonZeroBytes: nonZero,
    connectHex: CONNECT_BYTES.toString("hex"),
    wakeHex: WAKE_BYTES.toString("hex"),
    firstPacketHex: first3[0] || "",
    first3PacketsHex: first3,
    setDimensionHex: extra.setDimensionHex || (dim ? dim.subarray(4, 4 + dim[3]).toString("hex") : ""),
    rasterRowBytes: extra.rasterRowBytes || null,
    rasterLines: packets.filter((p) => p[2] === 0x85).length,
    estimatedDelayMs: estimateJobDelayMs(packets, transport === "com" ? "com" : "windows"),
    paddedPx: extra.widthPx && extra.heightPx ? { widthPx: extra.widthPx, heightPx: extra.heightPx } : undefined,
    alignedPx: extra.widthPx && extra.heightPx ? { widthPx: extra.widthPx, heightPx: extra.heightPx } : undefined,
    setDimensionBytes: extra.setDimensionBytes,
    countsMode: extra.countsMode,
    packetTypeSequence: extra.packetTypeSequence,
    usbWriteMode: extra.usbWriteMode || null,
  };
}

function describeSerialFailure(comPort, error) {
  const raw = [error && error.stderr, error && error.message]
    .filter(Boolean)
    .join("\n");
  const label = String(comPort || "COM").toUpperCase();
  if (error && (error.killed || error.code === "ETIMEDOUT")) {
    return `Niimbot ${label} timed out`;
  }
  if (/access is denied|UnauthorizedAccess/i.test(raw)) {
    return `Niimbot ${label} is in use or access denied (close NIIMBOT.exe)`;
  }
  if (/does not exist|FileNotFoundException|cannot find the (file|port)/i.test(raw)) {
    return `Niimbot ${label} was not found`;
  }
  const useful =
    raw.match(/Niimbot[^\n]*/i) ||
    raw.match(/Access to the port '[^']+'[^\n]*/i) ||
    raw.match(/The port '[^']+'[^\n]*/i);
  if (useful) return useful[0].slice(0, 180);
  return `Niimbot ${label} serial write failed`;
}

async function printNiimbotJobSerial(comPort, job) {
  const port = normalizeComPort(comPort);
  const { packets } = job;
  const payloadB64 = packets.map((p) => p.toString("base64")).join("\n");
  const timeoutMs = Math.min(180000, Math.max(45000, 12000 + packets.length * 50));

  const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Ports
$port = New-Object System.IO.Ports.SerialPort '${port.replace(/'/g, "''")}',115200,'None',8,'One'
$port.ReadTimeout = 500
$port.WriteTimeout = 15000
$port.Open()
try {
  $connect = [byte[]](0x03, 0x55, 0x55, 0xc1, 0x01, 0x01, 0xc1, 0xaa, 0xaa)
  $port.Write($connect, 0, $connect.Length)
  Start-Sleep -Milliseconds 40
  $wake = [byte[]](0x54, 0x01)
  $port.Write($wake, 0, $wake.Length)
  Start-Sleep -Milliseconds 80
  $lines = @'
${payloadB64}
'@ -split "\\n" | Where-Object { $_ -and $_.Trim() }
  foreach ($line in $lines) {
    $bytes = [Convert]::FromBase64String($line.Trim())
    $port.Write($bytes, 0, $bytes.Length)
    $type = if ($bytes.Length -ge 3) { [int]$bytes[2] } else { 0 }
    $delay = 80
    if ($type -eq 0x85) { $delay = 12 }
    elseif ($type -eq 0xA3) { $delay = 150 }
    elseif ($type -in 0xE3, 0xF3) { $delay = 200 }
    Start-Sleep -Milliseconds $delay
    if ($type -eq 0xA3) {
      $buf = New-Object byte[] 64
      try { [void]$port.Read($buf, 0, $buf.Length) } catch { }
    }
  }
  Start-Sleep -Milliseconds 400
} finally {
  if ($port.IsOpen) { $port.Close() }
  $port.Dispose()
}
`;
  try {
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-Command", ps],
      { windowsHide: true, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }
    );
  } catch (error) {
    throw new Error(describeSerialFailure(comPort, error));
  }
}

/**
 * Named Niimbot/Niimbus: prefer COM (CH340 UART) over USBPRINT.
 * USB005 spooler often beeps+feeds while ignoring raster (see win-raw-print 96-byte
 * chunk + ESC/POS cut). CH340 *scales* still must not steal the job: discovery only
 * returns ports whose caption matches Niimbot tokens, never VID 1a86.
 */
function chooseNiimbotTransport({ portName, printerName, resolvedCom, resolvedUsb }) {
  const explicitCom = extractComPort(portName, printerName);
  const usb =
    extractWindowsUsbPort(portName, printerName) ||
    (resolvedUsb ? String(resolvedUsb).trim() : "") ||
    "";
  const com = explicitCom || (resolvedCom ? String(resolvedCom).trim() : "") || "";
  const named = isNiimbotPrinterName(printerName);
  if (named && com) {
    return { mode: "com", comPort: com, usbPort: usb || null };
  }
  // Non-Niimbot queue (receipt/scale): keep USB-first so a guessed COM is not used.
  if (usb && !explicitCom && !named) {
    return { mode: "windows", comPort: null, usbPort: usb };
  }
  if (com) {
    return { mode: "com", comPort: com, usbPort: usb || null };
  }
  return { mode: "windows", comPort: null, usbPort: usb || null };
}

async function printNiimbotViaWindowsPrinter({ printerName, packets, printWindowsPacketsFn, writeMode }) {
  if (typeof printWindowsPacketsFn !== "function") {
    throw new Error("Niimbot Windows print requires Print Agent 1.10.2+.");
  }
  await printWindowsPacketsFn({
    printerName,
    packetsBase64: packets.map((p) => p.toString("base64")),
    writeMode: writeMode === "packets" ? "packets" : "concat",
  });
}

async function printNiimbotLabel(opts) {
  const {
    printerName,
    portName,
    bitmapBase64,
    widthPx,
    heightPx,
    density = 3,
    profile,
    testPattern,
    invertBitmap,
    usbWriteMode,
    printWindowsPacketsFn,
    printSerialFn,
    resolveComPortFn,
    resolveWindowsUsbPortFn,
  } = opts;
  const w = Number(widthPx);
  const h = Number(heightPx);
  if (!w || !h) throw new Error("Invalid Niimbot label dimensions");

  let bitmap;
  if (testPattern) {
    bitmap = buildTestPatternBitmap(w, h);
  } else {
    if (!bitmapBase64) throw new Error("bitmapBase64 is required");
    bitmap = Buffer.from(bitmapBase64, "base64");
    if (!bitmap.length) throw new Error("Invalid Niimbot label payload");
  }

  const knownUsb = extractWindowsUsbPort(portName, printerName);
  let resolvedCom = extractComPort(portName, printerName);
  if (!resolvedCom && typeof resolveComPortFn === "function") {
    resolvedCom = await resolveComPortFn(printerName, portName);
  }
  let resolvedUsb = knownUsb;
  if (!resolvedUsb && typeof resolveWindowsUsbPortFn === "function") {
    resolvedUsb = await resolveWindowsUsbPortFn(printerName, portName);
  }
  const transport = chooseNiimbotTransport({
    portName,
    printerName,
    resolvedCom,
    resolvedUsb,
  });

  const job = buildNiimbotJobPackets(bitmap, w, h, density, {
    printerName,
    portName,
    profile,
    transport: transport.mode,
    invertBitmap: invertBitmap === true,
  });
  bitmap = job.bitmap || bitmap;
  const name = String(printerName || "").trim();

  const printSerial = typeof printSerialFn === "function" ? printSerialFn : printNiimbotJobSerial;

  if (transport.mode === "com" && transport.comPort) {
    try {
      console.log(
        `[print-agent] Niimbot label via COM ${transport.comPort} profile=${job.profile} packets=${job.packets.length}`
      );
      await printSerial(transport.comPort, job);
      return {
        printer: transport.comPort,
        ...describeJob(bitmap, job.packets, job.profile, "com", { ...job, usbWriteMode: null }),
      };
    } catch (comErr) {
      if (!name || typeof printWindowsPacketsFn !== "function") throw comErr;
      console.warn(
        `[print-agent] Niimbot COM ${transport.comPort} failed, falling back to Windows USBPRINT:`,
        comErr && comErr.message
      );
    }
  }

  if (!name) {
    throw new Error(
      "No Niimbot label printer configured. Enable Labels on a printer profile in Settings → Receipts & printers."
    );
  }

  if (!printWindowsPacketsFn) {
    throw new Error(
      "Niimbot label printer needs Print Agent on Windows. Install agent 1.10.9+ and select the Niimbot/Niimbus queue in Settings → Receipts & printers."
    );
  }

  const usbPort = transport.usbPort;
  const pathLabel = usbPort ? `usb:${usbPort}` : "spooler";
  const writeMode = usbWriteMode === "packets" ? "packets" : "concat";
  console.log(
    `[print-agent] Niimbot label via Windows ${pathLabel} writeMode=${writeMode} -> '${name}' profile=${job.profile} packets=${job.packets.length} est=${estimateJobDelayMs(job.packets, "windows")}ms`
  );

  await printNiimbotViaWindowsPrinter({
    printerName: name,
    packets: job.packets,
    printWindowsPacketsFn,
    writeMode,
  });
  return {
    printer: name,
    ...describeJob(bitmap, job.packets, job.profile, pathLabel, { ...job, usbWriteMode: writeMode }),
  };
}

module.exports = {
  niimbotPacket,
  CONNECT_BYTES,
  WAKE_BYTES,
  PROTOCOL_PROFILES,
  isNiimbotPrinterName,
  detectNiimbotProfile,
  detectNiimbotProfileCandidates,
  alignBitmapCols,
  padBitmapToPrinthead,
  invertBitmap,
  buildNiimbotJobPackets,
  buildOfficialPacketExpectations,
  summarizePacketTypes,
  buildTestPatternBitmap,
  countPixelsForLine,
  lineBlackCounts,
  estimateJobDelayMs,
  packetDelayMs,
  isNiimbotPrintPayload(buf) {
    return Buffer.isBuffer(buf) && buf.length >= 2 && buf[0] === 0x55 && buf[1] === 0x55;
  },
  extractComPort,
  extractWindowsUsbPort,
  chooseNiimbotTransport,
  describeJob,
  describeSerialFailure,
  printNiimbotLabel,
};
