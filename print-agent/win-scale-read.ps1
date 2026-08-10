# Read Aclas / USB-serial scale bytes from a Windows COM port (9600 8N1).
param(
  [Parameter(Mandatory = $false)][string]$PortName = "",
  [Parameter(Mandatory = $false)][int]$TimeoutMs = 2500,
  [Parameter(Mandatory = $false)][switch]$ListPorts
)

$ErrorActionPreference = "Stop"

function Write-Json($obj) {
  $obj | ConvertTo-Json -Compress -Depth 6
}

try {
  Add-Type -AssemblyName System.IO.Ports | Out-Null
} catch {
  # already loaded
}

if ($ListPorts -or [string]::IsNullOrWhiteSpace($PortName)) {
  $ports = [System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object
  Write-Json @{ ok = $true; ports = @($ports) }
  exit 0
}

$port = New-Object System.IO.Ports.SerialPort
$port.PortName = $PortName
$port.BaudRate = 9600
$port.DataBits = 8
$port.Parity = [System.IO.Ports.Parity]::None
$port.StopBits = [System.IO.Ports.StopBits]::One
$port.Handshake = [System.IO.Ports.Handshake]::None
$port.ReadTimeout = 200
$port.WriteTimeout = 200
$port.DtrEnable = $true
$port.RtsEnable = $true

try {
  $port.Open()
} catch {
  Write-Json @{ ok = $false; error = "Could not open $PortName : $($_.Exception.Message)" }
  exit 1
}

$chunks = New-Object System.Collections.Generic.List[byte]
$deadline = [Diagnostics.Stopwatch]::StartNew()
try {
  while ($deadline.ElapsedMilliseconds -lt $TimeoutMs) {
    try {
      $n = $port.BytesToRead
      if ($n -gt 0) {
        $buf = New-Object byte[] $n
        $read = $port.Read($buf, 0, $n)
        if ($read -gt 0) {
          for ($i = 0; $i -lt $read; $i++) { [void]$chunks.Add($buf[$i]) }
        }
      } else {
        Start-Sleep -Milliseconds 40
      }
    } catch {
      Start-Sleep -Milliseconds 40
    }
  }
} finally {
  try { $port.Close() } catch {}
  try { $port.Dispose() } catch {}
}

$bytes = $chunks.ToArray()
$b64 = if ($bytes.Length -gt 0) { [Convert]::ToBase64String($bytes) } else { "" }
Write-Json @{
  ok = $true
  port = $PortName
  bytes = $bytes.Length
  dataBase64 = $b64
}
