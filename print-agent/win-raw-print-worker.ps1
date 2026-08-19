# Persistent RAW print worker for Chaslay Print Agent.
# Loads Win32 OpenPrinter once, then reads JSON lines from stdin:
#   {"cmd":"print","printerName":"...","dataBase64":"..."}
#   {"cmd":"ping"}
# Replies with one JSON line per request.

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

function Send-RawToPrinter {
    param(
        [string]$Printer,
        [byte[]]$Data
    )

    $docInfo = New-Object RawPrinterHelper+DOCINFO
    $docInfo.pDocName = "ChaslayReborn Receipt"
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
            throw "StartDocPrinter failed for '$Printer' (Win32=$err)."
        }
        try {
            if (-not [RawPrinterHelper]::StartPagePrinter($handle)) {
                $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
                throw "StartPagePrinter failed for '$Printer' (Win32=$err)."
            }
            $written = 0
            if (-not [RawPrinterHelper]::WritePrinter($handle, $Data, $Data.Length, [ref]$written)) {
                $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
                throw "WritePrinter failed for '$Printer' (Win32=$err)."
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
        Send-RawToPrinter -Printer $printerName -Data $bytes
        Write-JsonLine @{ ok = $true; printer = $printerName }
    }
    catch {
        Write-JsonLine @{ ok = $false; error = $_.Exception.Message }
    }
}
