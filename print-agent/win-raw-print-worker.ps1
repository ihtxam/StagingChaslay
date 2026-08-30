# Persistent RAW print worker for Reborn Print Agent.
# Loads Win32 OpenPrinter once, then reads JSON lines from stdin:
#   {"cmd":"print","printerName":"...","dataBase64":"..."}
#   {"cmd":"ping"}
# Replies with one JSON line per request.
#
# v1.9.4: self-contained spooler-only WritePrinter. No COM-direct writes.
# Bluetooth / virtual-COM ports are paced; COM4+ serial skips FlushPrinter (it
# often reports success with 0 bytes) and uses smaller WritePrinter chunks.

$ErrorActionPreference = "Stop"

try {
    [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $OutputEncoding = [Console]::OutputEncoding
} catch { }

$csharp = @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DOCINFO {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFO di);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    [DllImport("winspool.drv", SetLastError = true)]
    public static extern bool FlushPrinter(IntPtr hPrinter, byte[] pBuf, int cbBuf, out int pcWritten, int cSleep);
}
"@

if (-not ("RawPrinterHelper" -as [type])) {
    Add-Type -TypeDefinition $csharp -ErrorAction Stop
}

function Test-UnsuitableRawPrinter {
    param([string]$Name)
    $n = $Name.ToLowerInvariant()
    return @(
        'onenote',
        'microsoft print to pdf',
        'microsoft xps',
        'send to onenote',
        'fax',
        'adobe pdf',
        'foxit',
        'nitro pdf',
        'cutepdf',
        'pdfcreator',
        'dopdf',
        'bullzip',
        'print to pdf',
        'microsoft shared fax'
    ) | Where-Object { $n -like "*$_*" } | Select-Object -First 1
}

function Write-PrintLog {
    param([string]$Message)
    try {
        [Console]::Error.WriteLine("reborn-print: $Message")
    } catch { }
}

function Get-WinPrinterPortName {
    param([string]$Printer)
    if ([string]::IsNullOrWhiteSpace($Printer)) { return "" }
    try {
        $safe = $Printer.Replace("'", "''")
        $row = Get-CimInstance -ClassName Win32_Printer -Filter "Name='$safe'" -ErrorAction SilentlyContinue |
            Select-Object -First 1
        return [string]$row.PortName
    } catch {
        return ""
    }
}

function Test-NeedsPacedWrite {
    param([string]$Port, [string]$Printer, [int]$ByteCount = 0)
    $blob = ("{0} {1}" -f $Port, $Printer).ToLowerInvariant()
    if ($blob -match 'com\d+|bth|bthenum|bluetooth|ble\b|rfcomm|cpbt|serial over|bluetoothprinter|bt_') {
        return $true
    }
    if ($blob -match 'xprinter|gprinter|gainscha|rongta|munbyn|rpp|pos-?58|pos-?80|pos-?80c|r80a?|58mm|80mm|thermal|receipt|escpos|zj|printer_|generic.*text') {
        return $true
    }
    if ($ByteCount -ge 1800) {
        return $true
    }
    return $false
}

function Split-CutSuffix {
    param([byte[]]$Data)
    if ($null -eq $Data -or $Data.Length -lt 4) {
        return ,@($Data, [byte[]]@())
    }
    $start = [Math]::Max(0, $Data.Length - 96)
    for ($i = $Data.Length - 1; $i -ge $start; $i--) {
        if ($Data[$i] -eq 0x1D -and ($i + 1) -lt $Data.Length -and $Data[$i + 1] -eq 0x56) {
            $body = New-Object byte[] $i
            if ($i -gt 0) { [Array]::Copy($Data, 0, $body, 0, $i) }
            $trail = New-Object byte[] ($Data.Length - $i)
            [Array]::Copy($Data, $i, $trail, 0, $trail.Length)
            return ,@($body, $trail)
        }
        if ($Data[$i] -eq 0x1B -and ($i + 1) -lt $Data.Length -and $Data[$i + 1] -eq 0x64) {
            $body = New-Object byte[] $i
            if ($i -gt 0) { [Array]::Copy($Data, 0, $body, 0, $i) }
            $trail = New-Object byte[] ($Data.Length - $i)
            [Array]::Copy($Data, $i, $trail, 0, $trail.Length)
            return ,@($body, $trail)
        }
    }
    return ,@($Data, [byte[]]@())
}

function Get-BtCutTrailer {
    return [byte[]](
        0x1B, 0x64, 0x0F,
        0x1D, 0x56, 0x01,
        0x1D, 0x56, 0x00,
        0x1B, 0x6D,
        0x0A, 0x0A, 0x0A
    )
}

function Test-ComSerialPort {
    param([string]$PortName)
    return (($PortName + '').ToLowerInvariant() -match '^com\d+$')
}

function Write-RawChunks {
    param(
        [IntPtr]$Handle,
        [byte[]]$Data,
        [string]$Printer,
        [int]$ChunkSize = 4096,
        [int]$DelayMs = 0,
        [switch]$ComSerialPort
    )

    if ($null -eq $Data -or $Data.Length -eq 0) {
        return 0
    }

    $chunkSize = 4096
    if ($ChunkSize -gt 0) { $chunkSize = $ChunkSize }
    $offset = 0
    $totalWritten = 0
    while ($offset -lt $Data.Length) {
        $len = [Math]::Min($chunkSize, $Data.Length - $offset)
        $slice = New-Object byte[] $len
        [Array]::Copy($Data, $offset, $slice, 0, $len)
        $written = 0
        $usedFlush = $false
        # FlushPrinter often returns true with written=0 on COM Bluetooth serial ports.
        if ($DelayMs -gt 0 -and -not $ComSerialPort) {
            try {
                $usedFlush = [RawPrinterHelper]::FlushPrinter($Handle, $slice, $len, [ref]$written, $DelayMs)
                if ($usedFlush -and $written -lt $len) {
                    $usedFlush = $false
                }
            } catch {
                $usedFlush = $false
            }
        }
        if (-not $usedFlush) {
            $attempts = 0
            $maxAttempts = if ($ComSerialPort) { 8 } else { 1 }
            while ($attempts -lt $maxAttempts) {
                $written = 0
                if (-not [RawPrinterHelper]::WritePrinter($Handle, $slice, $len, [ref]$written)) {
                    $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
                    throw "WritePrinter failed for '$Printer' (Win32=$err)."
                }
                if ($written -ge $len) { break }
                $attempts++
                if ($attempts -lt $maxAttempts) {
                    Start-Sleep -Milliseconds 50
                }
            }
            if ($DelayMs -gt 0) {
                Start-Sleep -Milliseconds $DelayMs
            }
        }
        if ($written -lt 1) {
            throw "WritePrinter short write for '$Printer': $written of $len bytes."
        }
        $totalWritten += $written
        if ($written -lt $len) {
            $offset += $written
        } else {
            $offset += $len
        }
        if ($DelayMs -gt 0 -and $offset -ge $Data.Length) {
            Start-Sleep -Milliseconds $DelayMs
        }
    }
    return $totalWritten
}

function Send-RawToPrinter {
    param(
        [string]$Printer,
        [byte[]]$Data
    )

    $portName = Get-WinPrinterPortName -Printer $Printer
    $isComPort = Test-ComSerialPort -PortName $portName
    $paced = Test-NeedsPacedWrite -Port $portName -Printer $Printer -ByteCount $Data.Length
    $writeChunk = 4096
    $writeDelay = 0
    if ($paced) {
        $writeChunk = if ($isComPort) { 32 } else { 96 }
        $writeDelay = if ($isComPort) { 120 } else { 100 }
    }
    $body = $Data
    if ($paced) {
        $split = Split-CutSuffix -Data $Data
        $body = $split[0]
    }
    Write-PrintLog "spooler printer='$Printer' port='$portName' bytes=$($Data.Length) body=$($body.Length) chunk=$writeChunk delayMs=$writeDelay paced=$paced com=$isComPort"

    $docInfo = New-Object RawPrinterHelper+DOCINFO
    $docInfo.pDocName = "Reborn Receipt"
    $docInfo.pDataType = "RAW"

    $handle = [IntPtr]::Zero
    if (-not [RawPrinterHelper]::OpenPrinter($Printer, [ref]$handle, [IntPtr]::Zero)) {
        $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        if ($err -eq 1801) {
            throw "Printer '$Printer' not found or disconnected"
        }
        throw "OpenPrinter failed for '$Printer' (Win32=$err)"
    }

    try {
        if (-not [RawPrinterHelper]::StartDocPrinter($handle, 1, [ref]$docInfo)) {
            $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
            if ($err -eq 1801 -or $err -eq 1905 -or $err -eq 1906) {
                throw "Printer '$Printer' not found or disconnected"
            }
            throw "StartDocPrinter failed for '$Printer' (Win32=$err)."
        }
        try {
            if (-not [RawPrinterHelper]::StartPagePrinter($handle)) {
                $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
                throw "StartPagePrinter failed for '$Printer' (Win32=$err)."
            }
            [void](Write-RawChunks -Handle $handle -Data $body -Printer $Printer -ChunkSize $writeChunk -DelayMs $writeDelay -ComSerialPort:$isComPort)
            if ($paced) {
                $drainMs = [Math]::Min(1200 + [int]([Math]::Floor($body.Length / 6)), 10000)
                if ($isComPort) { $drainMs += 200 }
                Start-Sleep -Milliseconds $drainMs
                $cutDelay = if ($isComPort) { 100 } else { 80 }
                [void](Write-RawChunks -Handle $handle -Data (Get-BtCutTrailer) -Printer $Printer -ChunkSize 32 -DelayMs $cutDelay -ComSerialPort:$isComPort)
                Start-Sleep -Milliseconds $(if ($isComPort) { 800 } else { 600 })
            }
            [RawPrinterHelper]::EndPagePrinter($handle) | Out-Null
        }
        finally {
            [RawPrinterHelper]::EndDocPrinter($handle) | Out-Null
        }
    }
    finally {
        [RawPrinterHelper]::ClosePrinter($handle) | Out-Null
    }
    if ($paced) {
        Start-Sleep -Milliseconds 500
    }
}

function Write-JsonLine {
    param([hashtable]$Obj)
    $json = ($Obj | ConvertTo-Json -Compress -Depth 6)
    [Console]::Out.WriteLine($json)
    [Console]::Out.Flush()
}

Write-JsonLine @{ ok = $true; ready = $true }

while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { break }
    $line = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    try {
        $req = $line | ConvertFrom-Json
        $cmd = [string]$req.cmd
        if ($cmd -eq "ping") {
            Write-JsonLine @{ ok = $true; pong = $true }
            continue
        }
        if ($cmd -ne "print") {
            Write-JsonLine @{ ok = $false; error = "Unknown cmd" }
            continue
        }

        $printerName = [string]($req.printerName)
        if ([string]::IsNullOrWhiteSpace($printerName)) {
            $default = Get-CimInstance -ClassName Win32_Printer -Filter "Default='True'" -ErrorAction SilentlyContinue | Select-Object -First 1
            if (-not $default) { throw "No default printer configured in Windows." }
            $printerName = $default.Name
        }

        if (Test-UnsuitableRawPrinter -Name $printerName) {
            throw ("Select a receipt/ESC-POS thermal printer, not OneNote/PDF/XPS ('{0}')." -f $printerName)
        }
        if ($printerName.Contains("?")) {
            throw "Printer name looks corrupted ('$printerName'). Re-select the printer in WebPOS."
        }

        $b64 = [string]$req.dataBase64
        if ([string]::IsNullOrWhiteSpace($b64)) { throw "dataBase64 is required." }
        $bytes = [Convert]::FromBase64String($b64)
        Send-RawToPrinter -Printer $printerName -Data $bytes
        Write-JsonLine @{ ok = $true; printer = $printerName }
    }
    catch {
        Write-JsonLine @{ ok = $false; error = $_.Exception.Message }
    }
}
