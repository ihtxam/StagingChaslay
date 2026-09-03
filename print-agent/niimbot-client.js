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
};

/** Wake bytes before framed packets — official NIIMBOT.exe sends 0x54 0x01. */
const WAKE_BYTES = Buffer.from([0x54, 0x01]);

/**
 * K3 USB captures (niimprint #30) use 1-byte START_PRINT + 4-byte SET_DIMENSION.
 * B21 official app uses 2-byte START + 6-byte dimension (#30, #49).
 * B1 uses 7-byte START + 6-byte dimension.
 */
const PROTOCOL_PROFILES = {
  k3: {
    startPrint: [1],
    dimensionBytes(widthPx, heightPx) {
      const dim = Buffer.alloc(4);
      dim.writeUInt16BE(heightPx, 0);
      dim.writeUInt16BE(widthPx, 2);
      return dim;
    },
    statusPollCount: 8,
    printheadPixels: 384,
  },
  b21: {
    startPrint: [0, 1],
    dimensionBytes(widthPx, heightPx) {
      const dim = Buffer.alloc(6);
      dim.writeUInt16BE(heightPx, 0);
      dim.writeUInt16BE(widthPx, 2);
      dim.writeUInt16BE(1, 4);
      return dim;
    },
    statusPollCount: 10,
    printheadPixels: 384,
  },
  b1: {
    startPrint: [0, 1, 0, 0, 0, 0, 0],
    dimensionBytes(widthPx, heightPx) {
      const dim = Buffer.alloc(6);
      dim.writeUInt16BE(heightPx, 0);
      dim.writeUInt16BE(widthPx, 2);
      dim.writeUInt16BE(1, 4);
      return dim;
    },
    statusPollCount: 10,
    printheadPixels: 384,
  },
};

function niimbotPacket(type, data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
  const len = buf.length;
  let checksum = type ^ len;
  for (let i = 0; i < len; i++) checksum ^= buf[i];
  return Buffer.concat([Buffer.from([0x55, 0x55, type, len]), buf, Buffer.from([checksum, 0xaa, 0xaa])]);
}

function detectNiimbotProfile(printerName, portName, explicit) {
  const want = String(explicit || "").trim().toLowerCase();
  if (want && PROTOCOL_PROFILES[want]) return want;
  const blob = `${printerName || ""} ${portName || ""}`.toLowerCase();
  if (/\bk3\b|k3w|b3s/.test(blob)) return "k3";
  if (/\bb1\b/.test(blob)) return "b1";
  if (/\bb21\b|\bd11\b|\bd110\b/.test(blob)) return "b21";
  // Default K3 — most Windows USB005 installs are K3; B21 users can pass profile=b21.
  return "k3";
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

function encodeBitmapLines(bitmap, widthPx, heightPx, printheadPixels) {
  const rowBytes = Math.ceil(widthPx / 8);
  const packets = [];
  for (let y = 0; y < heightPx; y++) {
    const rowStart = y * rowBytes;
    const lineData = bitmap.subarray(rowStart, rowStart + rowBytes);
    const counts = countPixelsForLine(lineData, printheadPixels);
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

function buildNiimbotJobPackets(bitmap, widthPx, heightPx, density = 3, options = {}) {
  const profileName = detectNiimbotProfile(
    options.printerName,
    options.portName,
    options.profile
  );
  const profile = PROTOCOL_PROFILES[profileName];
  const d = Math.min(5, Math.max(1, Number(density) || 3));
  const packets = [];
  const push = (type, data) => packets.push(niimbotPacket(type, Buffer.from(data)));

  push(RequestCode.SET_LABEL_DENSITY, [d]);
  push(RequestCode.SET_LABEL_TYPE, [1]);
  push(RequestCode.START_PRINT, profile.startPrint);
  push(RequestCode.START_PAGE_PRINT, [1]);
  push(RequestCode.SET_DIMENSION, profile.dimensionBytes(widthPx, heightPx));
  packets.push(...encodeBitmapLines(bitmap, widthPx, heightPx, profile.printheadPixels));
  push(RequestCode.END_PAGE_PRINT, [1]);
  packets.push(...buildStatusPollPackets(profile.statusPollCount));
  push(RequestCode.END_PRINT, [1]);

  return { packets, profile: profileName };
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

function packetDelayMs(packet) {
  if (!packet || packet.length < 3) return 80;
  const type = packet[2];
  if (type === 0x85) return 12;
  if (type === RequestCode.GET_PRINT_STATUS) return 150;
  if (type === RequestCode.END_PAGE_PRINT || type === RequestCode.END_PRINT) return 250;
  return 80;
}

function describeJob(bitmap, packets, profile, path) {
  const nonZero = bitmap ? [...bitmap].filter((b) => b !== 0).length : 0;
  const first = packets[0];
  return {
    path,
    profile,
    packetCount: packets.length,
    bitmapBytes: bitmap ? bitmap.length : 0,
    bitmapNonZeroBytes: nonZero,
    wakeHex: WAKE_BYTES.toString("hex"),
    firstPacketHex: first ? first.subarray(0, Math.min(16, first.length)).toString("hex") : "",
    rasterLines: packets.filter((p) => p[2] === 0x85).length,
  };
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
  $wake = [byte[]](0x54, 0x01)
  $port.Write($wake, 0, $wake.Length)
  Start-Sleep -Milliseconds 120
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
    elseif ($type -in 0xE3, 0xF3) { $delay = 250 }
    Start-Sleep -Milliseconds $delay
    if ($type -eq 0xA3) {
      $buf = New-Object byte[] 64
      try { [void]$port.Read($buf, 0, $buf.Length) } catch { }
    }
  }
  Start-Sleep -Milliseconds 600
} finally {
  if ($port.IsOpen) { $port.Close() }
  $port.Dispose()
}
`;
  await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-Command", ps],
    { windowsHide: true, timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }
  );
}

async function printNiimbotViaWindowsPrinter({ printerName, packets, printWindowsPacketsFn }) {
  if (typeof printWindowsPacketsFn !== "function") {
    throw new Error("Niimbot Windows print requires Print Agent 1.10.1+.");
  }
  await printWindowsPacketsFn({
    printerName,
    packetsBase64: packets.map((p) => p.toString("base64")),
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
    printWindowsPacketsFn,
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

  const job = buildNiimbotJobPackets(bitmap, w, h, density, {
    printerName,
    portName,
    profile,
  });

  // Always prefer COM serial when discoverable — USB005 WritePrinter is fallback only.
  let comPort = extractComPort(portName, printerName);
  if (!comPort && typeof resolveComPortFn === "function") {
    comPort = await resolveComPortFn(printerName, portName);
  }

  if (comPort) {
    console.log(
      `[print-agent] Niimbot label via COM ${comPort} profile=${job.profile} packets=${job.packets.length}`
    );
    await printNiimbotJobSerial(comPort, job);
    return { printer: comPort, ...describeJob(bitmap, job.packets, job.profile, "com") };
  }

  const name = String(printerName || "").trim();
  if (!name) {
    throw new Error(
      "No Niimbot label printer configured. Enable Labels on a printer profile in Settings → Receipts & printers."
    );
  }

  if (!printWindowsPacketsFn) {
    throw new Error(
      "Niimbot label printer needs Print Agent on Windows. Install agent 1.10.1+ and select NIIMBOT K3 in Settings → Receipts & printers."
    );
  }

  let usbPort = extractWindowsUsbPort(portName);
  if (!usbPort && typeof resolveWindowsUsbPortFn === "function") {
    usbPort = await resolveWindowsUsbPortFn(printerName, portName);
  }

  const pathLabel = usbPort ? `usb:${usbPort}` : "spooler";
  console.log(
    `[print-agent] Niimbot label via Windows ${pathLabel} -> '${name}' profile=${job.profile} packets=${job.packets.length}`
  );

  await printNiimbotViaWindowsPrinter({
    printerName: name,
    packets: job.packets,
    printWindowsPacketsFn,
  });
  return { printer: name, ...describeJob(bitmap, job.packets, job.profile, pathLabel) };
}

module.exports = {
  niimbotPacket,
  WAKE_BYTES,
  PROTOCOL_PROFILES,
  detectNiimbotProfile,
  buildNiimbotJobPackets,
  buildTestPatternBitmap,
  countPixelsForLine,
  isNiimbotPrintPayload(buf) {
    return Buffer.isBuffer(buf) && buf.length >= 2 && buf[0] === 0x55 && buf[1] === 0x55;
  },
  extractComPort,
  extractWindowsUsbPort,
  packetDelayMs,
  describeJob,
  printNiimbotLabel,
};
