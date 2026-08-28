# Persistent RAW print worker for Reborn Print Agent.
# Loads Win32 OpenPrinter once, then reads JSON lines from stdin:
#   {"cmd":"print","printerName":"...","dataBase64":"..."}
#   {"cmd":"ping"}
# Replies with one JSON line per request.
#
# v1.8.8: spooler-only WritePrinter. Does not load the COM-direct helper.

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
    $isComBt = Test-ComPortPrinter -Printer $Printer -PortName $PortName
    switch ($Mode) {
        "on" { return $isComBt }
        "off" { return $false }
        default { return $isComBt }
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
        if ($DelayMs -gt 0 -and $offset -lt $Data.Length) {
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
        [string]$BtSlowMode = "auto"
    )

    $portName = Get-PrinterPortName -Printer $Printer
    $slowBluetooth = Resolve-BtSlowMode -Mode $BtSlowMode -Printer $Printer -PortName $portName
    Send-RawToPrinterSpooler -Printer $Printer -Data $Data -SlowBluetooth $slowBluetooth -PortName $portName
}

function Send-RawToPrinterSpooler {
    param(
        [string]$Printer,
        [byte[]]$Data,
        [bool]$SlowBluetooth,
        [string]$PortName = ""
    )

    if (-not $PortName) {
        $PortName = Get-PrinterPortName -Printer $Printer
    }
    $chunkSize = if ($SlowBluetooth) { 128 } else { 4096 }
    $delayMs = if ($SlowBluetooth) { 75 } else { 0 }

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
            if ($SlowBluetooth) {
                $split = Split-CutSuffix -Data $Data
                $body = $split.body
                $cut = $split.cut
                Write-PrintLog "spooler printer='$Printer' port='$PortName' slowBt=True bytes=$($Data.Length) body=$($body.Length) cut=$(if ($cut) { $cut.Length } else { 0 })"
                if ($body.Length -gt 0) {
                    [void](Write-RawChunks -Handle $handle -Data $body -ChunkSize $chunkSize -DelayMs $delayMs -Printer $Printer -Label "body")
                    Wait-PrinterDrain -PayloadBytes $body.Length -ChunkSize $chunkSize -DelayMs $delayMs
                }
                if ($null -ne $cut -and $cut.Length -gt 0) {
                    Wait-PrinterDrain -PayloadBytes $body.Length -ChunkSize $chunkSize -DelayMs $delayMs -BeforeCut
                    [void](Write-RawChunks -Handle $handle -Data $cut -ChunkSize $cut.Length -DelayMs 0 -Printer $Printer -Label "cut")
                    Start-Sleep -Milliseconds 400
                } elseif ($body.Length -le $chunkSize -and $body.Length -gt 0) {
                    Start-Sleep -Milliseconds 250
                }
            } else {
                Write-PrintLog "spooler printer='$Printer' port='$PortName' slowBt=False bytes=$($Data.Length) chunk=$chunkSize"
                [void](Write-RawChunks -Handle $handle -Data $Data -ChunkSize $chunkSize -DelayMs 0 -Printer $Printer -Label "payload")
                Start-Sleep -Milliseconds 80
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
        $btMode = [string]($req.btSlowMode)
        if ([string]::IsNullOrWhiteSpace($btMode)) { $btMode = "auto" }
        Send-RawToPrinter -Printer $printerName -Data $bytes -BtSlowMode $btMode
        Write-JsonLine @{ ok = $true; printer = $printerName }
    }
    catch {
        Write-JsonLine @{ ok = $false; error = $_.Exception.Message }
    }
}
