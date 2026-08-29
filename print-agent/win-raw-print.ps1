param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    # Prefer -PrinterNameFile (UTF-8) so accents/dashes are not mangled via argv/console CP.
    [string]$PrinterName = "",

    [string]$PrinterNameFile = ""
)

$ErrorActionPreference = "Stop"

# v1.9.1: self-contained spooler-only WritePrinter. No COM-direct writes.
# Bluetooth / virtual-COM ports are paced (192-byte WritePrinter slices) so
# SPP/BLE buffers do not overflow on multi-item kitchen tickets.

try {
    [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $OutputEncoding = [Console]::OutputEncoding
} catch { }

if (-not (Test-Path -LiteralPath $FilePath)) {
    throw "Print file not found: $FilePath"
}

if (-not [string]::IsNullOrWhiteSpace($PrinterNameFile)) {
    if (-not (Test-Path -LiteralPath $PrinterNameFile)) {
        throw "Printer name file not found: $PrinterNameFile"
    }
    # UTF-8 with or without BOM
    $PrinterName = [System.IO.File]::ReadAllText(
        $PrinterNameFile,
        [System.Text.UTF8Encoding]::new($true)
    ).Trim()
}

if ([string]::IsNullOrWhiteSpace($PrinterName)) {
    $default = Get-CimInstance -ClassName Win32_Printer -Filter "Default='True'" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $default) {
        throw "No default printer configured in Windows."
    }
    $PrinterName = $default.Name
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

$bad = Test-UnsuitableRawPrinter -Name $PrinterName
if ($bad) {
    throw ("Select a receipt/ESC-POS thermal printer, not OneNote/PDF/XPS ('{0}'). Raw ESC/POS bytes cannot render on virtual PDF drivers." -f $PrinterName)
}

$bytes = [System.IO.File]::ReadAllBytes($FilePath)

# Explicit OpenPrinterW / wide-string Win32 entry points (avoid ANSI OpenPrinterA).
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
}
"@

Add-Type -TypeDefinition $csharp -ErrorAction Stop

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
    param([string]$Port, [string]$Printer)
    $blob = ("{0} {1}" -f $Port, $Printer).ToLowerInvariant()
    return $blob -match 'com\d+|bth|bluetooth|ble\b|rfcomm|serial over'
}

function Write-RawChunks {
    param(
        [IntPtr]$Handle,
        [byte[]]$Data,
        [string]$Printer,
        [int]$ChunkSize = 4096,
        [int]$DelayMs = 0
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
        if (-not [RawPrinterHelper]::WritePrinter($Handle, $slice, $len, [ref]$written)) {
            $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
            throw "WritePrinter failed for '$Printer' (Win32=$err)."
        }
        if ($written -lt $len) {
            throw "WritePrinter short write for '$Printer': $written of $len bytes."
        }
        $totalWritten += $written
        $offset += $len
        if ($DelayMs -gt 0 -and $offset -lt $Data.Length) {
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
    $paced = Test-NeedsPacedWrite -Port $portName -Printer $Printer
    $writeChunk = 4096
    $writeDelay = 0
    if ($paced) {
        $writeChunk = 192
        $writeDelay = 40
    }
    Write-PrintLog "spooler printer='$Printer' port='$portName' bytes=$($Data.Length) chunk=$writeChunk delayMs=$writeDelay"

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
            [void](Write-RawChunks -Handle $handle -Data $Data -Printer $Printer -ChunkSize $writeChunk -DelayMs $writeDelay)
            if ($paced) {
                $drainMs = [Math]::Min(400 + [int]([Math]::Floor($Data.Length / 16)), 4000)
                Start-Sleep -Milliseconds $drainMs
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
        Start-Sleep -Milliseconds 350
    }
}

Send-RawToPrinter -Printer $PrinterName -Data $bytes
# Console OutputEncoding is UTF-8 above so Node receives accents intact.
Write-Output $PrinterName
