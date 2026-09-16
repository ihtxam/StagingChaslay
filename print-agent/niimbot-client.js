/**
 * Niimbot label printer protocol (K3 / B21 / D11 / B1).
 * Ported from https://github.com/AndBondStyle/niimprint
 * Protocol variants per https://printers.niim.blue/interfacing/proto/
 *
 * K3 notes (the only open reference implementation that covers it is
 * https://github.com/MarkusOderSo/niimgo):
 *  - The K3 exposes both a CDC-ACM serial interface and a USB printer-class
 *    interface, and the Niimbot protocol only answers on the printer-class one
 *    (/dev/usb/lp* on Linux, the USBnnn queue on Windows).
 *  - Its printhead is 80 mm at 203 dpi = 640 dots, not the 384 of the B21/D11.
 */
const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
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
    printheadPixels: 640,
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

/**
 * PrintBitmapRow (0x85). The three black-pixel-count bytes are left at zero:
 * the protocol reference states the printer works correctly with 0x00/0x00/0x00,
 * and both reference implementations that drive a K3 (niimgo) or a B21 over SPP
 * (our own Android bridge) send zeros. Chunked counts additionally depend on the
 * exact printhead width, which is a further way to get the row rejected.
 */
function encodeBitmapLines(bitmap, widthPx, heightPx) {
  const rowBytes = Math.ceil(widthPx / 8);
  const packets = [];
  for (let y = 0; y < heightPx; y++) {
    const rowStart = y * rowBytes;
    const lineData = bitmap.subarray(rowStart, rowStart + rowBytes);
    const header = Buffer.alloc(6);
    header.writeUInt16BE(y, 0);
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
  packets.push(...encodeBitmapLines(bitmap, widthPx, heightPx));
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

function describeJob(bitmap, packets, profile, path, rowBytes) {
  const nonZero = bitmap ? [...bitmap].filter((b) => b !== 0).length : 0;
  const first = packets[0];
  const dim = packets.find((p) => p[2] === RequestCode.SET_DIMENSION);
  return {
    path,
    profile,
    packetCount: packets.length,
    bitmapBytes: bitmap ? bitmap.length : 0,
    bitmapNonZeroBytes: nonZero,
    firstPacketHex: first ? first.subarray(0, Math.min(16, first.length)).toString("hex") : "",
    dimensionHex: dim ? dim.subarray(4, 4 + dim[3]).toString("hex") : "",
    rasterLines: packets.filter((p) => p[2] === 0x85).length,
    rasterRowBytes: rowBytes,
  };
}

/**
 * Exit codes the serial script uses instead of formatting a message itself.
 * Everything the user reads is built here in Node from the script's stderr.
 * Interpolating the exception into a PowerShell string leaked literal script
 * source into the UI in two separate builds, so the real reason a COM port
 * refused to open was never visible. See the P0 tests in test/niimbot.test.mjs.
 */
const SERIAL_EXIT = {
  OPEN_FAILED: 20,
  WRITE_FAILED: 21,
  MISSING_PAYLOAD: 22,
};

/** Bauds tried in order. Windows Bluetooth SPP ignores the rate; USB CDC wants 115200. */
const SERIAL_BAUDS = [115200, 9600, 19200];

/**
 * PowerShell for one serial print attempt.
 *
 * Rules for every script in this file, enforced by
 * `print-agent/test/niimbot.test.mjs`:
 *  - `$_` never appears inside a double-quoted PowerShell string.
 *  - The exception text goes to stderr verbatim, via `[Console]::Error.WriteLine`.
 *  - Values come in as `param()` arguments, never string-interpolated from JS.
 */
function buildSerialJobScript() {
  return `param(
  [Parameter(Mandatory = $true)][string]$PortPath,
  [Parameter(Mandatory = $true)][int]$Baud,
  [Parameter(Mandatory = $true)][string]$PayloadFile
)

$ErrorActionPreference = 'Stop'

function Write-RawError {
  param([System.Management.Automation.ErrorRecord]$Record)
  try {
    [Console]::Error.WriteLine($Record.Exception.Message)
  } catch {
    [Console]::Error.WriteLine('unknown serial error')
  }
}

if (-not (Test-Path -LiteralPath $PayloadFile)) {
  [Console]::Error.WriteLine('payload file missing')
  exit ${SERIAL_EXIT.MISSING_PAYLOAD}
}

Add-Type -AssemblyName System.IO.Ports

$port = New-Object System.IO.Ports.SerialPort $PortPath, $Baud, 'None', 8, 'One'
$port.ReadTimeout = 500
$port.WriteTimeout = 15000

try {
  $port.Open()
} catch {
  Write-RawError $_
  exit ${SERIAL_EXIT.OPEN_FAILED}
}

try {
  $lines = [System.IO.File]::ReadAllLines($PayloadFile) | Where-Object { $_ -and $_.Trim() }
  foreach ($line in $lines) {
    $bytes = [Convert]::FromBase64String($line.Trim())
    $port.Write($bytes, 0, $bytes.Length)
    $type = if ($bytes.Length -ge 3) { [int]$bytes[2] } else { 0 }
    $delay = 80
    if ($type -eq 0x85) { $delay = 12 }
    elseif ($type -eq 0xA3) { $delay = 150 }
    elseif ($type -in 0xE3, 0xF3) { $delay = 250 }
    Start-Sleep -Milliseconds $delay
    if ($type -in 0xA3, 0xE3, 0xF3) {
      $buf = New-Object byte[] 64
      try { [void]$port.Read($buf, 0, $buf.Length) } catch { }
    }
  }
  Start-Sleep -Milliseconds 600
} catch {
  Write-RawError $_
  exit ${SERIAL_EXIT.WRITE_FAILED}
} finally {
  try {
    if ($port.IsOpen) { $port.Close() }
    $port.Dispose()
  } catch { }
}

exit 0
`;
}

/**
 * Runs PowerShell from a temp .ps1 with `-File`. Passing a multi-line script
 * through `-Command` is what mangled the quoting in earlier builds.
 */
async function runPowerShellSource(source, args, options = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reborn-niimbot-ps-"));
  const scriptPath = path.join(dir, options.scriptName || "script.ps1");
  fs.writeFileSync(scriptPath, `\uFEFF${source}`, "utf8");
  try {
    return await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle",
        "Hidden",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        ...args,
      ],
      {
        windowsHide: true,
        timeout: options.timeout || 30000,
        maxBuffer: options.maxBuffer || 8 * 1024 * 1024,
        encoding: "utf8",
      }
    );
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* temp dir cleanup is best effort */
    }
  }
}

/**
 * First non-empty stderr line — the raw .NET exception message, nothing else.
 * PowerShell wraps exceptions thrown inside a method call as
 * `Exception calling "Open" with "0" argument(s): "<real message>"`; the wrapper
 * is stripped so the merchant reads the actual reason.
 */
function rawSerialError(error) {
  const stderr = String((error && error.stderr) || "");
  for (const line of stderr.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    const unwrapped = text.match(
      /^Exception calling "[^"]*" with "[^"]*" argument\(s\): "(.*)"$/
    );
    return (unwrapped ? unwrapped[1] : text).slice(0, 300);
  }
  return "";
}

/**
 * Turns a failed serial attempt into text a merchant can act on. The raw .NET
 * message is always appended so the real cause is visible even when we have no
 * rule for it.
 */
function describeSerialFailure(comPort, error, baud) {
  const label = String(comPort || "COM").toUpperCase();
  const at = baud ? ` at ${baud} baud` : "";
  if (error && (error.killed || error.code === "ETIMEDOUT")) {
    return `Niimbot ${label} timed out${at}`;
  }
  const raw = rawSerialError(error);
  const detail = raw ? ` — ${raw}` : "";
  if (/access to the port|access is denied|UnauthorizedAccess/i.test(raw)) {
    return `Niimbot ${label} is already open${at}. Close NIIMBOT.exe (and any other app holding the port), then retry.${detail}`;
  }
  if (/does not exist|FileNotFoundException|could not find|cannot find the (file|port)/i.test(raw)) {
    return `Niimbot ${label} does not exist on this PC${at}. Run "Diagnose Niimbot ports" and pick a port from the list.${detail}`;
  }
  if (/semaphore timeout|device attached to the system is not functioning|The I\/O operation/i.test(raw)) {
    return `Niimbot ${label} did not answer${at}. This is what a Bluetooth incoming/unconnected port does — connect the printer in Windows Bluetooth settings and use its outgoing port.${detail}`;
  }
  if (!raw) {
    return `Niimbot ${label} serial write failed${at}`;
  }
  return `Niimbot ${label} failed${at}${detail}`;
}

/** One open+write attempt at one baud. Throws with the real reason attached. */
async function printNiimbotJobSerialAtBaud(comPort, job, baud) {
  const portPath = normalizeComPort(comPort);
  const { packets } = job;
  const timeoutMs = Math.min(180000, Math.max(45000, 12000 + packets.length * 50));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reborn-niimbot-job-"));
  const payloadFile = path.join(dir, "packets.txt");
  fs.writeFileSync(payloadFile, packets.map((p) => p.toString("base64")).join("\n"), "utf8");
  try {
    await runPowerShellSource(
      buildSerialJobScript(),
      ["-PortPath", portPath, "-Baud", String(baud), "-PayloadFile", payloadFile],
      { scriptName: "niimbot-serial.ps1", timeout: timeoutMs }
    );
  } catch (error) {
    const failure = new Error(describeSerialFailure(comPort, error, baud));
    failure.rawError = rawSerialError(error);
    failure.baud = baud;
    throw failure;
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* temp dir cleanup is best effort */
    }
  }
}

/** Tries each baud in turn; reports every real failure if none open. */
async function printNiimbotJobSerial(comPort, job) {
  const failures = [];
  for (const baud of SERIAL_BAUDS) {
    try {
      await printNiimbotJobSerialAtBaud(comPort, job, baud);
      return { baud };
    } catch (error) {
      failures.push(error);
      const raw = String((error && error.rawError) || "");
      // A port that is held by another app or absent will not open at any baud.
      if (/access to the port|access is denied|does not exist|could not find/i.test(raw)) break;
    }
  }
  const first = failures[0];
  const error = new Error(first ? first.message : `Niimbot ${comPort} serial write failed`);
  error.attempts = failures.map((f) => ({ baud: f.baud, error: f.rawError || f.message }));
  throw error;
}

/**
 * Enumerates every serial port and print queue on the machine and tries to open
 * each COM port at each baud, reporting the real exception per attempt. Emits
 * JSON on stdout and never throws — a merchant runs this from one button.
 */
function buildComProbeScript() {
  return `param(
  [string]$Bauds = '115200,9600,19200'
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch { }

function Reason {
  param([System.Management.Automation.ErrorRecord]$Record)
  try {
    return [string]$Record.Exception.Message
  } catch {
    return 'unknown error'
  }
}

try {
  Add-Type -AssemblyName System.IO.Ports -ErrorAction SilentlyContinue
} catch { }

$ports = @{}

function Add-PortRow {
  param([string]$Name, [string]$Caption, [string]$Pnp, [string]$Source)
  if ([string]::IsNullOrWhiteSpace($Name)) { return }
  $key = $Name.ToUpperInvariant()
  if (-not $ports.ContainsKey($key)) {
    $ports[$key] = [PSCustomObject]@{
      port = $key
      caption = ''
      pnpDeviceId = ''
      sources = @()
      opens = @()
    }
  }
  $row = $ports[$key]
  if ([string]::IsNullOrWhiteSpace($row.caption) -and -not [string]::IsNullOrWhiteSpace($Caption)) {
    $row.caption = $Caption
  }
  if ([string]::IsNullOrWhiteSpace($row.pnpDeviceId) -and -not [string]::IsNullOrWhiteSpace($Pnp)) {
    $row.pnpDeviceId = $Pnp
  }
  if ($row.sources -notcontains $Source) { $row.sources += $Source }
}

$errors = @()

try {
  [System.IO.Ports.SerialPort]::GetPortNames() | ForEach-Object {
    Add-PortRow -Name $_ -Caption '' -Pnp '' -Source 'GetPortNames'
  }
} catch {
  $errors += ('GetPortNames: ' + (Reason $_))
}

try {
  Get-CimInstance -ClassName Win32_SerialPort -ErrorAction Stop | ForEach-Object {
    Add-PortRow -Name ([string]$_.DeviceID) -Caption ([string]$_.Caption) -Pnp ([string]$_.PNPDeviceID) -Source 'Win32_SerialPort'
  }
} catch {
  $errors += ('Win32_SerialPort: ' + (Reason $_))
}

try {
  Get-PnpDevice -Class Ports -ErrorAction Stop | ForEach-Object {
    $friendly = [string]$_.FriendlyName
    if ($friendly -match '\\((COM\\d+)\\)') {
      Add-PortRow -Name $Matches[1] -Caption $friendly -Pnp ([string]$_.InstanceId) -Source ('Get-PnpDevice/' + [string]$_.Status)
    }
  }
} catch {
  $errors += ('Get-PnpDevice: ' + (Reason $_))
}

$bauds = @()
foreach ($b in ($Bauds -split ',')) {
  $trimmed = $b.Trim()
  if ($trimmed) { $bauds += [int]$trimmed }
}

foreach ($key in @($ports.Keys)) {
  $row = $ports[$key]
  $path = $row.port
  if ($path -match '^COM(\\d+)$' -and [int]$Matches[1] -ge 10) {
    $path = '\\\\.\\' + $row.port
  }
  foreach ($baud in $bauds) {
    $attempt = [PSCustomObject]@{ baud = $baud; opened = $false; error = '' }
    $sp = $null
    try {
      $sp = New-Object System.IO.Ports.SerialPort $path, $baud, 'None', 8, 'One'
      $sp.ReadTimeout = 400
      $sp.WriteTimeout = 1500
      $sp.Open()
      $attempt.opened = $true
    } catch {
      $attempt.error = Reason $_
    } finally {
      try {
        if ($sp -and $sp.IsOpen) { $sp.Close() }
        if ($sp) { $sp.Dispose() }
      } catch { }
    }
    $row.opens += $attempt
  }
}

$printers = @()
try {
  Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop | ForEach-Object {
    $printers += [PSCustomObject]@{
      name = [string]$_.Name
      port = [string]$_.PortName
      driver = [string]$_.DriverName
      offline = [bool]$_.WorkOffline
      status = [string]$_.PrinterStatus
    }
  }
} catch {
  $errors += ('Win32_Printer: ' + (Reason $_))
}

$bluetooth = @()
try {
  Get-PnpDevice -Class Bluetooth -ErrorAction Stop | ForEach-Object {
    $bluetooth += [PSCustomObject]@{
      name = [string]$_.FriendlyName
      status = [string]$_.Status
      instanceId = [string]$_.InstanceId
    }
  }
} catch {
  $errors += ('Get-PnpDevice Bluetooth: ' + (Reason $_))
}

$result = [PSCustomObject]@{
  ports = @($ports.Values | Sort-Object port)
  printers = @($printers)
  bluetooth = @($bluetooth)
  errors = @($errors)
}

$result | ConvertTo-Json -Depth 6 -Compress
exit 0
`;
}

/**
 * The device interface USBPRINT.SYS publishes for every USB printer-class
 * device. Opening it with CreateFile talks straight to the same bulk pipes the
 * spooler uses, but without the spooler, the print processor or the vendor
 * driver in the way — and unlike the spooler it can be read from.
 *
 * This is the Windows equivalent of /dev/usb/lp0, which is the transport niimgo
 * requires for the K3: "The K3 printer exposes both a CDC-ACM serial interface
 * and a USB printer interface. The Niimbot protocol only works over the USB
 * printer interface."
 *
 * GUID from https://blog.peter.skarpetis.com/archives/2005/04/07/getting-a-handle-on-usbprintsys/
 */
const USBPRINT_INTERFACE_GUID = "28d78fad-5a12-11d1-ae5b-0000f803a8c2";

/**
 * Enumerates USBPRINT devices, and optionally writes packets to one and reads
 * whatever it answers. Reads are bounded and only happen in probe mode, so a
 * silent printer can never hang a print job.
 */
function buildUsbDeviceScript() {
  return `param(
  [string]$Mode = 'list',
  [string]$DevicePath = '',
  [string]$PayloadFile = '',
  [int]$ReadTimeoutMs = 1500,
  [int]$LineDelayMs = 8
)

$ErrorActionPreference = 'Stop'

function Write-RawError {
  param([System.Management.Automation.ErrorRecord]$Record)
  try {
    [Console]::Error.WriteLine($Record.Exception.Message)
  } catch {
    [Console]::Error.WriteLine('unknown usb device error')
  }
}

$signature = @'
using System;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;

public static class NiimbotUsbDevice {
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern SafeFileHandle CreateFileW(
    string lpFileName, uint dwDesiredAccess, uint dwShareMode, IntPtr lpSecurityAttributes,
    uint dwCreationDisposition, uint dwFlagsAndAttributes, IntPtr hTemplateFile);
}
'@

try {
  Add-Type -TypeDefinition $signature -ErrorAction Stop
} catch {
  Write-RawError $_
  exit 30
}

# Build the interface path from the PnP instance id, e.g.
# USB\\VID_3513&PID_0002\\5&abcd&0&2  ->
# \\\\?\\usb#vid_3513&pid_0002#5&abcd&0&2#{28d78fad-...}
function Get-InterfacePath {
  param([string]$InstanceId)
  $slug = $InstanceId.ToLowerInvariant().Replace('\\', '#')
  return ('\\\\?\\' + $slug + '#{${USBPRINT_INTERFACE_GUID}}')
}

function Get-ReasonText {
  param([System.Management.Automation.ErrorRecord]$Record)
  try {
    return [string]$Record.Exception.Message
  } catch {
    return 'unknown error'
  }
}

function Get-UsbPrintDevices {
  $rows = @()
  try {
    Get-PnpDevice -PresentOnly -ErrorAction Stop |
      Where-Object { $_.Service -eq 'usbprint' } |
      ForEach-Object {
        $rows += [PSCustomObject]@{
          name = [string]$_.FriendlyName
          instanceId = [string]$_.InstanceId
          status = [string]$_.Status
          devicePath = Get-InterfacePath ([string]$_.InstanceId)
        }
      }
  } catch {
    [Console]::Error.WriteLine((Get-ReasonText $_))
  }
  return $rows
}

# GENERIC_READ | GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE, OPEN_EXISTING
function Open-UsbPrintDevice {
  param([string]$Path)
  $handle = [NiimbotUsbDevice]::CreateFileW($Path, 0xC0000000, 3, [IntPtr]::Zero, 3, 0x40000000, [IntPtr]::Zero)
  if ($handle.IsInvalid) {
    $code = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    $handle.Dispose()
    throw (New-Object System.ComponentModel.Win32Exception $code)
  }
  return $handle
}

if ($Mode -eq 'list') {
  $devices = Get-UsbPrintDevices
  foreach ($device in $devices) {
    $probe = [PSCustomObject]@{ opened = $false; error = '' }
    $handle = $null
    try {
      $handle = Open-UsbPrintDevice $device.devicePath
      $probe.opened = $true
    } catch {
      $probe.error = Get-ReasonText $_
    } finally {
      try { if ($handle) { $handle.Dispose() } } catch { }
    }
    $device | Add-Member -NotePropertyName open -NotePropertyValue $probe
  }
  @{ guid = '${USBPRINT_INTERFACE_GUID}'; devices = @($devices) } | ConvertTo-Json -Depth 6 -Compress
  exit 0
}

if ([string]::IsNullOrWhiteSpace($DevicePath)) {
  $devices = Get-UsbPrintDevices
  if ($devices.Count -lt 1) {
    [Console]::Error.WriteLine('no USBPRINT device interface present')
    exit 31
  }
  $DevicePath = $devices[0].devicePath
}

if (-not (Test-Path -LiteralPath $PayloadFile)) {
  [Console]::Error.WriteLine('payload file missing')
  exit 22
}

$handle = $null
try {
  $handle = Open-UsbPrintDevice $DevicePath
} catch {
  Write-RawError $_
  exit 32
}

$stream = $null
$written = 0
$replies = @()
try {
  $stream = New-Object System.IO.FileStream $handle, ([System.IO.FileAccess]::ReadWrite), 4096, $true
  $lines = [System.IO.File]::ReadAllLines($PayloadFile) | Where-Object { $_ -and $_.Trim() }
  foreach ($line in $lines) {
    $bytes = [Convert]::FromBase64String($line.Trim())
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
    $written += $bytes.Length
    $type = if ($bytes.Length -ge 3) { [int]$bytes[2] } else { 0 }
    if ($type -eq 0x85) {
      Start-Sleep -Milliseconds $LineDelayMs
    } else {
      Start-Sleep -Milliseconds 60
    }
    # Bounded read only for the commands that acknowledge, so a silent printer
    # cannot stall the job.
    if ($type -in 0x21, 0x23, 0x01, 0x03, 0x13, 0xA3, 0xE3, 0xF3) {
      $buffer = New-Object byte[] 64
      try {
        $task = $stream.ReadAsync($buffer, 0, $buffer.Length)
        if ($task.Wait($ReadTimeoutMs)) {
          $count = $task.Result
          if ($count -gt 0) {
            $hex = ($buffer[0..($count - 1)] | ForEach-Object { $_.ToString('x2') }) -join ''
            $replies += [PSCustomObject]@{ afterType = $type; hex = $hex }
          }
        }
      } catch { }
    }
  }
  Start-Sleep -Milliseconds 400
} catch {
  Write-RawError $_
  exit 33
} finally {
  try { if ($stream) { $stream.Dispose() } } catch { }
  try { if ($handle -and -not $handle.IsClosed) { $handle.Dispose() } } catch { }
}

@{ devicePath = $DevicePath; bytesWritten = $written; replies = @($replies) } |
  ConvertTo-Json -Depth 5 -Compress
exit 0
`;
}

const NIIMBOT_NAME_RE = /niimbot|niimbus|\bk3\b|k3w|\bb21\b|\bb1\b|\bb18\b|\bb31\b|\bd11\b|\bd110\b/i;

/** Classifies one probed COM port and explains, in plain language, what to do. */
function classifyProbedPort(row) {
  const blob = `${row.port || ""} ${row.caption || ""} ${row.pnpDeviceId || ""}`;
  const opens = Array.isArray(row.opens) ? row.opens : [];
  const openedBauds = opens.filter((o) => o && o.opened).map((o) => o.baud);
  const errors = opens.map((o) => String((o && o.error) || "")).filter(Boolean);
  const allErrors = errors.join(" | ");
  const isBluetooth = /bthenum|bluetooth/i.test(blob);
  const incoming = isBluetooth && /LOCALMFG|_LOCALMFG/i.test(String(row.pnpDeviceId || ""));
  const looksNiimbot = NIIMBOT_NAME_RE.test(blob);
  const looksScale = /ch340|ch341|usb-serial ch|1a86/i.test(blob) && !looksNiimbot;

  let verdict;
  if (openedBauds.length) {
    verdict = "opened";
  } else if (/access to the port|access is denied/i.test(allErrors)) {
    verdict = "busy";
  } else if (/does not exist|could not find|cannot find/i.test(allErrors)) {
    verdict = "missing";
  } else if (/semaphore timeout|not functioning|I\/O operation/i.test(allErrors)) {
    verdict = "not-connected";
  } else {
    verdict = errors.length ? "failed" : "unknown";
  }

  const advice = [];
  if (verdict === "opened" && looksNiimbot) {
    advice.push("Usable. Set this port on the Niimbot printer profile.");
  } else if (verdict === "opened" && looksScale) {
    advice.push("This is the CH340 scale, not the printer. Do not use it for labels.");
  } else if (verdict === "opened") {
    advice.push("Opens, but the name does not identify a Niimbot. Try it only if you know it is the printer.");
  } else if (verdict === "busy") {
    advice.push("Held by another program. Close NIIMBOT.exe and any label software, then retry.");
  } else if (verdict === "missing") {
    advice.push("Windows no longer has this port. Clear it from the printer profile.");
  } else if (verdict === "not-connected") {
    advice.push(
      incoming
        ? "Bluetooth incoming port: Windows cannot send on it. Use the outgoing port for the printer."
        : "The port exists but nothing answered. Connect the printer in Windows Bluetooth settings, then retry."
    );
  }
  if (incoming) advice.push("Marked as a Bluetooth incoming/local port.");

  return {
    port: row.port,
    caption: row.caption || "",
    pnpDeviceId: row.pnpDeviceId || "",
    sources: Array.isArray(row.sources) ? row.sources : [],
    opens,
    openedBauds,
    verdict,
    isBluetooth,
    bluetoothIncoming: incoming,
    looksNiimbot,
    looksScale,
    advice,
  };
}

/** Renders the probe as text a merchant can screenshot in one shot. */
function formatComProbeReport(probe) {
  const lines = [];
  lines.push(`Niimbot port diagnosis — ${probe.generatedAt}`);
  lines.push(`Print Agent ${probe.agentVersion || "?"} on ${probe.platform}`);
  lines.push("");

  if (!probe.supported) {
    lines.push("COM port diagnosis only runs on Windows.");
    return lines.join("\n");
  }
  if (probe.error) {
    lines.push(`Probe could not run: ${probe.error}`);
    return lines.join("\n");
  }

  if (!probe.ports.length) {
    lines.push("SERIAL PORTS: none. Windows has no COM port at all, so there is");
    lines.push("nothing to print to over Bluetooth or USB serial. Pair and connect");
    lines.push("the printer in Windows Bluetooth settings first.");
  } else {
    lines.push(`SERIAL PORTS (${probe.ports.length}):`);
    for (const p of probe.ports) {
      lines.push("");
      lines.push(`  ${p.port} — ${p.caption || "no name"}`);
      if (p.pnpDeviceId) lines.push(`    device: ${p.pnpDeviceId}`);
      lines.push(
        `    looks like: ${p.looksNiimbot ? "Niimbot printer" : p.looksScale ? "CH340 scale" : "unknown device"}${p.isBluetooth ? " (bluetooth)" : ""}`
      );
      for (const attempt of p.opens) {
        lines.push(
          `    open @ ${attempt.baud}: ${attempt.opened ? "OK" : `FAILED — ${attempt.error || "no reason reported"}`}`
        );
      }
      for (const tip of p.advice) lines.push(`    -> ${tip}`);
    }
  }

  lines.push("");
  if (probe.printers.length) {
    lines.push(`PRINT QUEUES (${probe.printers.length}):`);
    for (const q of probe.printers) {
      const flag = NIIMBOT_NAME_RE.test(`${q.name} ${q.driver}`) ? "  <= label printer" : "";
      lines.push(`  ${q.name} | port=${q.port} | driver=${q.driver}${q.offline ? " | OFFLINE" : ""}${flag}`);
    }
  } else {
    lines.push("PRINT QUEUES: none reported.");
  }

  lines.push("");
  const usbDevices = probe.usbPrintDevices || [];
  if (usbDevices.length) {
    lines.push(`USB PRINTER-CLASS INTERFACES (${usbDevices.length}):`);
    for (const d of usbDevices) {
      lines.push(`  ${d.name || "unnamed"} — ${d.status || "?"}`);
      lines.push(`    ${d.devicePath}`);
      const open = d.open || {};
      lines.push(
        `    direct open: ${open.opened ? "OK — the printer can be driven without the spooler" : `FAILED — ${open.error || "no reason reported"}`}`
      );
    }
  } else {
    lines.push("USB PRINTER-CLASS INTERFACES: none found.");
    if (probe.usbPrintError) lines.push(`  probe error: ${probe.usbPrintError}`);
  }

  if (probe.bluetooth.length) {
    lines.push("");
    lines.push(`BLUETOOTH DEVICES (${probe.bluetooth.length}):`);
    for (const b of probe.bluetooth) lines.push(`  ${b.name} — ${b.status}`);
  }

  if (probe.warnings.length) {
    lines.push("");
    lines.push("PROBE WARNINGS:");
    for (const w of probe.warnings) lines.push(`  ${w}`);
  }

  lines.push("");
  lines.push("WHAT THIS MEANS:");
  for (const line of probe.summary) lines.push(`  ${line}`);
  return lines.join("\n");
}

/** Plain-language conclusion drawn from the probed ports and queues. */
function summarizeComProbe(ports, printers, usbDevices = []) {
  const summary = [];
  const usable = ports.filter((p) => p.verdict === "opened" && !p.looksScale);
  const niimbotQueues = printers.filter((q) => NIIMBOT_NAME_RE.test(`${q.name} ${q.driver}`));
  const usbQueues = niimbotQueues.filter((q) => /^USB\d+$/i.test(String(q.port || "")));

  if (usable.length) {
    summary.push(
      `COM port(s) that opened and are not the scale: ${usable.map((p) => `${p.port} @ ${p.openedBauds.join("/")}`).join(", ")}.`
    );
    summary.push("Set one of these as the Port on the Niimbot printer profile and print a test label.");
  } else if (ports.length) {
    summary.push(
      "No COM port that could be the printer opened, so Bluetooth serial printing cannot work until the reason listed above is fixed."
    );
  } else {
    summary.push("No COM port exists. Connect the printer over Bluetooth to get one.");
  }

  if (usbQueues.length) {
    summary.push(
      `The label printer is also installed as a Windows print queue on ${usbQueues.map((q) => q.port).join(", ")}.`
    );
    summary.push(
      "That queue is write-only: the standard USB port monitor is not bidirectional, so the Niimbot protocol never gets its replies and a job can be accepted in full and still print nothing."
    );
  }

  const openable = usbDevices.filter((d) => d && d.open && d.open.opened);
  if (openable.length) {
    summary.push(
      "The USB printer-class interface can be opened directly, so the agent drives the printer without the spooler and can read its replies. This is the transport the K3 reference implementation requires."
    );
  } else if (usbDevices.length) {
    summary.push(
      "The USB printer-class interface exists but could not be opened; the reason is listed above. Close NIIMBOT.exe and retry."
    );
  }
  return summary;
}

async function probeNiimbotComPorts(options = {}) {
  const base = {
    ok: true,
    supported: process.platform === "win32",
    platform: process.platform,
    agentVersion: options.agentVersion || null,
    generatedAt: new Date().toISOString(),
    ports: [],
    printers: [],
    bluetooth: [],
    usbPrintDevices: [],
    usbPrintError: null,
    usbPrintGuid: USBPRINT_INTERFACE_GUID,
    warnings: [],
    summary: [],
    error: null,
  };
  if (!base.supported) {
    base.summary = ["Windows is required for COM port diagnosis."];
    base.text = formatComProbeReport(base);
    return base;
  }
  try {
    const { stdout } = await runPowerShellSource(
      buildComProbeScript(),
      ["-Bauds", (options.bauds || SERIAL_BAUDS).join(",")],
      { scriptName: "niimbot-com-probe.ps1", timeout: options.timeout || 90000 }
    );
    const raw = String(stdout || "").trim().replace(/^\uFEFF/, "");
    const parsed = raw ? JSON.parse(raw) : {};
    const portRows = Array.isArray(parsed.ports) ? parsed.ports : parsed.ports ? [parsed.ports] : [];
    base.ports = portRows.map(classifyProbedPort);
    const printerRows = Array.isArray(parsed.printers)
      ? parsed.printers
      : parsed.printers
        ? [parsed.printers]
        : [];
    base.printers = printerRows.map((q) => ({
      name: String(q.name || ""),
      port: String(q.port || ""),
      driver: String(q.driver || ""),
      offline: Boolean(q.offline),
      status: String(q.status || ""),
    }));
    const btRows = Array.isArray(parsed.bluetooth)
      ? parsed.bluetooth
      : parsed.bluetooth
        ? [parsed.bluetooth]
        : [];
    base.bluetooth = btRows.map((b) => ({
      name: String(b.name || ""),
      status: String(b.status || ""),
      instanceId: String(b.instanceId || ""),
    }));
    base.warnings = (Array.isArray(parsed.errors) ? parsed.errors : []).map(String).filter(Boolean);
    const usb = await listUsbPrintDevices({ timeout: 30000 });
    base.usbPrintDevices = usb.devices;
    base.usbPrintError = usb.error;
    base.usbPrintGuid = USBPRINT_INTERFACE_GUID;
    base.summary = summarizeComProbe(base.ports, base.printers, base.usbPrintDevices);
  } catch (error) {
    base.ok = false;
    base.error = rawSerialError(error) || String((error && error.message) || error);
    base.summary = ["The diagnosis itself failed. The reason is shown above."];
  }
  base.text = formatComProbeReport(base);
  return base;
}

/**
 * USBPRINT (USB005) K3 must not be hijacked by a guessed COM port.
 * CH340 scales share VID 1a86; only use COM when the printer/port actually names COMx.
 */
function chooseNiimbotTransport({ portName, printerName, resolvedCom, resolvedUsb }) {
  const explicitCom = extractComPort(portName, printerName);
  const usb =
    extractWindowsUsbPort(portName, printerName) ||
    (resolvedUsb ? String(resolvedUsb).trim() : "") ||
    "";
  const com = explicitCom || (resolvedCom ? String(resolvedCom).trim() : "") || "";
  if (usb && !explicitCom) {
    return { mode: "windows", comPort: null, usbPort: usb };
  }
  if (com) {
    return { mode: "com", comPort: com, usbPort: usb || null };
  }
  return { mode: "windows", comPort: null, usbPort: usb || null };
}

/** Lists USBPRINT device interfaces and whether each one can be opened. */
async function listUsbPrintDevices(options = {}) {
  if (process.platform !== "win32") return { supported: false, devices: [], error: null };
  try {
    const { stdout } = await runPowerShellSource(buildUsbDeviceScript(), ["-Mode", "list"], {
      scriptName: "niimbot-usbdev.ps1",
      timeout: options.timeout || 30000,
    });
    const raw = String(stdout || "").trim().replace(/^\uFEFF/, "");
    const parsed = raw ? JSON.parse(raw) : {};
    const rows = Array.isArray(parsed.devices) ? parsed.devices : parsed.devices ? [parsed.devices] : [];
    return { supported: true, devices: rows, error: null };
  } catch (error) {
    return { supported: true, devices: [], error: rawSerialError(error) || String(error.message || error) };
  }
}

/**
 * Writes the job straight to the USBPRINT device interface, bypassing the
 * spooler, and collects whatever the printer answers. Replies are the only
 * proof we can get on Windows that the printer parsed our frames.
 */
async function printNiimbotViaUsbDevice(job, options = {}) {
  const { packets } = job;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reborn-niimbot-usbdev-"));
  const payloadFile = path.join(dir, "packets.txt");
  fs.writeFileSync(payloadFile, packets.map((p) => p.toString("base64")).join("\n"), "utf8");
  const timeoutMs = Math.min(180000, Math.max(45000, 15000 + packets.length * 60));
  try {
    const args = ["-Mode", "print", "-PayloadFile", payloadFile];
    if (options.devicePath) args.push("-DevicePath", options.devicePath);
    const { stdout } = await runPowerShellSource(buildUsbDeviceScript(), args, {
      scriptName: "niimbot-usbdev.ps1",
      timeout: timeoutMs,
    });
    const raw = String(stdout || "").trim().replace(/^\uFEFF/, "");
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      devicePath: String(parsed.devicePath || ""),
      bytesWritten: Number(parsed.bytesWritten || 0),
      replies: Array.isArray(parsed.replies) ? parsed.replies : parsed.replies ? [parsed.replies] : [],
    };
  } finally {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* temp dir cleanup is best effort */
    }
  }
}

async function printNiimbotViaWindowsPrinter({ printerName, packets, printWindowsPacketsFn }) {
  if (typeof printWindowsPacketsFn !== "function") {
    throw new Error("Niimbot Windows print requires Print Agent 1.10.2+.");
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
    invertBitmap,
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
  if (invertBitmap) {
    bitmap = Buffer.from(bitmap.map((b) => b ^ 0xff));
  }

  const rowBytes = Math.ceil(w / 8);
  const job = buildNiimbotJobPackets(bitmap, w, h, density, {
    printerName,
    portName,
    profile,
  });

  let resolvedCom = extractComPort(portName, printerName);
  if (!resolvedCom && typeof resolveComPortFn === "function") {
    resolvedCom = await resolveComPortFn(printerName, portName);
  }
  let resolvedUsb = extractWindowsUsbPort(portName, printerName);
  if (!resolvedUsb && typeof resolveWindowsUsbPortFn === "function") {
    resolvedUsb = await resolveWindowsUsbPortFn(printerName, portName);
  }
  const transport = chooseNiimbotTransport({
    portName,
    printerName,
    resolvedCom,
    resolvedUsb,
  });
  const name = String(printerName || "").trim();

  if (transport.mode === "com" && transport.comPort) {
    try {
      console.log(
        `[print-agent] Niimbot label via COM ${transport.comPort} profile=${job.profile} packets=${job.packets.length}`
      );
      const serial = await printNiimbotJobSerial(transport.comPort, job);
      return {
        printer: transport.comPort,
        baud: serial && serial.baud,
        ...describeJob(bitmap, job.packets, job.profile, "com", rowBytes),
      };
    } catch (comErr) {
      if (!name || typeof printWindowsPacketsFn !== "function") throw comErr;
      console.warn(
        `[print-agent] Niimbot COM ${transport.comPort} failed, falling back to Windows:`,
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
      "Niimbot label printer needs Print Agent on Windows. Install agent 1.10.2+ and select NIIMBOT K3 in Settings → Receipts & printers."
    );
  }

  const usbPort = transport.usbPort;
  const pathLabel = usbPort ? `usb:${usbPort}` : "spooler";

  /*
   * Prefer the USBPRINT device interface over the spooler queue. It reaches the
   * same bulk pipes without the spooler, the print processor or the vendor
   * driver, and it is the only Windows transport that can read the printer's
   * replies — the standard USB port monitor is not bidirectional, so a spooler
   * job can be accepted in full and still print nothing.
   */
  if (usbPort && opts.directUsb !== false) {
    try {
      const direct = await printNiimbotViaUsbDevice(job, { devicePath: opts.usbDevicePath });
      const acked = direct.replies.length > 0;
      console.log(
        `[print-agent] Niimbot label via USBPRINT device bytes=${direct.bytesWritten} replies=${direct.replies.length} path=${direct.devicePath}`
      );
      return {
        printer: name,
        ...describeJob(bitmap, job.packets, job.profile, "usbdev", rowBytes),
        devicePath: direct.devicePath,
        bytesWritten: direct.bytesWritten,
        replies: direct.replies,
        unconfirmed: !acked,
        warning: acked
          ? ""
          : "Bytes went straight to the printer's USB interface but it never answered. The printer is not parsing these frames — use the Android Print Bridge over Bluetooth, which is the sequence the K3 reference implementation uses.",
      };
    } catch (directErr) {
      console.warn(
        "[print-agent] Niimbot USBPRINT device path failed, falling back to spooler:",
        directErr && directErr.message
      );
    }
  }

  console.log(
    `[print-agent] Niimbot label via Windows ${pathLabel} -> '${name}' profile=${job.profile} packets=${job.packets.length}`
  );

  await printNiimbotViaWindowsPrinter({
    printerName: name,
    packets: job.packets,
    printWindowsPacketsFn,
  });
  const diag = describeJob(bitmap, job.packets, job.profile, pathLabel, rowBytes);
  return {
    printer: name,
    ...diag,
    unconfirmed: true,
    warning: describeSpoolerUncertainty(usbPort, name, diag),
  };
}

/**
 * The Windows print queue accepts the job and reports success as soon as the
 * spooler has the bytes. It cannot tell us whether the printhead fired, and it
 * cannot read the printer's replies at all, so we must not claim the label
 * printed — whichever queue the job went to.
 */
function describeSpoolerUncertainty(usbPort, printerName, diag) {
  const queue = usbPort ? `${String(usbPort).toUpperCase()} spooler queue` : "Windows print queue";
  return [
    `Job sent to the ${queue} on '${printerName}' — Windows accepted it, but this queue cannot confirm the label printed.`,
    "If nothing came out, this queue does not pass Niimbot data through. Use a Bluetooth COM port or the Android Print Bridge.",
    `Fingerprint: profile=${diag.profile} packets=${diag.packetCount} rasterLines=${diag.rasterLines} inkBytes=${diag.bitmapNonZeroBytes} dim=${diag.dimensionHex}`,
  ].join(" ");
}

module.exports = {
  niimbotPacket,
  PROTOCOL_PROFILES,
  SERIAL_BAUDS,
  SERIAL_EXIT,
  detectNiimbotProfile,
  buildNiimbotJobPackets,
  buildTestPatternBitmap,
  buildSerialJobScript,
  buildComProbeScript,
  buildUsbDeviceScript,
  USBPRINT_INTERFACE_GUID,
  countPixelsForLine,
  isNiimbotPrintPayload(buf) {
    return Buffer.isBuffer(buf) && buf.length >= 2 && buf[0] === 0x55 && buf[1] === 0x55;
  },
  extractComPort,
  extractWindowsUsbPort,
  chooseNiimbotTransport,
  classifyProbedPort,
  formatComProbeReport,
  summarizeComProbe,
  probeNiimbotComPorts,
  listUsbPrintDevices,
  printNiimbotViaUsbDevice,
  packetDelayMs,
  describeJob,
  describeSerialFailure,
  describeSpoolerUncertainty,
  rawSerialError,
  printNiimbotLabel,
};
