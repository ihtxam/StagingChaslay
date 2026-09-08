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

/**
 * Reply command id for each request, per
 * https://printers.niim.blue/interfacing/proto/. Every setup command answers,
 * raster rows (0x85) do not. A transport that cannot read these back can never
 * tell a printed label from a blank one, which is why the spooler queue is
 * useless here and the serial path validates every one of them.
 */
const RESPONSE_CODE = {
  [RequestCode.SET_LABEL_DENSITY]: 0x31,
  [RequestCode.SET_LABEL_TYPE]: 0x33,
  [RequestCode.START_PRINT]: 0x02,
  [RequestCode.START_PAGE_PRINT]: 0x04,
  [RequestCode.SET_DIMENSION]: 0x14,
  [RequestCode.END_PAGE_PRINT]: 0xe4,
  [RequestCode.END_PRINT]: 0xf4,
  [RequestCode.GET_PRINT_STATUS]: 0xb3,
};

/** The one reply that proves a label came out: PrintEnd (0xf4) answering 01. */
const PRINT_END_DONE = 0x01;

/**
 * The job as a sequence of steps, each with the reply the printer owes us.
 * `buildNiimbotJobPackets` flattens this for the write-only transports.
 */
function buildNiimbotJobSteps(bitmap, widthPx, heightPx, density = 3, options = {}) {
  const profileName = detectNiimbotProfile(
    options.printerName,
    options.portName,
    options.profile
  );
  const profile = PROTOCOL_PROFILES[profileName];
  const d = Math.min(5, Math.max(1, Number(density) || 3));
  const step = (name, type, data, until = -1) => ({
    name,
    type,
    expect: RESPONSE_CODE[type] ?? -1,
    until,
    packet: niimbotPacket(type, Buffer.from(data)),
  });

  const steps = [
    step("SetDensity", RequestCode.SET_LABEL_DENSITY, [d]),
    step("SetLabelType", RequestCode.SET_LABEL_TYPE, [1]),
    step("PrintStart", RequestCode.START_PRINT, profile.startPrint),
    step("PageStart", RequestCode.START_PAGE_PRINT, [1]),
    step("SetPageSize", RequestCode.SET_DIMENSION, profile.dimensionBytes(widthPx, heightPx)),
  ];
  for (const packet of encodeBitmapLines(bitmap, widthPx, heightPx)) {
    steps.push({ name: "Row", type: 0x85, expect: -1, until: -1, packet });
  }
  steps.push(step("PageEnd", RequestCode.END_PAGE_PRINT, [1]));
  steps.push(step("PrintEnd", RequestCode.END_PRINT, [1], PRINT_END_DONE));
  return { steps, profile: profileName };
}

function buildNiimbotJobPackets(bitmap, widthPx, heightPx, density = 3, options = {}) {
  const { steps, profile } = buildNiimbotJobSteps(bitmap, widthPx, heightPx, density, options);
  const packets = [];
  for (const step of steps) {
    // The write-only transports cannot read a status reply, but the polls give
    // the printer the same pacing before END_PRINT that the official app uses.
    if (step.type === RequestCode.END_PRINT) {
      packets.push(...buildStatusPollPackets(PROTOCOL_PROFILES[profile].statusPollCount));
    }
    packets.push(step.packet);
  }
  return { packets, profile };
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
  return /^COM\d+:?$/i.test(String(name || "").trim());
}

function isWindowsUsbPort(name) {
  return /^USB\d+$/i.test(String(name || "").trim());
}

/**
 * The COM port named anywhere in these values, canonicalised to the bare `COMn`
 * name .NET accepts — see `normalizeComPort`.
 */
function extractComPort(...values) {
  for (const raw of values) {
    const text = String(raw || "").trim();
    if (!text) continue;
    const direct = normalizeComPort(text);
    if (direct) return direct;
    const paren = text.match(/\((COM\d+)\)/i);
    if (paren) return normalizeComPort(paren[1]);
    const inline = text.match(/\b(COM\d+)\b/i);
    if (inline) return normalizeComPort(inline[1]);
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

/**
 * The port name `System.IO.Ports.SerialPort` will accept, or "" when the value
 * is not a Windows serial port name at all.
 *
 * .NET is stricter here than CreateFile, and the difference between the two is
 * this whole bug. `SerialStream`'s constructor rejects any name that does not
 * begin with "COM" (dotnet/runtime, SerialStream.Windows.cs) and the `PortName`
 * setter rejects any name beginning with a backslash, so the `\\.\COM12` form
 * that CreateFile *requires* for two-digit ports is exactly what SerialPort
 * refuses — with
 *   "The given port name does not start with COM/com or does not resolve to a
 *    valid serial port."
 * which is the exception a French till reported against 1.10.14. SerialPort
 * builds the `\\.\` prefix itself, for every port number, so the bare COMn name
 * is the only correct thing to hand it. Until now every port above COM9 got
 * `\\.\COMnn` and could therefore never open, and the probe reported all of
 * them as failed.
 *
 * Accepts every spelling Windows hands us: `COM8`, `com8`, `COM8:` (the form
 * `Win32_Printer.PortName` uses), `\\.\COM8`, and any of those padded.
 */
function normalizeComPort(port) {
  const raw = String(port == null ? "" : port).trim();
  if (!raw) return "";
  const m = raw
    .replace(/^\\\\[.?]\\/, "")
    .replace(/:+$/, "")
    .trim()
    .match(/^com0*(\d{1,4})$/i);
  if (!m) return "";
  const num = Number(m[1]);
  if (!num) return "";
  return `COM${num}`;
}

/**
 * Why a port name cannot be opened, said before .NET gets a chance to say it
 * badly. An empty or malformed name reaching `SerialPort` throws the same
 * opaque ArgumentException as a port that has gone away, so an unset port and a
 * dead printer were indistinguishable in the toast.
 */
function describeComPortNameProblem(port) {
  const raw = String(port == null ? "" : port).trim();
  if (!raw) {
    return 'No serial port is set for the Niimbot. Select a COM port on the printer profile in Settings → Receipts & printers, or run "Diagnose Niimbot ports" to find it.';
  }
  return `'${raw}' is not a Windows serial port name. Windows serial ports are named COM1, COM2, COM3 … — set one on the printer profile, or run "Diagnose Niimbot ports" to see which ports this PC has.`;
}

/**
 * The remote Bluetooth device address carried by a PnP instance id.
 *
 * An outgoing SPP port's id ends in the paired device's address
 * (`...&0&001A7DDA7113_C00000000`) and the Bluetooth device itself is
 * `BTHENUM\DEV_001A7DDA7113\...`, so the two can be tied together even after
 * the print queue that named the printer has been deleted. The SPP service GUID
 * contains a 12-hex run of its own (`00805f9b34fb`), which is why braced
 * sections are dropped first.
 */
function bluetoothAddressOf(instanceId) {
  const text = String(instanceId || "").replace(/\{[^}]*\}/g, " ");
  const found = text.match(/(?<![0-9a-z])[0-9a-f]{12}(?![0-9a-f])/gi) || [];
  return found.length ? found[found.length - 1].toUpperCase() : "";
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
  BAD_PORT_NAME: 23,
};

/**
 * Bauds tried in order. 115200 is the rate every Niimbot reference
 * implementation uses and the only one the printer's UART is clocked for; a
 * Windows serial print port defaults to 9600, which is why correct frames
 * relayed by the spooler arrive as garbage (beep, feed, blank label).
 * The others are only retried when 115200 produced no reply at all.
 */
const SERIAL_BAUDS = [115200, 9600, 19200];

/** Tab-separated payload columns: name, expected reply id, terminator, packet. */
const SERIAL_PAYLOAD_SEPARATOR = "\t";

/**
 * PowerShell for one serial print attempt: writes every step and reads the
 * reply frame the protocol owes us, so the result is proof rather than hope.
 *
 * Rules for every script in this file, enforced by
 * `print-agent/test/niimbot.test.mjs`:
 *  - `$_` never appears inside a double-quoted PowerShell string.
 *  - The exception text goes to stderr verbatim, via `[Console]::Error.WriteLine`.
 *  - Values come in as `param()` arguments, never string-interpolated from JS.
 */
function buildSerialJobScript() {
  return `param(
  # AllowEmptyString so that an empty name is answered by the check below with a
  # reason and exit ${SERIAL_EXIT.BAD_PORT_NAME}, instead of PowerShell's own
  # "Cannot bind argument to parameter 'PortPath'" landing in the merchant's toast.
  [Parameter(Mandatory = $true)][AllowEmptyString()][string]$PortPath,
  [Parameter(Mandatory = $true)][int]$Baud,
  [Parameter(Mandatory = $true)][string]$PayloadFile,
  [string]$PortName = '',
  [int]$ReadTimeoutMs = 2000,
  [int]$EndRetries = 12,
  [int]$RowDelayMs = 4
)

$ErrorActionPreference = 'Stop'

# Without this a non-English Windows writes its exception text in the console
# code page while Node decodes the pipe as UTF-8, so a French till's reason came
# back as mojibake: unreadable for the merchant and unmatchable for the agent.
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch { }

# PowerShell wraps anything thrown inside a .NET method call in a
# MethodInvocationException whose own message is the *localized*
# 'Exception calling "Open" with "0" argument(s): "<the real reason>"'. Peeling
# off PowerShell's own layers leaves .NET's exception, in every locale, with no
# wrapper to strip.
#
# Only PowerShell's layers: GetBaseException() would keep going and throw away
# .NET's own classification — an UnauthorizedAccessException carrying
# "Access to the port 'COM8' is denied." reduces to its inner
# "No such file or directory", which names neither the port nor the cause.
function Get-DotNetException {
  param($Exception)
  $ex = $Exception
  while ($null -ne $ex -and $null -ne $ex.InnerException) {
    $name = ''
    try { $name = [string]$ex.GetType().FullName } catch { $name = '' }
    if (-not $name.StartsWith('System.Management.Automation')) { break }
    $ex = $ex.InnerException
  }
  return $ex
}

function Get-ErrorText {
  param([System.Management.Automation.ErrorRecord]$Record)
  try {
    $ex = $Record.Exception
    if ($null -eq $ex) { return 'unknown serial error' }
    $real = Get-DotNetException $ex
    if ($null -eq $real) { $real = $ex }
    $text = [string]$real.Message
    if ([string]::IsNullOrWhiteSpace($text)) { $text = [string]$ex.Message }
    if ([string]::IsNullOrWhiteSpace($text)) { return 'unknown serial error' }
    return $text
  } catch {
    return 'unknown serial error'
  }
}

# The .NET type name, which is identical in every locale. Both reasons a port
# name is refused arrive as ArgumentException and their text is translated, so
# the type is what the agent classifies on.
function Get-ErrorType {
  param([System.Management.Automation.ErrorRecord]$Record)
  try {
    $ex = $Record.Exception
    if ($null -eq $ex) { return 'unknown' }
    $real = Get-DotNetException $ex
    if ($null -eq $real) { $real = $ex }
    return [string]$real.GetType().FullName
  } catch {
    return 'unknown'
  }
}

function Write-RawError {
  param([System.Management.Automation.ErrorRecord]$Record)
  [Console]::Error.WriteLine((Get-ErrorText $Record))
  [Console]::Error.WriteLine('type: ' + (Get-ErrorType $Record))
}

# The ports Windows has right now. A name Windows has dropped and a name that
# still resolves to something which is not a serial device throw the *same*
# ArgumentException, so this list is the only thing that tells them apart.
function Get-AvailablePortNames {
  try {
    $names = [System.IO.Ports.SerialPort]::GetPortNames()
    if ($null -eq $names) { return '' }
    return (($names | Sort-Object) -join ',')
  } catch {
    return ''
  }
}

function Get-HexString {
  param([byte[]]$Bytes)
  if ($null -eq $Bytes -or $Bytes.Length -lt 1) { return '' }
  return [BitConverter]::ToString($Bytes).Replace('-', '').ToLowerInvariant()
}

# 55 55 CMD LEN DATA... CHK AA AA
function Split-NiimbotFrame {
  param([byte[]]$Bytes)
  if ($null -eq $Bytes) { return $null }
  for ($i = 0; $i -lt $Bytes.Length - 6; $i++) {
    if ($Bytes[$i] -ne 0x55 -or $Bytes[$i + 1] -ne 0x55) { continue }
    $len = [int]$Bytes[$i + 3]
    $last = $i + 6 + $len
    if ($last -ge $Bytes.Length) { continue }
    if ($Bytes[$last - 1] -ne 0xAA -or $Bytes[$last] -ne 0xAA) { continue }
    $data = New-Object byte[] $len
    if ($len -gt 0) { [Array]::Copy($Bytes, $i + 4, $data, 0, $len) }
    return [PSCustomObject]@{
      cmd = [int]$Bytes[$i + 2]
      dataHex = Get-HexString $data
    }
  }
  return $null
}

function Read-NiimbotFrame {
  param([System.IO.Ports.SerialPort]$Port, [int]$TimeoutMs)
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMs)
  $seen = New-Object System.Collections.Generic.List[byte]
  while ([DateTime]::UtcNow -lt $deadline) {
    $available = 0
    try { $available = [int]$Port.BytesToRead } catch { $available = 0 }
    if ($available -lt 1) {
      Start-Sleep -Milliseconds 10
      continue
    }
    $chunk = New-Object byte[] $available
    $got = 0
    try { $got = $Port.Read($chunk, 0, $available) } catch { $got = 0 }
    for ($i = 0; $i -lt $got; $i++) { $seen.Add($chunk[$i]) }
    $frame = Split-NiimbotFrame $seen.ToArray()
    if ($null -ne $frame) {
      $frame | Add-Member -NotePropertyName rawHex -NotePropertyValue (Get-HexString $seen.ToArray())
      return $frame
    }
  }
  return [PSCustomObject]@{
    cmd = -1
    dataHex = ''
    rawHex = Get-HexString $seen.ToArray()
  }
}

# What Windows itself would use on this port. The spooler relays bytes at this
# rate, so a 9600 here with a 115200 printer is the whole bug in one line.
# WMI only: "mode COMx" opens the port, which can block for seconds on an
# unconnected Bluetooth SPP port, and this runs on the print path.
function Get-OsConfiguredBaud {
  param([string]$Name)
  if ([string]::IsNullOrWhiteSpace($Name)) { return '' }
  try {
    $cfg = Get-CimInstance -ClassName Win32_SerialPortConfiguration -ErrorAction Stop |
      Where-Object { [string]$_.Name -eq $Name } |
      Select-Object -First 1
    if ($null -ne $cfg -and $cfg.BaudRate) {
      return ([string]$cfg.BaudRate + ' baud (Win32_SerialPortConfiguration ' + [string]$cfg.StringSelector + ')')
    }
  } catch { }
  return ''
}

if (-not (Test-Path -LiteralPath $PayloadFile)) {
  [Console]::Error.WriteLine('payload file missing')
  exit ${SERIAL_EXIT.MISSING_PAYLOAD}
}

# PowerShell 5.1 has SerialPort in System.dll and no System.IO.Ports assembly to
# load, so an unguarded Add-Type is a terminating error on every Windows till
# that has not been upgraded to PowerShell 7.
try { Add-Type -AssemblyName System.IO.Ports -ErrorAction SilentlyContinue } catch { }

$available = Get-AvailablePortNames

# SerialPort only accepts a bare COMn name, so anything else is caught here and
# named plainly rather than coming back as .NET's ArgumentException, which says
# the same thing for a blank setting, a device path and a port that is gone.
if ([string]::IsNullOrWhiteSpace($PortPath)) {
  [Console]::Error.WriteLine('no serial port name was given')
  [Console]::Error.WriteLine('ports: ' + $available)
  exit ${SERIAL_EXIT.BAD_PORT_NAME}
}
if ($PortPath -notmatch '^COM\\d+$') {
  [Console]::Error.WriteLine('not a serial port name: ' + $PortPath)
  [Console]::Error.WriteLine('ports: ' + $available)
  exit ${SERIAL_EXIT.BAD_PORT_NAME}
}

$osBaud = Get-OsConfiguredBaud $PortName

$port = $null
try {
  $port = New-Object System.IO.Ports.SerialPort $PortPath, $Baud, 'None', 8, 'One'
  $port.Handshake = 'None'
  $port.DtrEnable = $true
  $port.RtsEnable = $true
  $port.ReadTimeout = 400
  $port.WriteTimeout = 15000
  $port.Open()
} catch {
  Write-RawError $_
  [Console]::Error.WriteLine('ports: ' + $available)
  [Console]::Error.WriteLine('os-configured: ' + $osBaud)
  exit ${SERIAL_EXIT.OPEN_FAILED}
}

$results = @()
$printed = $false
$written = 0
$writeError = ''

try {
  try { $port.DiscardInBuffer() } catch { }
  try { $port.DiscardOutBuffer() } catch { }
  $lines = [System.IO.File]::ReadAllLines($PayloadFile) | Where-Object { $_ -and $_.Trim() }
  foreach ($line in $lines) {
    $parts = $line.Split([char]9)
    if ($parts.Length -lt 4) { continue }
    $name = [string]$parts[0]
    $expect = [int]$parts[1]
    $until = [int]$parts[2]
    $bytes = [Convert]::FromBase64String($parts[3])
    $tries = 1
    if ($until -ge 0) { $tries = [Math]::Max(1, $EndRetries) }
    $step = [PSCustomObject]@{
      step = $name
      request = $(if ($bytes.Length -ge 3) { [int]$bytes[2] } else { -1 })
      expect = $expect
      replyCmd = -1
      replyHex = ''
      rawHex = ''
      attempts = 0
      ok = $false
      done = $false
    }
    for ($try = 1; $try -le $tries; $try++) {
      $step.attempts = $try
      $port.Write($bytes, 0, $bytes.Length)
      $written += $bytes.Length
      if ($expect -lt 0) {
        $step.ok = $true
        if ($RowDelayMs -gt 0) { Start-Sleep -Milliseconds $RowDelayMs }
        break
      }
      $frame = Read-NiimbotFrame -Port $port -TimeoutMs $ReadTimeoutMs
      $step.replyCmd = [int]$frame.cmd
      $step.replyHex = [string]$frame.dataHex
      $step.rawHex = [string]$frame.rawHex
      if ($step.replyCmd -eq $expect) {
        $step.ok = $true
        if ($until -lt 0) { break }
        if ($step.replyHex.Length -ge 2) {
          $first = [Convert]::ToInt32($step.replyHex.Substring(0, 2), 16)
          if ($first -eq $until) {
            $step.done = $true
            $printed = $true
            break
          }
        }
        Start-Sleep -Milliseconds 300
      } else {
        Start-Sleep -Milliseconds 120
      }
    }
    $results += $step
    if (-not $step.ok) { break }
  }
} catch {
  Write-RawError $_
  [Console]::Error.WriteLine('os-configured: ' + $osBaud)
  $writeError = Get-ErrorText $_
} finally {
  try {
    if ($port.IsOpen) { $port.Close() }
    $port.Dispose()
  } catch { }
}

# Emitted even when a write threw, so the replies collected before the failure
# are not lost — they are what say whether the printer was ever listening.
@{
  portPath = $PortPath
  portName = $PortName
  baud = $Baud
  osConfiguredBaud = $osBaud
  availablePorts = $available
  bytesWritten = $written
  printed = $printed
  writeError = $writeError
  steps = @($results)
} | ConvertTo-Json -Depth 5 -Compress

if ($writeError) { exit ${SERIAL_EXIT.WRITE_FAILED} }
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
 * PowerShell's method-invocation wrapper, in any locale.
 *
 * The English form is
 *   Exception calling "Open" with "0" argument(s): "<the real message>"
 * and a French Windows says
 *   Exception lors de l'appel de « Open » avec « 0 » argument(s) : « ... »
 * with the message in guillemets. Matching only the English form left the whole
 * wrapper in front of the reason on the merchant's till, so the sentence they
 * read began with PowerShell trivia and was then truncated before the point.
 * Each pattern takes the last quoted run on the line, which is where the real
 * message always is; the final one covers a wrapper whose closing quote has
 * been lost to truncation, which is exactly what was reported.
 */
const PS_INVOCATION_WRAPPERS = [
  /^.*\bargument\(s\)\s*:\s*"(.+)"\s*$/,
  /^.*:\s*«\s*(.+?)\s*»\s*$/u,
  /^.*:\s*[“”]\s*(.+?)\s*[“”]\s*$/u,
  /^.*:\s*"\s*(.+?)\s*"\s*$/,
  /^.*\bargument.*:\s*«\s*(.+)$/u,
];

/**
 * First non-empty stderr line — the raw .NET exception message, nothing else.
 * The script now sends the base exception, so there is usually no wrapper left
 * to strip; this keeps stripping it for anything already in the field.
 */
function rawSerialError(error) {
  const stderr = String((error && error.stderr) || "");
  for (const line of stderr.split(/\r?\n/)) {
    const text = line.trim();
    if (!text) continue;
    for (const wrapper of PS_INVOCATION_WRAPPERS) {
      const unwrapped = text.match(wrapper);
      if (unwrapped) return unwrapped[1].trim().slice(0, 300);
    }
    return text.slice(0, 300);
  }
  return "";
}

/** A labelled line the serial script appends to stderr after the exception. */
function serialErrorField(error, label) {
  const stderr = String((error && error.stderr) || "");
  const match = stderr.match(new RegExp(`^${label}:[ \\t]*(.*)$`, "im"));
  return match ? match[1].trim() : "";
}

/**
 * The COM ports the failing script saw, or null when it did not report them
 * (an older agent, or a failure that never reached the enumeration). "Windows
 * has no serial port at all" and "we do not know" must not read the same.
 */
function availablePortsFromError(error) {
  const stderr = String((error && error.stderr) || "");
  if (!/^ports:/im.test(stderr)) return null;
  return serialErrorField(error, "ports")
    .split(",")
    .map((p) => normalizeComPort(p))
    .filter(Boolean);
}

function describeAvailablePorts(available) {
  if (!available) return "";
  return available.length
    ? ` Windows currently has: ${available.join(", ")}.`
    : " Windows currently has no serial port at all.";
}

/**
 * Turns a failed serial attempt into text a merchant can act on. The raw .NET
 * message is always appended so the real cause is visible even when we have no
 * rule for it.
 */
/**
 * .NET's own words for a name it will not accept as a serial port, in the
 * languages we have seen. Only a fallback: the script reports the exception
 * *type*, which needs no translation.
 */
const NET_PORT_NAME_REFUSED =
  /does not start with COM|does not resolve to a valid serial port|not a serial port|ne commence pas par COM|ne d[ée]marre pas avec COM|port s[ée]rie valide|PortName cannot be empty|not a serial port name|no serial port name was given/i;

function describeSerialFailure(comPort, error, baud) {
  const label = normalizeComPort(comPort) || String(comPort || "COM").toUpperCase();
  const at = baud ? ` at ${baud} baud` : "";
  if (error && (error.killed || error.code === "ETIMEDOUT")) {
    return `Niimbot ${label} timed out${at}`;
  }
  const raw = rawSerialError(error);
  const detail = raw ? ` — ${raw}` : "";
  const available = availablePortsFromError(error);
  const have = describeAvailablePorts(available);
  const type = serialErrorField(error, "type");

  /*
   * ArgumentException from Open() means Windows would not accept the *name*, and
   * .NET gives the identical message whether the name is malformed, gone, or
   * resolves to a device that is not a serial port. Only the live port list can
   * separate those, so it decides which of the two sentences is true.
   */
  if (/Argument(Null)?Exception/i.test(type) || NET_PORT_NAME_REFUSED.test(raw)) {
    if (available && available.includes(label)) {
      return `Niimbot ${label} exists but Windows will not open it as a serial port${at}.${have} That is a leftover port entry, not a working port: remove the device in Device Manager, then unpair and re-pair the printer over Bluetooth (or reinstall the NIIMBOT driver) so ${label} is created again.${detail}`;
    }
    return `Niimbot ${label} is not a serial port on this PC${at}.${have} Unpair and re-pair the printer over Bluetooth, or reinstall the NIIMBOT driver, to recreate its COM port — then run "Diagnose Niimbot ports" and pick a port from the list.${detail}`;
  }
  if (/access to the port|access is denied|UnauthorizedAccess/i.test(raw)) {
    return `Niimbot ${label} is already open${at}. Close NIIMBOT.exe (and any other app holding the port), then retry.${detail}`;
  }
  if (/does not exist|FileNotFoundException|could not find|cannot find the (file|port)/i.test(raw)) {
    return `Niimbot ${label} does not exist on this PC${at}.${have} Run "Diagnose Niimbot ports" and pick a port from the list.${detail}`;
  }
  if (/semaphore timeout|device attached to the system is not functioning|The I\/O operation/i.test(raw)) {
    return `Niimbot ${label} did not answer${at}. This is what a Bluetooth incoming/unconnected port does — connect the printer in Windows Bluetooth settings and use its outgoing port.${detail}`;
  }
  if (!raw) {
    return `Niimbot ${label} serial write failed${at}`;
  }
  return `Niimbot ${label} failed${at}${detail}`;
}

/** One line per step: name, expected reply id, terminator byte, packet. */
function serialPayloadLines(steps) {
  return steps
    .map((s) =>
      [s.name, String(s.expect), String(s.until ?? -1), s.packet.toString("base64")].join(
        SERIAL_PAYLOAD_SEPARATOR
      )
    )
    .join("\n");
}

/** Reads the handshake JSON the script prints; never guesses on parse failure. */
function parseHandshakeOutput(stdout, comPort, baud) {
  const raw = String(stdout || "").trim().replace(/^\uFEFF/, "");
  const parsed = raw ? JSON.parse(raw) : {};
  const rows = Array.isArray(parsed.steps) ? parsed.steps : parsed.steps ? [parsed.steps] : [];
  const steps = rows.map((s) => ({
    step: String(s.step || ""),
    request: Number(s.request ?? -1),
    expect: Number(s.expect ?? -1),
    replyCmd: Number(s.replyCmd ?? -1),
    replyHex: String(s.replyHex || ""),
    rawHex: String(s.rawHex || ""),
    attempts: Number(s.attempts || 0),
    ok: Boolean(s.ok),
    done: Boolean(s.done),
  }));
  return {
    comPort: String(comPort || "").toUpperCase(),
    portPath: String(parsed.portPath || ""),
    baud: Number(parsed.baud || baud),
    osConfiguredBaud: String(parsed.osConfiguredBaud || ""),
    availablePorts: String(parsed.availablePorts || "")
      .split(",")
      .map((p) => normalizeComPort(p))
      .filter(Boolean),
    bytesWritten: Number(parsed.bytesWritten || 0),
    printed: Boolean(parsed.printed),
    writeError: String(parsed.writeError || ""),
    steps,
    // A reply of any kind proves the printer is on the other end of this port
    // and is parsing 55 55 frames. Without one, the port is the wrong one.
    answered: steps.some((s) => s.replyCmd >= 0),
    replies: steps
      .filter((s) => s.replyCmd >= 0)
      .map((s) => `${s.step}=0x${s.replyCmd.toString(16).padStart(2, "0")}${s.replyHex ? `:${s.replyHex}` : ""}`),
  };
}

/**
 * Pulls the handshake JSON out of a failed run's stdout. Returns null unless a
 * step was actually recorded, so an open failure (which prints nothing) still
 * travels as an exception.
 */
function recoverHandshakeOutput(error, comPort, baud) {
  const stdout = String((error && error.stdout) || "");
  if (!stdout.includes("steps")) return null;
  try {
    const parsed = parseHandshakeOutput(stdout, comPort, baud);
    return parsed.steps.length ? parsed : null;
  } catch {
    return null;
  }
}

/** One open+handshake attempt at one baud. Throws with the real reason attached. */
async function runNiimbotSerialHandshake(comPort, job, baud, options = {}) {
  const portPath = normalizeComPort(comPort);
  // No port name, no attempt. Handing an empty or malformed name to SerialPort
  // spends a PowerShell start-up to get back a .NET message that says nothing
  // the merchant can act on.
  if (!portPath) {
    const failure = new Error(describeComPortNameProblem(comPort));
    failure.fatal = true;
    failure.baud = baud;
    throw failure;
  }
  const steps = job.steps || [];
  const timeoutMs = Math.min(240000, Math.max(60000, 20000 + steps.length * 80));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reborn-niimbot-job-"));
  const payloadFile = path.join(dir, "packets.txt");
  fs.writeFileSync(payloadFile, serialPayloadLines(steps), "utf8");
  try {
    const { stdout } = await runPowerShellSource(
      buildSerialJobScript(),
      [
        "-PortPath",
        portPath,
        "-Baud",
        String(baud),
        "-PayloadFile",
        payloadFile,
        "-PortName",
        String(comPort || "").toUpperCase(),
        "-ReadTimeoutMs",
        String(options.readTimeoutMs || 2000),
      ],
      { scriptName: "niimbot-serial.ps1", timeout: timeoutMs }
    );
    return parseHandshakeOutput(stdout, comPort, baud);
  } catch (error) {
    // A write that throws mid-job still prints its JSON, and the replies it
    // collected first are the whole diagnosis: they say whether the printer was
    // ever listening. Losing them to the exception is losing the answer.
    const partial = recoverHandshakeOutput(error, comPort, baud);
    if (partial) {
      partial.writeError = rawSerialError(error) || String((error && error.message) || "");
      return partial;
    }
    const failure = new Error(describeSerialFailure(comPort, error, baud));
    failure.rawError = rawSerialError(error);
    failure.errorType = serialErrorField(error, "type");
    failure.availablePorts = availablePortsFromError(error);
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

/**
 * Whether another baud is worth trying. A port that is held by another app,
 * absent, or refused by name fails identically at every rate, and a name is not
 * a baud problem in any language — retrying it spends two more PowerShell
 * starts to reprint the same sentence with a different number in it.
 */
function isFatalSerialFailure(error) {
  if (!error) return false;
  if (error.fatal) return true;
  const type = String(error.errorType || "");
  if (/Argument(Null)?Exception/i.test(type)) return true;
  const raw = String(error.rawError || "");
  if (NET_PORT_NAME_REFUSED.test(raw)) return true;
  return /access to the port|access is denied|does not exist|could not find/i.test(raw);
}

/**
 * 115200 first, always. The other rates are only worth a retry when the printer
 * said nothing at all — once it answers, the rate is right and the answer is
 * the result, whatever it says.
 */
async function printNiimbotJobSerial(comPort, job, options = {}) {
  const bauds = Array.isArray(options.bauds) && options.bauds.length ? options.bauds : SERIAL_BAUDS;
  const failures = [];
  let silent = null;
  for (const baud of bauds) {
    let result;
    try {
      result = await runNiimbotSerialHandshake(comPort, job, baud, options);
    } catch (error) {
      failures.push(error);
      if (isFatalSerialFailure(error)) break;
      continue;
    }
    if (result.printed || result.answered) return result;
    silent = result;
  }
  if (silent) return silent;
  const first = failures[0];
  const error = new Error(first ? first.message : `Niimbot ${comPort} serial write failed`);
  error.attempts = failures.map((f) => ({ baud: f.baud, error: f.rawError || f.message }));
  throw error;
}

/** Names the step the printer refused, with the bytes it sent back. */
function describeHandshake(result) {
  const port = String((result && result.comPort) || "COM").toUpperCase();
  const at = result && result.baud ? ` at ${result.baud} baud` : "";
  const osBaud = result && result.osConfiguredBaud ? ` Windows has this port configured at ${result.osConfiguredBaud}.` : "";
  if (!result) return `Niimbot ${port} did not run.`;
  if (result.printed) {
    return `${port}${at}: the printer acknowledged every command and answered PrintEnd (0xf4) with 01 — this label physically printed.`;
  }
  const failed = result.steps.find((s) => !s.ok);
  const end = result.steps.find((s) => s.step === "PrintEnd");
  const hex = (n) => `0x${Number(n).toString(16).padStart(2, "0")}`;
  const dropped = result.writeError ? ` The port then failed mid-job: ${result.writeError}` : "";
  if (!result.answered) {
    return [
      `Niimbot ${port} never answered${at}: ${result.bytesWritten} bytes went out and nothing came back.`,
      `Wrong port, or the printer is not listening on it.${osBaud}${dropped}`,
      "Run \"Diagnose Niimbot ports\" and use the port it recommends.",
    ].join(" ");
  }
  if (result.writeError) {
    return [
      `Niimbot ${port} answered${at} and then the port failed mid-job: ${result.writeError}`,
      `Replies before it dropped: ${result.replies.join(", ") || "none"}.`,
      "The printer is on this port; the link did not survive the job. A Bluetooth port that drops needs the printer reconnected in Windows.",
    ].join(" ");
  }
  if (failed) {
    const got = failed.replyCmd >= 0 ? `answered ${hex(failed.replyCmd)}` : "answered nothing";
    const raw = failed.rawHex ? ` Raw bytes back: ${failed.rawHex}.` : "";
    return [
      `Niimbot ${port} refused ${failed.step}${at}: expected ${hex(failed.expect)}, ${got}.${raw}`,
      `Replies so far: ${result.replies.join(", ") || "none"}.`,
      "The printer is on this port and talking, so the transport is right and the command it refused is the problem.",
    ].join(" ");
  }
  if (end && !end.done) {
    return [
      `Niimbot ${port} accepted every command${at} but PrintEnd (0xf4) never returned 01 after ${end.attempts} tries`,
      `(last reply data: ${end.replyHex || "empty"}).`,
      "The printer parsed the job and did not report a finished label: labels may be missing, the head may be open, or this label type/size is rejected.",
    ].join(" ");
  }
  return `Niimbot ${port}${at}: handshake finished without confirming a printed label. Replies: ${result.replies.join(", ") || "none"}.`;
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

# .NET's exception, with PowerShell's localized 'Exception calling "Open" with
# "0" argument(s): "..."' layers peeled off — and no further, or .NET's own
# classification is lost with them. See Get-ErrorText in the serial script.
function Get-DotNetException {
  param($Exception)
  $ex = $Exception
  while ($null -ne $ex -and $null -ne $ex.InnerException) {
    $name = ''
    try { $name = [string]$ex.GetType().FullName } catch { $name = '' }
    if (-not $name.StartsWith('System.Management.Automation')) { break }
    $ex = $ex.InnerException
  }
  return $ex
}

function Reason {
  param([System.Management.Automation.ErrorRecord]$Record)
  try {
    $ex = $Record.Exception
    if ($null -eq $ex) { return 'unknown error' }
    $real = Get-DotNetException $ex
    if ($null -eq $real) { $real = $ex }
    $text = [string]$real.Message
    if ([string]::IsNullOrWhiteSpace($text)) { $text = [string]$ex.Message }
    if ([string]::IsNullOrWhiteSpace($text)) { return 'unknown error' }
    return $text
  } catch {
    return 'unknown error'
  }
}

# The .NET type, which is the same in every locale and is what separates a name
# Windows refuses (ArgumentException) from a port that is busy or silent.
function Get-ReasonType {
  param([System.Management.Automation.ErrorRecord]$Record)
  try {
    $ex = $Record.Exception
    if ($null -eq $ex) { return '' }
    $real = Get-DotNetException $ex
    if ($null -eq $real) { $real = $ex }
    return [string]$real.GetType().FullName
  } catch {
    return ''
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
      configuredBaud = ''
      # Get-PnpDevice lists ports whose device is not attached any more, so a
      # row existing is not the same as Windows having the port.
      present = $false
      queues = @()
      sources = @()
      opens = @()
    }
  }
  $row = $ports[$key]
  if ($Source -eq 'GetPortNames' -or $Source -eq 'Win32_SerialPort') { $row.present = $true }
  if ([string]::IsNullOrWhiteSpace($row.caption) -and -not [string]::IsNullOrWhiteSpace($Caption)) {
    $row.caption = $Caption
  }
  if ([string]::IsNullOrWhiteSpace($row.pnpDeviceId) -and -not [string]::IsNullOrWhiteSpace($Pnp)) {
    $row.pnpDeviceId = $Pnp
  }
  if ($row.sources -notcontains $Source) { $row.sources += $Source }
}

# The rate Windows itself uses on the port. The spooler relays a job to a serial
# print port at exactly this rate, so a 9600 here in front of a 115200 printer
# turns correct frames into garbage: beep, feed, blank label.
function Get-ConfiguredBaud {
  param([string]$Name)
  if ([string]::IsNullOrWhiteSpace($Name)) { return '' }
  try {
    $cfg = $serialConfig[$Name]
    if ($null -ne $cfg -and $cfg.BaudRate) {
      return ([string]$cfg.BaudRate + ' baud (' + [string]$cfg.StringSelector + ')')
    }
  } catch { }
  try {
    $raw = (& cmd.exe /c ('mode ' + $Name) 2>&1) | Out-String
    $match = [regex]::Match($raw, '(?i)(?:Baud|Bauds|Baudrate|Bits par seconde)\\D{0,40}(\\d+)')
    if ($match.Success) { return ($match.Groups[1].Value + ' baud (mode)') }
    $flat = ($raw -replace '\\s+', ' ').Trim()
    if ($flat) { return $flat.Substring(0, [Math]::Min(160, $flat.Length)) }
  } catch { }
  return ''
}

$errors = @()

# The ports Windows actually has. Everything else this script finds is either a
# name a queue still points at or a device that is no longer attached, and
# recommending one of those sends the merchant to a port .NET refuses to open.
$live = @{}

try {
  [System.IO.Ports.SerialPort]::GetPortNames() | ForEach-Object {
    $name = ([string]$_).Trim().TrimEnd(':')
    if (-not [string]::IsNullOrWhiteSpace($name)) {
      $live[$name.ToUpperInvariant()] = $true
      Add-PortRow -Name $name -Caption '' -Pnp '' -Source 'GetPortNames'
    }
  }
} catch {
  $errors += ('GetPortNames: ' + (Reason $_))
}

try {
  Get-CimInstance -ClassName Win32_SerialPort -ErrorAction Stop | ForEach-Object {
    $name = ([string]$_.DeviceID).Trim().TrimEnd(':')
    if (-not [string]::IsNullOrWhiteSpace($name)) {
      $live[$name.ToUpperInvariant()] = $true
    }
    Add-PortRow -Name $name -Caption ([string]$_.Caption) -Pnp ([string]$_.PNPDeviceID) -Source 'Win32_SerialPort'
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

$serialConfig = @{}
try {
  Get-CimInstance -ClassName Win32_SerialPortConfiguration -ErrorAction Stop | ForEach-Object {
    $serialConfig[([string]$_.Name).ToUpperInvariant()] = $_
  }
} catch {
  $errors += ('Win32_SerialPortConfiguration: ' + (Reason $_))
}

# Installed printer drivers, so a queue whose driver is gone can be named as
# such: that is the "Pilote indisponible" the merchant sees under K3-I527190103.
$installedDrivers = @()
try {
  Get-PrinterDriver -ErrorAction Stop | ForEach-Object {
    $installedDrivers += ([string]$_.Name).ToLowerInvariant()
  }
} catch {
  try {
    Get-CimInstance -ClassName Win32_PrinterDriver -ErrorAction Stop | ForEach-Object {
      $installedDrivers += (([string]$_.Name) -split ',')[0].ToLowerInvariant()
    }
  } catch {
    $errors += ('printer drivers: ' + (Reason $_))
  }
}

$printers = @()
try {
  Get-CimInstance -ClassName Win32_Printer -ErrorAction Stop | ForEach-Object {
    $driver = [string]$_.DriverName
    $missing = $false
    if ([string]::IsNullOrWhiteSpace($driver)) {
      $missing = $true
    } elseif ($installedDrivers.Count -gt 0 -and ($installedDrivers -notcontains $driver.ToLowerInvariant())) {
      $missing = $true
    }
    $printers += [PSCustomObject]@{
      name = [string]$_.Name
      port = [string]$_.PortName
      driver = $driver
      driverMissing = $missing
      offline = [bool]$_.WorkOffline
      status = [string]$_.PrinterStatus
      isDefault = [bool]$_.Default
    }
  }
} catch {
  $errors += ('Win32_Printer: ' + (Reason $_))
}

# Which queue owns each COM port. Printing Niimbot frames to a port owned by a
# receipt printer is how the merchant got a beep and no label out of COM6.
foreach ($queue in $printers) {
  foreach ($part in (([string]$queue.port) -split ',')) {
    $portKey = $part.Trim().TrimEnd(':').ToUpperInvariant()
    if ($portKey -notmatch '^COM\\d+$') { continue }
    # A queue keeps its port binding after Windows drops the port, so this adds
    # a row for a port nothing else found. It stays present = $false, which is
    # what stops it being recommended and makes the report name it as absent
    # instead of going quiet about the one port the merchant was told to use.
    Add-PortRow -Name $portKey -Caption '' -Pnp '' -Source 'Win32_Printer'
    $row = $ports[$portKey]
    if ($row.queues -notcontains $queue.name) { $row.queues += [string]$queue.name }
  }
}

$bauds = @()
foreach ($b in ($Bauds -split ',')) {
  $trimmed = $b.Trim()
  if ($trimmed) { $bauds += [int]$trimmed }
}

# Runs after the queues are known so that a port only a queue points at is
# tried too: the exception it gives is the proof of what is wrong with it.
foreach ($key in @($ports.Keys)) {
  $row = $ports[$key]
  $row.configuredBaud = Get-ConfiguredBaud $row.port
  # The bare COMn name, never '\\.\COMnn': SerialPort builds that prefix itself
  # and rejects a name that does not start with COM, so prefixing it here made
  # every port above COM9 report as unopenable. See normalizeComPort.
  foreach ($baud in $bauds) {
    $attempt = [PSCustomObject]@{ baud = $baud; opened = $false; error = ''; errorType = '' }
    $sp = $null
    try {
      $sp = New-Object System.IO.Ports.SerialPort $row.port, $baud, 'None', 8, 'One'
      $sp.ReadTimeout = 400
      $sp.WriteTimeout = 1500
      $sp.Open()
      $attempt.opened = $true
    } catch {
      $attempt.error = Reason $_
      $attempt.errorType = Get-ReasonType $_
    } finally {
      try {
        if ($sp -and $sp.IsOpen) { $sp.Close() }
        if ($sp) { $sp.Dispose() }
      } catch { }
    }
    $row.opens += $attempt
  }
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
  # The direct answer to "does that port still exist": what Windows reports
  # right now, independently of what any print queue still points at.
  availablePorts = @($live.Keys | Sort-Object)
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

# Node decodes this pipe as UTF-8, so a localized Windows writing its exception
# text in the console code page would arrive as mojibake.
try {
  [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
} catch { }

# .NET's exception, with PowerShell's localized 'Exception calling ...' layers
# peeled off — and no further. See Get-ErrorText in the serial script.
function Get-DotNetException {
  param($Exception)
  $ex = $Exception
  while ($null -ne $ex -and $null -ne $ex.InnerException) {
    $name = ''
    try { $name = [string]$ex.GetType().FullName } catch { $name = '' }
    if (-not $name.StartsWith('System.Management.Automation')) { break }
    $ex = $ex.InnerException
  }
  return $ex
}

function Get-ReasonText {
  param([System.Management.Automation.ErrorRecord]$Record)
  try {
    $ex = $Record.Exception
    if ($null -eq $ex) { return 'unknown error' }
    $real = Get-DotNetException $ex
    if ($null -eq $real) { $real = $ex }
    $text = [string]$real.Message
    if ([string]::IsNullOrWhiteSpace($text)) { $text = [string]$ex.Message }
    if ([string]::IsNullOrWhiteSpace($text)) { return 'unknown error' }
    return $text
  } catch {
    return 'unknown error'
  }
}

function Write-RawError {
  param([System.Management.Automation.ErrorRecord]$Record)
  try {
    [Console]::Error.WriteLine((Get-ReasonText $Record))
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

/** Why a port is unusable, in the words the summary needs. */
const VERDICT_TEXT = {
  busy: "another program is holding it",
  missing: "Windows no longer has that port",
  "not-a-serial-port": "Windows will not open that name as a serial port",
  "not-connected": "nothing answered on it",
  failed: "it would not open",
  unknown: "it was never tried",
};

/**
 * The COM ports this PC actually has, or null when nothing told us.
 *
 * A print queue keeps its port binding after Windows drops the port: deleting
 * the K3-* queue does not renumber anything, but unpairing the printer takes
 * its SPP port with it, and the queue for the other one still says COM8. Until
 * now a bound port with no enumerated row counted as fine, so the diagnosis
 * recommended a port that no longer existed and the bar test then failed inside
 * .NET with a message about the port *name*. Nothing may be recommended that is
 * not in this set.
 */
function liveComPortSet(ports, availablePorts) {
  if (Array.isArray(availablePorts)) {
    return new Set(availablePorts.map((p) => normalizeComPort(p)).filter(Boolean));
  }
  if (Array.isArray(ports) && ports.length) {
    return new Set(
      ports
        .filter((p) => p && p.present !== false)
        .map((p) => normalizeComPort(p && p.port))
        .filter(Boolean)
    );
  }
  return null;
}

/** "COM3, COM6", or "none" — the list every stale-port message needs. */
function availablePortsText(live) {
  if (!live || !live.size) return "none";
  return [...live]
    .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)))
    .join(", ");
}

/** Classifies one probed COM port and explains, in plain language, what to do. */
function classifyProbedPort(row, context = {}) {
  const blob = `${row.port || ""} ${row.caption || ""} ${row.pnpDeviceId || ""}`;
  const opens = Array.isArray(row.opens) ? row.opens : [];
  const openedBauds = opens.filter((o) => o && o.opened).map((o) => o.baud);
  const errors = opens.map((o) => String((o && o.error) || "")).filter(Boolean);
  const allErrors = errors.join(" | ");
  const errorTypes = opens.map((o) => String((o && o.errorType) || "")).join(" ");
  // Rows only a print queue pointed at are absent by construction, and the
  // "present" flag is the only thing that says so — a row existing does not
  // mean Windows has the port.
  const present = row.present === undefined ? true : Boolean(row.present);
  const isBluetooth = /bthenum|bluetooth/i.test(blob);
  /*
   * A Bluetooth SPP pair gives Windows two ports. The local RFCOMM server
   * ("incoming") is published by the LOCALMFG enumerator and cannot be written
   * to; the outgoing one carries the remote device address and is the only one
   * that reaches the printer.
   */
  const incoming = isBluetooth && /LOCALMFG|_LOCALMFG/i.test(String(row.pnpDeviceId || ""));
  const outgoing =
    isBluetooth &&
    !incoming &&
    /BTHENUM|BluetoothDevice_|&VID|_VID/i.test(String(row.pnpDeviceId || ""));
  const queues = (Array.isArray(row.queues) ? row.queues : []).map(String).filter(Boolean);
  /*
   * The paired Bluetooth device behind an outgoing SPP port. Windows gives such
   * a port the generic caption "Standard Serial over Bluetooth link (COMn)", so
   * once the K3-* print queue is deleted nothing in the port's own fields says
   * "Niimbot" any more. The remote address in its PnP id does, via the paired
   * device list.
   */
  const btDevices = Array.isArray(context.bluetoothDevices) ? context.bluetoothDevices : [];
  const bluetoothAddress = isBluetooth ? bluetoothAddressOf(row.pnpDeviceId) : "";
  const paired = bluetoothAddress
    ? btDevices.find((d) => d && bluetoothAddressOf(d.instanceId) === bluetoothAddress) || null
    : null;
  const bluetoothDevice = paired ? String(paired.name || "") : "";
  const looksNiimbot = NIIMBOT_NAME_RE.test(`${blob} ${queues.join(" ")} ${bluetoothDevice}`);
  const looksScale = /ch340|ch341|usb-serial ch|1a86/i.test(blob) && !looksNiimbot;
  const foreignQueues = queues.filter((q) => !NIIMBOT_NAME_RE.test(q));

  let verdict;
  if (openedBauds.length) {
    verdict = "opened";
  } else if (!present) {
    verdict = "missing";
  } else if (/access to the port|access is denied/i.test(allErrors)) {
    verdict = "busy";
  } else if (/does not exist|could not find|cannot find/i.test(allErrors)) {
    verdict = "missing";
  } else if (/Argument(Null)?Exception/i.test(errorTypes) || NET_PORT_NAME_REFUSED.test(allErrors)) {
    // Windows would not accept the name at all. The port is listed somewhere but
    // does not resolve to a serial device, which is not the same as busy or
    // silent and must not be advised as either.
    verdict = "not-a-serial-port";
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
    advice.push(
      present
        ? "Windows no longer has this port. Clear it from the printer profile."
        : "Windows does not have this port. Only a print queue still points at it, which is a stale binding — nothing can print to it."
    );
  } else if (verdict === "not-a-serial-port") {
    advice.push(
      "Windows lists this name but will not open it as a serial port, so it is a leftover entry rather than a working port. Remove the device in Device Manager, then re-pair the printer over Bluetooth (or reinstall its driver) to recreate the port."
    );
  } else if (verdict === "not-connected") {
    advice.push(
      incoming
        ? "Bluetooth incoming port: Windows cannot send on it. Use the outgoing port for the printer."
        : "The port exists but nothing answered. Connect the printer in Windows Bluetooth settings, then retry."
    );
  }
  if (incoming) advice.push("Marked as a Bluetooth incoming/local port.");
  if (outgoing) advice.push("Bluetooth outgoing port: this is the direction that can reach a printer.");
  if (bluetoothDevice) {
    advice.push(
      `Paired Bluetooth device on this port: '${bluetoothDevice}'.${
        looksNiimbot && !queues.length
          ? " That name is the label printer, so this port is it even with no print queue left."
          : ""
      }`
    );
  }
  if (foreignQueues.length) {
    advice.push(
      `Bound to the print queue ${foreignQueues.join(", ")}, which is not a Niimbot. Niimbot data sent here will not print a label.`
    );
  }
  if (row.configuredBaud) {
    advice.push(
      `Windows has this port configured at ${row.configuredBaud}. The agent opens it at 115200 regardless; a spooler job would use the configured rate.`
    );
  }

  return {
    port: normalizeComPort(row.port) || String(row.port || ""),
    caption: row.caption || "",
    pnpDeviceId: row.pnpDeviceId || "",
    configuredBaud: String(row.configuredBaud || ""),
    present,
    queues,
    foreignQueues,
    sources: Array.isArray(row.sources) ? row.sources : [],
    opens,
    openedBauds,
    verdict,
    isBluetooth,
    bluetoothIncoming: incoming,
    bluetoothOutgoing: outgoing,
    bluetoothAddress,
    bluetoothDevice,
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

  // First, and on its own line: the answer to "does that port still exist".
  const available = Array.isArray(probe.availablePorts)
    ? probe.availablePorts.map((p) => normalizeComPort(p)).filter(Boolean)
    : null;
  if (available) {
    lines.push(
      available.length
        ? `SERIAL PORTS WINDOWS HAS RIGHT NOW: ${available.join(", ")}`
        : "SERIAL PORTS WINDOWS HAS RIGHT NOW: none"
    );
    lines.push("");
  }

  if (!probe.ports.length) {
    lines.push("SERIAL PORTS: none. Windows has no COM port at all, so there is");
    lines.push("nothing to print to over Bluetooth or USB serial. Pair and connect");
    lines.push("the printer in Windows Bluetooth settings first.");
  } else {
    lines.push(`SERIAL PORTS (${probe.ports.length}):`);
    for (const p of probe.ports) {
      lines.push("");
      lines.push(
        `  ${p.port} — ${p.caption || "no name"}${p.present === false ? "  <= NOT PRESENT: Windows does not have this port" : ""}`
      );
      if (p.pnpDeviceId) lines.push(`    device: ${p.pnpDeviceId}`);
      if (p.bluetoothDevice) lines.push(`    paired bluetooth device: ${p.bluetoothDevice}`);
      lines.push(
        `    looks like: ${p.looksNiimbot ? "Niimbot printer" : p.looksScale ? "CH340 scale" : "unknown device"}${p.isBluetooth ? ` (bluetooth ${p.bluetoothIncoming ? "incoming" : p.bluetoothOutgoing ? "outgoing" : "unknown direction"})` : ""}`
      );
      lines.push(`    owned by print queue: ${p.queues && p.queues.length ? p.queues.join(", ") : "none"}`);
      lines.push(`    Windows baud on this port: ${p.configuredBaud || "unknown"}`);
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
      lines.push(
        `  ${q.name} | port=${q.port || "none"} | driver=${q.driver || "none"}${q.driverMissing ? " | DRIVER MISSING (Windows shows 'Pilote indisponible')" : ""}${q.offline ? " | OFFLINE" : ""}${q.isDefault ? " | DEFAULT" : ""}${flag}`
      );
    }
  } else {
    lines.push("PRINT QUEUES: none reported.");
  }

  lines.push("");
  if (probe.recommendedPort && probe.recommendedPort.exists === false) {
    // Never present a port Windows does not have as the one to select. Naming
    // it as absent, next to the ports that do exist, is the fix the merchant
    // needs; recommending it is how they got here.
    const r = probe.recommendedPort;
    lines.push("RECOMMENDED PORT FOR NIIMBOT: none — the port its queue points at does not exist.");
    lines.push(
      `  ${r.port} not found — available ports: ${available && available.length ? available.join(", ") : "none"}`
    );
    if (r.queue) {
      lines.push(`  The queue '${r.queue}' still prints to ${r.port}, so that binding is stale.`);
    }
    lines.push(
      "  Re-pair the printer over Bluetooth, or reinstall the NIIMBOT driver, so Windows creates its serial port again — then run this diagnosis a second time."
    );
  } else if (probe.recommendedPort) {
    const r = probe.recommendedPort;
    lines.push(
      `RECOMMENDED PORT FOR NIIMBOT: ${r.port}${r.queue ? ` (bound to queue '${r.queue}')` : ""}${r.device ? ` (paired device '${r.device}')` : ""}`
    );
    lines.push(`  why: ${RECOMMENDATION_REASONS[r.reason] || r.reason}`);
  } else {
    lines.push("RECOMMENDED PORT FOR NIIMBOT: none found on this PC.");
    lines.push(
      "  No print queue whose name looks like a Niimbot is bound to a COM or USB port, and no Bluetooth outgoing port names one."
    );
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

const RECOMMENDATION_REASONS = {
  "bound-to-queue": "this is the port the Niimbot print queue is really bound to (Win32_Printer.PortName).",
  "bound-to-driverless-queue":
    "the only Niimbot queue on a COM port has no Windows driver, but the agent opens the port itself, so the port is still usable.",
  "bound-to-missing-port":
    "the Niimbot queue still prints to this port, but Windows does not have it any more, so nothing can be printed to it.",
  "bluetooth-outgoing": "no queue is bound to a COM port, but this is the Bluetooth outgoing port of a Niimbot device.",
  "usb-queue": "the Niimbot queue is on a USB spooler port; the agent drives that port's USB printer interface directly.",
};

/** Plain-language conclusion drawn from the probed ports and queues. */
function summarizeComProbe(ports, printers, usbDevices = [], options = {}) {
  const summary = [];
  const live = liveComPortSet(ports, options.availablePorts);
  const existsOnPc = (com) => (live ? live.has(com) : true);
  const haveText = availablePortsText(live);
  const usable = ports.filter(
    (p) => p.verdict === "opened" && !p.looksScale && !(p.foreignQueues && p.foreignQueues.length)
  );
  const niimbotQueues = printers.filter((q) => NIIMBOT_NAME_RE.test(`${q.name} ${q.driver}`));
  const usbQueues = niimbotQueues.filter((q) => /^USB\d+$/i.test(String(q.port || "")));
  const comQueues = niimbotQueues
    .filter((q) => extractComPort(q.port))
    .sort((a, b) => Number(Boolean(a.driverMissing)) - Number(Boolean(b.driverMissing)));

  for (const queue of comQueues) {
    const port = extractComPort(queue.port);
    const row = ports.find((p) => normalizeComPort(p.port) === port);
    // A queue keeps pointing at a port Windows has dropped, and that binding is
    // the only trace left of it. Saying so, with the ports that do exist, is the
    // whole answer to "the diagnosis told me COM8 and COM8 will not open".
    if (!existsOnPc(port)) {
      summary.push(
        `'${queue.name}' prints to ${port}, but ${port} not found — available ports: ${haveText}. That binding is stale: Windows removed the port when the printer was unpaired or its driver was removed. Nothing can print to ${port} until the device is re-paired or reinstalled and Windows gives it a port again.`
      );
      continue;
    }
    // A queue can be bound to a port that cannot be opened at all — the K3-*
    // pairing sits on the Bluetooth *incoming* port. Calling that "the
    // transport to use" would send the merchant straight back to a dead port.
    if (row && row.verdict && row.verdict !== "opened") {
      const why = VERDICT_TEXT[row.verdict] || row.verdict;
      const fix = row.bluetoothIncoming
        ? " That is the Bluetooth incoming port, which Windows can never send on; the printer's outgoing port is the one to use."
        : "";
      summary.push(
        `'${queue.name}' prints to ${port}, but ${port} could not be opened — ${why}. This queue cannot print until that is fixed.${fix}`
      );
      continue;
    }
    const caveat = queue.driverMissing
      ? " This queue has no Windows driver, so Windows itself cannot print to it; the agent does not need one."
      : "";
    summary.push(
      `'${queue.name}' prints to ${port}, a serial port. The agent opens ${port} itself at 115200 and reads the printer's replies, so this is the transport to use.${caveat}`
    );
    if (row && row.configuredBaud && !/115200/.test(row.configuredBaud)) {
      summary.push(
        `Windows has ${port} configured at ${row.configuredBaud}. Any job the spooler relays to this queue is sent at that rate, which a Niimbot cannot read — that is why a queue job feeds paper and prints nothing.`
      );
    }
  }

  /*
   * Deleting the "Pilote indisponible" K3-* queue removes the only place the
   * printer's name appeared, so the SPP port it left behind has to be found by
   * the Bluetooth device paired on it. Without this, a merchant who followed the
   * advice to delete that queue is told no Niimbot port exists at all.
   */
  const sppPorts = ports.filter(
    (p) =>
      p &&
      p.isBluetooth &&
      !p.bluetoothIncoming &&
      p.bluetoothDevice &&
      p.looksNiimbot &&
      existsOnPc(normalizeComPort(p.port))
  );
  for (const port of sppPorts) {
    if (port.queues && port.queues.some((q) => NIIMBOT_NAME_RE.test(q))) continue;
    summary.push(
      port.verdict === "opened"
        ? `${port.port} is the Bluetooth outgoing port of '${port.bluetoothDevice}', which is the label printer, and it opens. No print queue is left on it — that is fine, the agent does not need one. Set ${port.port} as the Port on the Niimbot printer profile.`
        : `${port.port} is the Bluetooth outgoing port of '${port.bluetoothDevice}', the label printer, but it would not open — ${VERDICT_TEXT[port.verdict] || port.verdict}. Connect the printer in Windows Bluetooth settings, then run this diagnosis again.`
    );
  }

  const missingDrivers = printers.filter((q) => q.driverMissing);
  if (missingDrivers.length) {
    summary.push(
      `Queue(s) with no usable driver: ${missingDrivers.map((q) => `'${q.name}'`).join(", ")}. Windows shows these as "Pilote indisponible"; they cannot print anything and should be removed.`
    );
  }

  const foreign = ports.filter((p) => p.foreignQueues && p.foreignQueues.length);
  if (foreign.length) {
    summary.push(
      `Do not select ${foreign.map((p) => `${p.port} (${p.foreignQueues.join(", ")})`).join(", ")} for labels: those ports belong to other printers and will only beep.`
    );
  }

  if (usable.length) {
    summary.push(
      `COM port(s) that opened, are not the scale and belong to no other printer: ${usable.map((p) => `${p.port} @ ${p.openedBauds.join("/")}`).join(", ")}.`
    );
    summary.push(
      comQueues.length
        ? "Use the recommended port above; these are the alternatives if it is wrong."
        : "Set one of these as the Port on the Niimbot printer profile and print a test label."
    );
  } else if (ports.length) {
    // "None opened" and "the ones that opened are all something else" are very
    // different situations to be told you are in.
    const opened = ports.filter((p) => p.verdict === "opened");
    summary.push(
      opened.length
        ? `No COM port that could be the printer opened. ${opened.map((p) => p.port).join(", ")} did open, but ${opened.length === 1 ? "it belongs" : "they belong"} to the scale or to another printer, so none of them is the Niimbot.`
        : "No COM port that could be the printer opened, so Bluetooth serial printing cannot work until the reason listed above is fixed."
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
    availablePorts: [],
    ports: [],
    printers: [],
    bluetooth: [],
    usbPrintDevices: [],
    usbPrintError: null,
    usbPrintGuid: USBPRINT_INTERFACE_GUID,
    recommendedPort: null,
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
    const availableRows = Array.isArray(parsed.availablePorts)
      ? parsed.availablePorts
      : parsed.availablePorts
        ? [parsed.availablePorts]
        : [];
    base.availablePorts = availableRows
      .map((p) => normalizeComPort(p))
      .filter(Boolean)
      .sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
    const printerRows = Array.isArray(parsed.printers)
      ? parsed.printers
      : parsed.printers
        ? [parsed.printers]
        : [];
    base.printers = printerRows.map((q) => ({
      name: String(q.name || ""),
      port: String(q.port || ""),
      driver: String(q.driver || ""),
      driverMissing: Boolean(q.driverMissing),
      offline: Boolean(q.offline),
      isDefault: Boolean(q.isDefault),
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
    // Ports are classified last: an SPP port's own fields never name the
    // printer, only the device paired on it does, so the Bluetooth list has to
    // exist first.
    const portRows = Array.isArray(parsed.ports) ? parsed.ports : parsed.ports ? [parsed.ports] : [];
    base.ports = portRows.map((row) => classifyProbedPort(row, { bluetoothDevices: base.bluetooth }));
    base.warnings = (Array.isArray(parsed.errors) ? parsed.errors : []).map(String).filter(Boolean);
    const usb = await listUsbPrintDevices({ timeout: 30000 });
    base.usbPrintDevices = usb.devices;
    base.usbPrintError = usb.error;
    base.usbPrintGuid = USBPRINT_INTERFACE_GUID;
    base.recommendedPort = recommendNiimbotPort(base.printers, base.ports, {
      availablePorts: base.availablePorts,
    });
    base.summary = summarizeComProbe(base.ports, base.printers, base.usbPrintDevices, {
      availablePorts: base.availablePorts,
    });
  } catch (error) {
    base.ok = false;
    base.error = rawSerialError(error) || String((error && error.message) || error);
    base.summary = ["The diagnosis itself failed. The reason is shown above."];
  }
  base.text = formatComProbeReport(base);
  return base;
}

/**
 * Picks the transport, in order of how much we actually know:
 *
 *  1. a COM port the merchant selected,
 *  2. the port the print queue is really bound to (`Win32_Printer.PortName`),
 *  3. a USB spooler port,
 *  4. a COM port we merely discovered by name.
 *
 * (2) is the fix for eight days of blank labels: the NIIMBOT K3 queue on the
 * merchant's till prints to COM8, while USB005 is only still *associated* with
 * it. We wrote to USB005 and to the spooler, so the frames either went nowhere
 * or were relayed to COM8 at Windows' own 9600 instead of the printer's 115200.
 *
 * A merely discovered COM port still never beats a USB port: CH340 scales share
 * VID 1a86 and would otherwise be mistaken for the printer.
 */
function chooseNiimbotTransport({ portName, printerName, resolvedCom, resolvedUsb, boundPort }) {
  const explicitCom = extractComPort(portName, printerName);
  const boundCom = extractComPort(boundPort);
  const boundUsb = extractWindowsUsbPort(boundPort);
  const usb =
    extractWindowsUsbPort(portName, printerName) ||
    boundUsb ||
    (resolvedUsb ? String(resolvedUsb).trim() : "") ||
    "";
  const discoveredCom = resolvedCom ? String(resolvedCom).trim() : "";

  if (explicitCom) {
    return { mode: "com", comPort: explicitCom, usbPort: usb || null, portSource: "selected" };
  }
  if (boundCom) {
    return { mode: "com", comPort: boundCom, usbPort: usb || null, portSource: "queue" };
  }
  if (usb) {
    return { mode: "windows", comPort: null, usbPort: usb, portSource: boundUsb ? "queue" : "selected" };
  }
  if (discoveredCom) {
    return { mode: "com", comPort: discoveredCom, usbPort: null, portSource: "discovered" };
  }
  return { mode: "windows", comPort: null, usbPort: null, portSource: "none" };
}

/**
 * Refuses a COM port that belongs to another print queue which is not a
 * Niimbot. The merchant bound our label profile to COM6 and we happily sent
 * Niimbot frames to POS-80C (copy 3), a receipt printer: it beeped and printed
 * nothing, which looked exactly like every other failure and cost another day.
 */
function describeForeignComPort({ comPort, owners, printerName, recommended }) {
  const port = extractComPort(comPort);
  if (!port) return "";
  const all = owners && typeof owners === "object" ? owners : {};
  const bound = (all[port] || []).map(String).filter(Boolean);
  const target = String(printerName || "").trim();
  const targetLooksNiimbot = NIIMBOT_NAME_RE.test(target);
  if (!bound.length) return "";
  if (bound.some((name) => NIIMBOT_NAME_RE.test(name))) return "";

  const owner = bound[0];
  const tail = recommended
    ? ` The Niimbot is on ${recommended.port}${recommended.queue ? ` (queue '${recommended.queue}')` : ""} — select that instead.`
    : ' Run "Diagnose Niimbot ports" to find the right port.';
  if (targetLooksNiimbot) {
    return `${port} belongs to ${owner}, not to ${target}. Sending Niimbot data there will not print a label.${tail}`;
  }
  return `${port} belongs to ${owner}, a receipt printer. Sending Niimbot data there will not print a label — it only beeps.${tail}`;
}

/**
 * The port to use: the one the Niimbot queue is really bound to.
 *
 * A queue whose driver is gone ("Pilote indisponible", which is what the K3-*
 * Bluetooth pairing shows) is ranked last but not discarded: we open the COM
 * port ourselves, so the missing Windows driver does not stop us — it only
 * means Windows itself can never print to it. A port the probe could not open
 * is ranked below both, because no amount of protocol gets through it.
 */
function recommendNiimbotPort(queues = [], ports = [], options = {}) {
  const rows = Array.isArray(queues) ? queues : [];
  const portRows = Array.isArray(ports) ? ports : [];
  const live = liveComPortSet(portRows, options.availablePorts);
  const existsOnPc = (com) => (live ? live.has(com) : true);
  const niimbot = rows.filter((q) => NIIMBOT_NAME_RE.test(`${q.name || ""} ${q.driver || q.driverName || ""}`));
  const unopenable = (com) => {
    const row = portRows.find((p) => normalizeComPort((p && p.port) || "") === com);
    return Boolean(row && row.verdict && row.verdict !== "opened");
  };
  const comQueues = niimbot
    .map((q) => ({ queue: q, com: extractComPort(q.port || q.portName) }))
    .filter((x) => x.com)
    .map((x) => ({ ...x, missing: !existsOnPc(x.com), dead: unopenable(x.com) }))
    .sort(
      (a, b) =>
        Number(a.missing) - Number(b.missing) ||
        Number(a.dead) - Number(b.dead) ||
        Number(Boolean(a.queue.driverMissing)) - Number(Boolean(b.queue.driverMissing))
    );
  const asQueue = (x) => ({
    port: x.com,
    queue: String(x.queue.name || ""),
    reason: x.missing
      ? "bound-to-missing-port"
      : x.queue.driverMissing
        ? "bound-to-driverless-queue"
        : "bound-to-queue",
    exists: !x.missing,
  });
  const usable = comQueues.find((x) => !x.dead && !x.missing);
  if (usable) return asQueue(usable);

  // Either no queue is on a COM port, or the only one that is cannot be opened.
  // A Bluetooth outgoing port for a K3-* device is the next candidate, since
  // that is what SPP pairing produces — and after the K3-* queue is deleted it
  // is recognised by the paired device's name, which is all that is left.
  const spp = portRows.find(
    (p) =>
      p &&
      p.looksNiimbot &&
      p.isBluetooth &&
      !p.bluetoothIncoming &&
      p.verdict !== "missing" &&
      existsOnPc(normalizeComPort(p.port))
  );
  if (spp) {
    return {
      port: normalizeComPort(spp.port) || String(spp.port || ""),
      queue: "",
      device: String(spp.bluetoothDevice || ""),
      reason: "bluetooth-outgoing",
      exists: true,
    };
  }
  const usbQueue = niimbot.find((q) => extractWindowsUsbPort(q.port || q.portName));
  if (usbQueue) {
    return {
      port: extractWindowsUsbPort(usbQueue.port || usbQueue.portName),
      queue: String(usbQueue.name || ""),
      reason: "usb-queue",
      exists: true,
    };
  }
  // Nothing better exists: name the bound port anyway, so the report says which
  // port to fix rather than going silent. `exists: false` is what stops the
  // report presenting it as a port to select.
  return comQueues.length ? asQueue(comQueues[0]) : null;
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
    resolveQueuePortFn,
    resolveComOwnersFn,
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
  const jobOptions = { printerName, portName, profile };
  const job = buildNiimbotJobPackets(bitmap, w, h, density, jobOptions);
  const stepJob = buildNiimbotJobSteps(bitmap, w, h, density, jobOptions);
  // The bar test reports profile=b21+invert in its headline; the fingerprint has
  // to say the same thing or the two contradict each other in the same toast.
  const profileLabel = invertBitmap ? `${job.profile}+invert` : job.profile;

  let resolvedCom = extractComPort(portName, printerName);
  if (!resolvedCom && typeof resolveComPortFn === "function") {
    resolvedCom = await resolveComPortFn(printerName, portName);
  }
  let resolvedUsb = extractWindowsUsbPort(portName, printerName);
  if (!resolvedUsb && typeof resolveWindowsUsbPortFn === "function") {
    resolvedUsb = await resolveWindowsUsbPortFn(printerName, portName);
  }
  // What the queue is really bound to, straight from Win32_Printer.PortName.
  let queue = null;
  if (typeof resolveQueuePortFn === "function") {
    queue = await resolveQueuePortFn(printerName, portName).catch(() => null);
  }
  const boundPort = queue && queue.portName ? String(queue.portName) : "";
  const transport = chooseNiimbotTransport({
    portName,
    printerName,
    resolvedCom,
    resolvedUsb,
    boundPort,
  });
  const name = String(printerName || "").trim();
  const queueInfo = queue
    ? {
        queueName: queue.name || name,
        queuePort: boundPort,
        queueDriver: queue.driverName || "",
        queueDriverMissing: Boolean(queue.driverMissing),
      }
    : {};

  if (transport.mode === "com" && transport.comPort) {
    let owners = null;
    if (typeof resolveComOwnersFn === "function") {
      owners = await resolveComOwnersFn().catch(() => null);
    }
    if (owners && opts.allowForeignPort !== true) {
      const foreign = describeForeignComPort({
        comPort: transport.comPort,
        owners: owners.byPort || owners,
        printerName: name,
        recommended: owners.recommended || null,
      });
      if (foreign) throw new Error(foreign);
    }
    let serial = null;
    let comError = null;
    const runSerial = typeof opts.printSerialFn === "function" ? opts.printSerialFn : printNiimbotJobSerial;
    try {
      console.log(
        `[print-agent] Niimbot label via COM ${transport.comPort} (${transport.portSource}) profile=${job.profile} steps=${stepJob.steps.length}`
      );
      serial = await runSerial(transport.comPort, stepJob, {
        bauds: opts.bauds,
        readTimeoutMs: opts.readTimeoutMs,
      });
    } catch (error) {
      comError = error;
    }

    if (serial) {
      const diag = describeJob(bitmap, job.packets, profileLabel, "com", rowBytes);
      const detail = describeHandshake(serial);
      const result = {
        printer: transport.comPort,
        queue: name || undefined,
        ...queueInfo,
        baud: serial.baud,
        osConfiguredBaud: serial.osConfiguredBaud,
        portSource: transport.portSource,
        bytesWritten: serial.bytesWritten,
        handshake: serial.steps,
        replies: serial.replies,
        answered: serial.answered,
        confirmed: serial.printed,
        ...diag,
      };
      if (serial.printed) {
        console.log(`[print-agent] Niimbot ${detail}`);
        return { ...result, unconfirmed: false, detail };
      }
      // The printer talked back and did not confirm a label: that is an answer,
      // not a reason to try a blind transport and print another hopeful toast.
      if (serial.answered) {
        console.warn(`[print-agent] Niimbot ${detail}`);
        return {
          ...result,
          unconfirmed: true,
          warning: `${detail} Fingerprint: profile=${diag.profile} packets=${diag.packetCount} rasterLines=${diag.rasterLines} inkBytes=${diag.bitmapNonZeroBytes} rowBytes=${diag.rasterRowBytes} dim=${diag.dimensionHex}`,
        };
      }
      comError = new Error(detail);
    }

    // Nothing answered on the port. A spooler job for a queue bound to that
    // same COM port would only repeat the write at Windows' own baud rate, so
    // there is nothing to fall back to.
    const boundToCom = Boolean(extractComPort(boundPort));
    if (!name || typeof printWindowsPacketsFn !== "function" || boundToCom) {
      throw comError;
    }
    console.warn(
      `[print-agent] Niimbot COM ${transport.comPort} failed, falling back to Windows:`,
      comError && comError.message
    );
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
        ...queueInfo,
        portSource: transport.portSource,
        ...describeJob(bitmap, job.packets, profileLabel, "usbdev", rowBytes),
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
  const diag = describeJob(bitmap, job.packets, profileLabel, pathLabel, rowBytes);
  return {
    printer: name,
    ...queueInfo,
    portSource: transport.portSource,
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
  buildNiimbotJobSteps,
  buildTestPatternBitmap,
  buildSerialJobScript,
  buildComProbeScript,
  buildUsbDeviceScript,
  USBPRINT_INTERFACE_GUID,
  RESPONSE_CODE,
  PRINT_END_DONE,
  SERIAL_PAYLOAD_SEPARATOR,
  countPixelsForLine,
  isNiimbotPrintPayload(buf) {
    return Buffer.isBuffer(buf) && buf.length >= 2 && buf[0] === 0x55 && buf[1] === 0x55;
  },
  extractComPort,
  extractWindowsUsbPort,
  normalizeComPort,
  describeComPortNameProblem,
  bluetoothAddressOf,
  liveComPortSet,
  serialErrorField,
  availablePortsFromError,
  isFatalSerialFailure,
  printNiimbotJobSerial,
  chooseNiimbotTransport,
  describeForeignComPort,
  recommendNiimbotPort,
  classifyProbedPort,
  formatComProbeReport,
  summarizeComProbe,
  probeNiimbotComPorts,
  listUsbPrintDevices,
  printNiimbotViaUsbDevice,
  packetDelayMs,
  describeJob,
  describeHandshake,
  describeSerialFailure,
  describeSpoolerUncertainty,
  parseHandshakeOutput,
  serialPayloadLines,
  rawSerialError,
  printNiimbotLabel,
};
