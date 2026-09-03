/**
 * Niimbot label printer protocol (K3 / B21 / D11 / B1).
 * Ported from https://github.com/AndBondStyle/niimprint
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
};

function niimbotPacket(type, data) {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
  const len = buf.length;
  let checksum = type ^ len;
  for (let i = 0; i < len; i++) checksum ^= buf[i];
  return Buffer.concat([Buffer.from([0x55, 0x55, type, len]), buf, Buffer.from([checksum, 0xaa, 0xaa])]);
}

function isComPort(name) {
  return /^COM\d+$/i.test(String(name || "").trim());
}

/** Windows spooler USB port (e.g. USB005) — use WritePrinter, not SerialPort. */
function isWindowsUsbPort(name) {
  return /^USB\d+$/i.test(String(name || "").trim());
}

/** Extract COM port from strings like "Niimbot K3 (COM7)" or "COM7". */
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

/** Windows COM10+ needs \\.\COM10 prefix for SerialPort. */
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

function encodeBitmapLines(bitmap, widthPx, heightPx) {
  const rowBytes = Math.ceil(widthPx / 8);
  const packets = [];
  for (let y = 0; y < heightPx; y++) {
    const rowStart = y * rowBytes;
    const lineData = bitmap.subarray(rowStart, rowStart + rowBytes);
    const header = Buffer.alloc(6);
    header.writeUInt16BE(y, 0);
    header[2] = 0;
    header[3] = 0;
    header[4] = 0;
    header[5] = 1;
    packets.push(niimbotPacket(0x85, Buffer.concat([header, lineData])));
  }
  return packets;
}

function buildNiimbotJobPackets(bitmap, widthPx, heightPx, density = 3) {
  const d = Math.min(5, Math.max(1, Number(density) || 3));
  const packets = [];
  const push = (type, data) => packets.push(niimbotPacket(type, Buffer.from(data)));
  push(RequestCode.SET_LABEL_DENSITY, [d]);
  push(RequestCode.SET_LABEL_TYPE, [1]);
  // K3/B21 official app uses 2-byte START_PRINT (copy count = 1).
  push(RequestCode.START_PRINT, [0, 1]);
  push(RequestCode.START_PAGE_PRINT, [1]);
  // 6-byte dimension (h, w, mode=1) per Niimbot Windows app captures.
  const dim = Buffer.alloc(6);
  dim.writeUInt16BE(heightPx, 0);
  dim.writeUInt16BE(widthPx, 2);
  dim.writeUInt16BE(1, 4);
  push(RequestCode.SET_DIMENSION, dim);
  packets.push(...encodeBitmapLines(bitmap, widthPx, heightPx));
  push(RequestCode.END_PAGE_PRINT, [1]);
  push(RequestCode.END_PRINT, [1]);
  return packets;
}

function concatJobPackets(bitmap, widthPx, heightPx, density) {
  return Buffer.concat(buildNiimbotJobPackets(bitmap, widthPx, heightPx, density));
}

/**
 * Send a full Niimbot label job over one serial session (open port once).
 */
async function printNiimbotJobSerial(comPort, { bitmap, widthPx, heightPx, density = 3 }) {
  const port = normalizeComPort(comPort);
  const packets = buildNiimbotJobPackets(bitmap, widthPx, heightPx, density);
  const payloadB64 = packets.map((p) => p.toString("base64")).join("\n");
  const lineDelayMs = 12;
  const timeoutMs = Math.min(180000, Math.max(45000, 8000 + packets.length * (lineDelayMs + 40)));

  const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Ports
$port = New-Object System.IO.Ports.SerialPort '${port.replace(/'/g, "''")}',115200,'None',8,'One'
$port.ReadTimeout = 400
$port.WriteTimeout = 15000
$port.Open()
try {
  $lines = @'
${payloadB64}
'@ -split "\\n" | Where-Object { $_ -and $_.Trim() }
  foreach ($line in $lines) {
    $bytes = [Convert]::FromBase64String($line.Trim())
    $port.Write($bytes, 0, $bytes.Length)
    Start-Sleep -Milliseconds ${lineDelayMs}
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

/** Windows USB00x spooler port — one RAW job with all protocol bytes concatenated. */
async function printNiimbotViaWindowsPrinter({ printerName, bitmap, widthPx, heightPx, density, printRawFn }) {
  const combined = concatJobPackets(bitmap, widthPx, heightPx, density);
  await printRawFn({
    printerName,
    dataBase64: combined.toString("base64"),
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
    printRawFn,
    resolveComPortFn,
    resolveWindowsUsbPortFn,
  } = opts;
  const bitmap = Buffer.from(bitmapBase64, "base64");
  const w = Number(widthPx);
  const h = Number(heightPx);
  if (!bitmap.length || !w || !h) throw new Error("Invalid Niimbot label payload");

  let comPort = extractComPort(portName, printerName);
  if (!comPort && typeof resolveComPortFn === "function") {
    comPort = await resolveComPortFn(printerName, portName);
  }

  if (comPort) {
    await printNiimbotJobSerial(comPort, { bitmap, widthPx: w, heightPx: h, density });
    return comPort;
  }

  let usbPort = extractWindowsUsbPort(portName);
  if (!usbPort && typeof resolveWindowsUsbPortFn === "function") {
    usbPort = await resolveWindowsUsbPortFn(printerName, portName);
  }

  const name = String(printerName || "").trim();
  if (!name) {
    throw new Error(
      "No Niimbot label printer configured. Enable Labels on a printer profile in Settings → Receipts & printers."
    );
  }

  if (!printRawFn) {
    throw new Error(
      "Niimbot label printer needs Print Agent on Windows. Install agent 1.9.9+ and select NIIMBOT K3 in Settings → Receipts & printers."
    );
  }

  if (usbPort) {
    console.log(`[print-agent] Niimbot label via Windows USB port ${usbPort} -> '${name}'`);
  } else {
    console.log(`[print-agent] Niimbot label via Windows printer '${name}' (port ${portName || "unknown"})`);
  }

  await printNiimbotViaWindowsPrinter({
    printerName: name,
    bitmap,
    widthPx: w,
    heightPx: h,
    density,
    printRawFn,
  });
  return name;
}

module.exports = {
  niimbotPacket,
  isNiimbotPrintPayload(buf) {
    return Buffer.isBuffer(buf) && buf.length >= 2 && buf[0] === 0x55 && buf[1] === 0x55;
  },
  extractComPort,
  extractWindowsUsbPort,
  buildNiimbotJobPackets,
  printNiimbotLabel,
};
