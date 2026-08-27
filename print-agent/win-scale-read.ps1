# Read Aclas / USB-serial scale bytes from a Windows COM port (9600 8N1).
# ListPorts returns friendly names (CH340, Bluetooth SPP, …) so we can find the
# device again when Windows assigns a new COM number.
param(
  [Parameter(Mandatory = $false)][string]$PortName = "",
  [Parameter(Mandatory = $false)][int]$TimeoutMs = 2500,
  [Parameter(Mandatory = $false)][switch]$ListPorts,
  [Parameter(Mandatory = $false)][string]$Hint = "",
  [Parameter(Mandatory = $false)][string]$PnpDeviceId = ""
)

$ErrorActionPreference = "Stop"

function Write-Json($obj) {
  $obj | ConvertTo-Json -Compress -Depth 6
}

function Normalize-PortName([string]$Name) {
  $n = $Name.Trim()
  if ($n -match '^\\\\\.\\(.+)$') { $n = $Matches[1] }
  if ($n -match '^COM(\d+)$') {
    $num = [int]$Matches[1]
    if ($num -ge 10) { return "\\.\COM$num" }
    return "COM$num"
  }
  return $Name.Trim()
}

function Device-Key([string]$Text) {
  if ([string]::IsNullOrWhiteSpace($Text)) { return '' }
  return ($Text.ToLowerInvariant() -replace '[^a-z0-9]', '')
}

function Get-SerialDevices {
  $byCom = @{}

  function Add-Device($port, $caption, $manufacturer, $pnp, $name) {
    if ([string]::IsNullOrWhiteSpace($port)) { return }
    $port = $port.Trim().ToUpperInvariant()
    if ($port -notmatch '^COM\d+$') { return }
    $cleanName = if ($name) { $name } else { $caption }
    $cleanName = [regex]::Replace([string]$cleanName, '\s*\(COM\d+\)\s*$', '').Trim()
    if (-not $byCom.ContainsKey($port)) {
      $byCom[$port] = @{
        port = $port
        caption = [string]$caption
        manufacturer = [string]$manufacturer
        pnpDeviceId = [string]$pnp
        name = $cleanName
      }
    } else {
      $cur = $byCom[$port]
      if (-not $cur.caption -and $caption) { $cur.caption = [string]$caption }
      if (-not $cur.manufacturer -and $manufacturer) { $cur.manufacturer = [string]$manufacturer }
      if (-not $cur.pnpDeviceId -and $pnp) { $cur.pnpDeviceId = [string]$pnp }
      if ((-not $cur.name -or $cur.name -eq $port) -and $cleanName) { $cur.name = $cleanName }
    }
  }

  try {
    Get-CimInstance -ClassName Win32_SerialPort -ErrorAction SilentlyContinue | ForEach-Object {
      Add-Device $_.DeviceID $_.Caption $_.Manufacturer $_.PNPDeviceID $_.Name
    }
  } catch {}

  try {
    Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -match 'COM\d+' } | ForEach-Object {
        if ($_.Name -match '(COM\d+)') {
          Add-Device $Matches[1] $_.Name $_.Manufacturer $_.PNPDeviceID $_.Name
        }
      }
  } catch {}

  try {
    Add-Type -AssemblyName System.IO.Ports | Out-Null
  } catch {}
  try {
    [System.IO.Ports.SerialPort]::GetPortNames() | ForEach-Object {
      Add-Device $_ $_ '' '' $_
    }
  } catch {}

  return @($byCom.Values | Sort-Object { [int]($_.port -replace '\D','') })
}

function Resolve-SerialPort([string]$WantPort, [string]$WantHint, [string]$WantPnp) {
  $devices = Get-SerialDevices
  $wantPort = if ($WantPort) { (Normalize-PortName $WantPort) -replace '^\\\\\.\\', '' } else { '' }
  $wantPort = $wantPort.ToUpperInvariant()
  $hintKey = Device-Key $WantHint
  $pnpKey = Device-Key $WantPnp

  if ($wantPort -and ($devices | Where-Object { $_.port -eq $wantPort })) {
    return ($devices | Where-Object { $_.port -eq $wantPort } | Select-Object -First 1)
  }

  $scored = @()
  foreach ($d in $devices) {
    $score = 0
    $nameKey = Device-Key $d.name
    $capKey = Device-Key $d.caption
    $manKey = Device-Key $d.manufacturer
    $idKey = Device-Key $d.pnpDeviceId
    if ($pnpKey -and $idKey -and ($idKey -eq $pnpKey -or $idKey.Contains($pnpKey) -or $pnpKey.Contains($idKey))) {
      $score += 20
    }
    if ($hintKey) {
      if ($nameKey -eq $hintKey -or $capKey -eq $hintKey) { $score += 12 }
      elseif ($nameKey.Contains($hintKey) -or $hintKey.Contains($nameKey) -or $capKey.Contains($hintKey)) { $score += 8 }
      elseif ($manKey -and ($manKey.Contains($hintKey) -or $hintKey.Contains($manKey))) { $score += 5 }
    }
    if ($score -gt 0) {
      $scored += [PSCustomObject]@{ score = $score; device = $d }
    }
  }
  $best = $scored | Sort-Object score -Descending | Select-Object -First 1
  if ($best) { return $best.device }
  return $null
}

if ($ListPorts -or ([string]::IsNullOrWhiteSpace($PortName) -and [string]::IsNullOrWhiteSpace($Hint) -and [string]::IsNullOrWhiteSpace($PnpDeviceId))) {
  $devices = Get-SerialDevices
  Write-Json @{
    ok = $true
    ports = @($devices | ForEach-Object { $_.port })
    devices = @($devices)
  }
  exit 0
}

$resolved = Resolve-SerialPort $PortName $Hint $PnpDeviceId
if (-not $resolved) {
  $openTry = if ($PortName) { Normalize-PortName $PortName } else { "" }
  if (-not $openTry) {
    Write-Json @{ ok = $false; error = "Scale not found. Reconnect USB/Bluetooth and scan ports in Settings." }
    exit 1
  }
} else {
  $openTry = Normalize-PortName $resolved.port
}

try {
  Add-Type -AssemblyName System.IO.Ports | Out-Null
} catch {
  # already loaded
}

$port = New-Object System.IO.Ports.SerialPort
$port.PortName = $openTry
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
  Write-Json @{ ok = $false; error = "Could not open $openTry : $($_.Exception.Message)" }
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
  port = $openTry
  resolvedPort = $(if ($resolved) { $resolved.port } else { $openTry })
  deviceName = $(if ($resolved) { $resolved.name } else { "" })
  bytes = $bytes.Length
  dataBase64 = $b64
}
