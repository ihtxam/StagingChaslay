param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    # Prefer -PrinterNameFile (UTF-8) so accents/dashes are not mangled via argv/console CP.
    [string]$PrinterName = "",

    [string]$PrinterNameFile = "",

    # Force Bluetooth/COM slow mode (smaller chunks + longer pauses). "auto" detects COM ports.
    [ValidateSet("auto", "on", "off")]
    [string]$BtSlowMode = "auto"
)

$ErrorActionPreference = "Stop"

$comHelper = Join-Path $PSScriptRoot "win-com-raw-print.ps1"
if (Test-Path -LiteralPath $comHelper) {
    . $comHelper
}

# Ensure .NET / pipeline strings stay Unicode regardless of OEM code page.
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

function Get-PrinterPortName {
    param([string]$Printer)
    try {
        $escaped = $Printer.Replace("'", "''")
        $row = Get-CimInstance -ClassName Win32_Printer -Filter "Name='$escaped'" -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($row -and $row.PortName) {
            return [string]$row.PortName
        }
    } catch { }
    if ($Printer -match '\(COM(\d+)\)') {
        return "COM$($Matches[1])"
    }
    return ""
}

function Test-ComPortPrinter {
    param(
        [string]$Printer,
        [string]$PortName
    )
    if ($PortName -match '^COM\d+$') { return $true }
    if ($Printer -match '\(COM\d+\)') { return $true }
    $lower = "$Printer $PortName".ToLowerInvariant()
    if ($lower -match 'bluetooth|bt spp|serial|rfcomm') { return $true }
    return $false
}

function Resolve-BtSlowMode {
    param(
        [string]$Mode,
        [string]$Printer,
        [string]$PortName
    )
    switch ($Mode) {
        "on" { return $true }
        "off" { return $false }
        default {
            return (Test-ComPortPrinter -Printer $Printer -PortName $PortName)
        }
    }
}

function Split-CutSuffix {
    param([byte[]]$Data)

    $patterns = @(
        @(0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00),
        @(0x0a, 0x0a, 0x1d, 0x56, 0x00),
        @(0x1d, 0x56, 0x41, 0x10),
        @(0x1d, 0x56, 0x01),
        @(0x1d, 0x56, 0x00),
        @(0x1b, 0x69),
        @(0x1b, 0x6d)
    )

    foreach ($pat in $patterns) {
        if ($Data.Length -lt $pat.Length) { continue }
        $match = $true
        for ($i = 0; $i -lt $pat.Length; $i++) {
            if ($Data[$Data.Length - $pat.Length + $i] -ne $pat[$i]) {
                $match = $false
                break
            }
        }
        if (-not $match) { continue }

        $bodyLen = $Data.Length - $pat.Length
        $body = if ($bodyLen -gt 0) {
            $tmp = New-Object byte[] $bodyLen
            [Array]::Copy($Data, 0, $tmp, 0, $bodyLen)
            $tmp
        } else {
            @()
        }
        $cut = New-Object byte[] $pat.Length
        [Array]::Copy($Data, $bodyLen, $cut, 0, $pat.Length)
        return @{ body = $body; cut = $cut }
    }

    return @{ body = $Data; cut = $null }
}

function Write-RawChunks {
    param(
        [IntPtr]$Handle,
        [byte[]]$Data,
        [int]$ChunkSize,
        [int]$DelayMs,
        [string]$Printer,
        [string]$Label
    )

    if ($null -eq $Data -or $Data.Length -eq 0) {
        return 0
    }

    $offset = 0
    $totalWritten = 0
    $chunkCount = 0
    while ($offset -lt $Data.Length) {
        $len = [Math]::Min($ChunkSize, $Data.Length - $offset)
        $slice = New-Object byte[] $len
        [Array]::Copy($Data, $offset, $slice, 0, $len)
        $written = 0
        if (-not [RawPrinterHelper]::WritePrinter($Handle, $slice, $len, [ref]$written)) {
            $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
            throw "WritePrinter failed for '$Printer' ($Label, Win32=$err)."
        }
        if ($written -lt $len) {
            throw "WritePrinter short write for '$Printer' ($Label): $written of $len bytes."
        }
        $totalWritten += $written
        $offset += $len
        $chunkCount++
        if ($offset -lt $Data.Length) {
            Start-Sleep -Milliseconds $DelayMs
        }
    }

    Write-PrintLog "$Label wrote $totalWritten bytes in $chunkCount chunks (size=$ChunkSize delay=${DelayMs}ms)"
    return $totalWritten
}

function Wait-PrinterDrain {
    param(
        [int]$PayloadBytes,
        [int]$ChunkSize,
        [int]$DelayMs,
        [switch]$BeforeCut
    )
    $base = [Math]::Max(150, [int]($PayloadBytes / [Math]::Max(1, $ChunkSize) * ($DelayMs + 30) + 120))
    if ($BeforeCut) {
        $base = [Math]::Max($base, 350)
    }
    $waitMs = [Math]::Min(8000, $base)
    Start-Sleep -Milliseconds $waitMs
}

function Send-RawToPrinter {
    param(
        [string]$Printer,
        [byte[]]$Data,
        [bool]$SlowBluetooth
    )

    $portName = Get-PrinterPortName -Printer $Printer
    $chunkSize = if ($SlowBluetooth) { 64 } else { 512 }
    $delayMs = if ($SlowBluetooth) { 150 } else { 25 }
    $split = Split-CutSuffix -Data $Data
    $body = $split.body
    $cut = $split.cut

    Write-PrintLog "printer='$Printer' port='$portName' slowBt=$SlowBluetooth bytes=$($Data.Length) body=$($body.Length) cut=$($cut.Length)"

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

            if ($body.Length -gt 0) {
                [void](Write-RawChunks -Handle $handle -Data $body -ChunkSize $chunkSize -DelayMs $delayMs -Printer $Printer -Label "body")
                Wait-PrinterDrain -PayloadBytes $body.Length -ChunkSize $chunkSize -DelayMs $delayMs
            }

            if ($null -ne $cut -and $cut.Length -gt 0) {
                Wait-PrinterDrain -PayloadBytes $body.Length -ChunkSize $chunkSize -DelayMs $delayMs -BeforeCut
                Start-Sleep -Milliseconds $(if ($SlowBluetooth) { 500 } else { 200 })
                [void](Write-RawChunks -Handle $handle -Data $cut -ChunkSize $cut.Length -DelayMs 0 -Printer $Printer -Label "cut")
                Start-Sleep -Milliseconds $(if ($SlowBluetooth) { 500 } else { 200 })
            } elseif ($body.Length -le $chunkSize -and $body.Length -gt 0) {
                Start-Sleep -Milliseconds $(if ($SlowBluetooth) { 250 } else { 80 })
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
}

$portForMode = Get-PrinterPortName -Printer $PrinterName
$slowBt = Resolve-BtSlowMode -Mode $BtSlowMode -Printer $PrinterName -PortName $portForMode
$comPort = ""
if ($portForMode -match '(COM\d+)') {
    $comPort = $Matches[1].ToUpperInvariant()
}

if ((Get-Command Test-UseComDirect -ErrorAction SilentlyContinue) -and (Test-UseComDirect -PortName $comPort -SlowBluetooth $slowBt)) {
    Send-RawViaComPort -PortName $comPort -Data $bytes -Printer $PrinterName -ChunkSize 64 -DelayMs 150 -CutDelayMs 500
} else {
    Send-RawToPrinter -Printer $PrinterName -Data $bytes -SlowBluetooth $slowBt
}
# Console OutputEncoding is UTF-8 above so Node receives accents intact.
Write-Output $PrinterName
