param(
    [string]$PrinterName = "",

  # UTF-8 printer name file (same pattern as win-raw-print.ps1).
    [string]$PrinterNameFile = "",

    [Parameter(Mandatory = $true)]
    [string]$PacketsFile,

    [int]$LineDelayMs = 12,
    [int]$SetupDelayMs = 80,
    [int]$EndDelayMs = 250
)

$ErrorActionPreference = "Stop"

try {
    [Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
    [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
    $OutputEncoding = [Console]::OutputEncoding
} catch { }

if (-not [string]::IsNullOrWhiteSpace($PrinterNameFile)) {
    if (-not (Test-Path -LiteralPath $PrinterNameFile)) {
        throw "Printer name file not found: $PrinterNameFile"
    }
    $PrinterName = [System.IO.File]::ReadAllText(
        $PrinterNameFile,
        [System.Text.UTF8Encoding]::new($true)
    ).Trim()
}

if ([string]::IsNullOrWhiteSpace($PrinterName)) {
    throw "PrinterName is required for Niimbot label print."
}

if (-not (Test-Path -LiteralPath $PacketsFile)) {
    throw "Packets file not found: $PacketsFile"
}

$csharp = @"
using System;
using System.Runtime.InteropServices;

public class NiimbotRawPrinter {
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
        [Console]::Error.WriteLine("reborn-niimbot: $Message")
    } catch { }
}

function Write-OnePacket {
    param(
        [IntPtr]$Handle,
        [byte[]]$Data,
        [string]$Printer
    )
    if ($null -eq $Data -or $Data.Length -eq 0) { return }
    $written = 0
    if (-not [NiimbotRawPrinter]::WritePrinter($Handle, $Data, $Data.Length, [ref]$written)) {
        $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw "WritePrinter failed for '$Printer' (Win32=$err)."
    }
    if ($written -lt $Data.Length) {
        throw "WritePrinter short write for '$Printer': $written of $($Data.Length) bytes."
    }
}

function Get-PacketDelayMs {
    param([byte[]]$Packet)
    if ($null -eq $Packet -or $Packet.Length -lt 3) { return $SetupDelayMs }
    $type = [int]$Packet[2]
    switch ($type) {
        0x85 { return $LineDelayMs }
        0xA3 { return 150 }
        { $_ -in 0xE3, 0xF3 } { return $EndDelayMs }
        default { return $SetupDelayMs }
    }
}

$packetLines = [System.IO.File]::ReadAllLines($PacketsFile) |
    Where-Object { $_ -and $_.Trim() }

if (-not $packetLines -or $packetLines.Count -lt 1) {
    throw "No Niimbot packets in $PacketsFile"
}

$packets = New-Object System.Collections.Generic.List[byte[]]
foreach ($line in $packetLines) {
    $packets.Add([Convert]::FromBase64String($line.Trim()))
}

Write-PrintLog "printer='$PrinterName' packets=$($packets.Count)"

$docInfo = New-Object NiimbotRawPrinter+DOCINFO
$docInfo.pDocName = "Reborn Niimbot Label"
$docInfo.pDataType = "RAW"

$handle = [IntPtr]::Zero
if (-not [NiimbotRawPrinter]::OpenPrinter($PrinterName, [ref]$handle, [IntPtr]::Zero)) {
    $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    if ($err -eq 1801) {
        throw "Printer '$PrinterName' not found or disconnected"
    }
    throw "OpenPrinter failed for '$PrinterName' (Win32=$err)"
}

try {
    if (-not [NiimbotRawPrinter]::StartDocPrinter($handle, 1, [ref]$docInfo)) {
        $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw "StartDocPrinter failed for '$PrinterName' (Win32=$err)."
    }
    try {
        if (-not [NiimbotRawPrinter]::StartPagePrinter($handle)) {
            $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
            throw "StartPagePrinter failed for '$PrinterName' (Win32=$err)."
        }

        # Wake bytes — official NIIMBOT.exe sends 0x54 0x01 before framed packets.
        Write-OnePacket -Handle $handle -Data ([byte[]](0x54, 0x01)) -Printer $PrinterName
        Start-Sleep -Milliseconds 120

        foreach ($pkt in $packets) {
            Write-OnePacket -Handle $handle -Data $pkt -Printer $PrinterName
            $delay = Get-PacketDelayMs -Packet $pkt
            if ($delay -gt 0) {
                Start-Sleep -Milliseconds $delay
            }
        }

        Start-Sleep -Milliseconds 800
        [NiimbotRawPrinter]::EndPagePrinter($handle) | Out-Null
    }
    finally {
        [NiimbotRawPrinter]::EndDocPrinter($handle) | Out-Null
    }
}
finally {
    [NiimbotRawPrinter]::ClosePrinter($handle) | Out-Null
}

Write-Output $PrinterName
