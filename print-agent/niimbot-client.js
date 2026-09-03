/**
 * Niimbot label printer protocol (K3 / B21 / D11 / B1).
 * Ported from https://github.com/AndBondStyle/niimprint
 */
const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const os = require("os");
const path = require("path");

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isComPort(name) {
  return /^COM\d+$/i.test(String(name || "").trim());
}

async function serialTransceive(port, packet, { readResponses = true } = {}) {
  const ps = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Ports
$port = New-Object System.IO.Ports.SerialPort '${port.replace(/'/g, "''")}',115200,'None',8,'One'
$port.ReadTimeout = 800
$port.WriteTimeout = 5000
$port.Open()
try {
  $bytes = [Convert]::FromBase64String('${packet.toString("base64")}')
  $port.Write($bytes, 0, $bytes.Length)
  if (${readResponses ? "$true" : "$false"}) {
    Start-Sleep -Milliseconds 60
    $buf = New-Object byte[] 512
    $read = 0
    try { $read = $port.Read($buf, 0, $buf.Length) } catch {}
    if ($read -gt 0) {
      [Convert]::ToBase64String($buf[0..($read-1)])
    }
  }
} finally { $port.Close() }
`;
  const { stdout } = await execFileAsync(
    "powershell.exe",
    ["-NoProfile", "-WindowStyle", "Hidden", "-ExecutionPolicy", "Bypass", "-Command", ps],
    { windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024 }
  );
  return String(stdout || "").trim();
}

async function transceive(transport, type, data, respOffset = 1) {
  const packet = niimbotPacket(type, data);
  if (transport.kind === "serial") {
    await serialTransceive(transport.port, packet);
    return true;
  }
  await transport.write(packet);
  if (transport.read) {
    for (let i = 0; i < 6; i++) {
      const resp = await transport.read(256);
      if (resp && resp.length >= 4 && resp[0] === 0x55 && resp[1] === 0x55) {
        const respType = resp[2];
        if (respType === type + respOffset || respType === 16 + type) return true;
      }
      await sleep(80);
    }
  } else {
    await sleep(60);
    return true;
  }
  return true;
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

async function printNiimbotBitmap({
  bitmap,
  widthPx,
  heightPx,
  density = 3,
  transport,
}) {
  const d = Math.min(5, Math.max(1, Number(density) || 3));
  await transceive(transport, RequestCode.SET_LABEL_DENSITY, Buffer.from([d]), 16);
  await transceive(transport, RequestCode.SET_LABEL_TYPE, Buffer.from([1]), 16);
  await transceive(transport, RequestCode.START_PRINT, Buffer.from([1]));
  await transceive(transport, RequestCode.START_PAGE_PRINT, Buffer.from([1]));
  const dim = Buffer.alloc(4);
  dim.writeUInt16BE(heightPx, 0);
  dim.writeUInt16BE(widthPx, 2);
  await transceive(transport, RequestCode.SET_DIMENSION, dim);
  const linePackets = encodeBitmapLines(bitmap, widthPx, heightPx);
  for (const pkt of linePackets) {
    if (transport.kind === "serial") {
      await serialTransceive(transport.port, pkt, { readResponses: false });
    } else {
      await transport.write(pkt);
      await sleep(12);
    }
  }
  await transceive(transport, RequestCode.END_PAGE_PRINT, Buffer.from([1]));
  await sleep(300);
  for (let i = 0; i < 30; i++) {
    const done = await transceive(transport, RequestCode.END_PRINT, Buffer.from([1]));
    if (done) break;
    await sleep(100);
  }
}

function createWriteOnlyTransport(writeFn) {
  return {
    kind: "write-only",
    write: writeFn,
    read: null,
  };
}

async function printNiimbotViaRawPrinter({ printerName, bitmap, widthPx, heightPx, density, printRawFn }) {
  const packets = [];
  const collect = (type, data, respOffset = 1) => {
    packets.push({ type, data: Buffer.from(data), respOffset });
  };
  const d = Math.min(5, Math.max(1, Number(density) || 3));
  collect(RequestCode.SET_LABEL_DENSITY, [d], 16);
  collect(RequestCode.SET_LABEL_TYPE, [1], 16);
  collect(RequestCode.START_PRINT, [1]);
  collect(RequestCode.START_PAGE_PRINT, [1]);
  const dim = Buffer.alloc(4);
  dim.writeUInt16BE(heightPx, 0);
  dim.writeUInt16BE(widthPx, 2);
  collect(RequestCode.SET_DIMENSION, dim);
  const linePackets = encodeBitmapLines(bitmap, widthPx, heightPx);
  const all = [
    ...packets.map((p) => niimbotPacket(p.type, p.data)),
    ...linePackets,
    niimbotPacket(RequestCode.END_PAGE_PRINT, Buffer.from([1])),
    niimbotPacket(RequestCode.END_PRINT, Buffer.from([1])),
  ];
  for (const pkt of all) {
    await printRawFn({
      printerName,
      dataBase64: pkt.toString("base64"),
    });
    await sleep(40);
  }
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
  } = opts;
  const bitmap = Buffer.from(bitmapBase64, "base64");
  const w = Number(widthPx);
  const h = Number(heightPx);
  if (!bitmap.length || !w || !h) throw new Error("Invalid Niimbot label payload");

  const port = String(portName || printerName || "").trim();
  if (isComPort(port)) {
    const transport = { kind: "serial", port: port.toUpperCase() };
    await printNiimbotBitmap({ bitmap, widthPx: w, heightPx: h, density, transport });
    return port;
  }

  if (!printRawFn) throw new Error("Niimbot printer requires COM port or print agent raw handler");
  await printNiimbotViaRawPrinter({
    printerName: printerName || port,
    bitmap,
    widthPx: w,
    heightPx: h,
    density,
    printRawFn,
  });
  return printerName || port;
}

module.exports = {
  niimbotPacket,
  isNiimbotPrintPayload(buf) {
    return Buffer.isBuffer(buf) && buf.length >= 2 && buf[0] === 0x55 && buf[1] === 0x55;
  },
  printNiimbotLabel,
};
