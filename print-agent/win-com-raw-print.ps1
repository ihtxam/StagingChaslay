# Direct COM/serial ESC-POS writer — bypasses Windows print spooler (WritePrinter).
# Dot-sourced by win-raw-print.ps1 and win-raw-print-worker.ps1.

function Extract-ComPort {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
    $t = [string]$Text.Trim()
    if ($t -match '(?i)\(COM(\d+)\)') {
        return "COM$($Matches[1])"
    }
    if ($t -match '(?i)[·•\u00B7]\s*(COM\d+)\s*:?\s*$') {
        return $Matches[1].ToUpperInvariant()
    }
    if ($t -match '(?i)(?:^|\\\\\.\\)(COM\d+)\s*:?\s*$') {
        return $Matches[1].ToUpperInvariant()
    }
    if ($t -match '(?i)\b(COM\d+)\b') {
        return $Matches[1].ToUpperInvariant()
    }
    return ""
}

function Get-PrinterPortName {
    param([string]$Printer)
    $wmiPort = ""
    try {
        $escaped = $Printer.Replace("'", "''")
        $row = Get-CimInstance -ClassName Win32_Printer -Filter "Name='$escaped'" -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($row -and $row.PortName) {
            $wmiPort = [string]$row.PortName
        }
    } catch { }
    $com = Extract-ComPort -Text $wmiPort
    if (-not [string]::IsNullOrWhiteSpace($com)) { return $com }
    $com = Extract-ComPort -Text $Printer
    if (-not [string]::IsNullOrWhiteSpace($com)) { return $com }
    return $wmiPort.Trim()
}

function Test-ComPortPrinter {
    param(
        [string]$Printer,
        [string]$PortName
    )
    if (Extract-ComPort -Text $PortName) { return $true }
    if (Extract-ComPort -Text $Printer) { return $true }
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

function Normalize-ComPortName {
    param([string]$Port)
    $n = [string]$Port
    if ([string]::IsNullOrWhiteSpace($n)) { return "" }
    $n = $n.Trim()
    if ($n -match '^\\\\\.\\(.+)$') { $n = $Matches[1] }
    if ($n -match '^COM(\d+)$') {
        $num = [int]$Matches[1]
        if ($num -ge 10) { return "\\.\COM$num" }
        return "COM$num"
    }
    return $Port.Trim()
}

function New-ByteArray {
    param([int[]]$Values)
    $arr = New-Object byte[] $Values.Length
    for ($i = 0; $i -lt $Values.Length; $i++) {
        $arr[$i] = [byte]$Values[$i]
    }
    return $arr
}

function Get-FallbackCutSequences {
    # Used when payload has no recognizable cut suffix (try common ESC/POS variants).
    return @(
        (New-ByteArray @(0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00)),
        (New-ByteArray @(0x1d, 0x56, 0x00)),
        (New-ByteArray @(0x1d, 0x56, 0x01)),
        (New-ByteArray @(0x1b, 0x69)),
        (New-ByteArray @(0x1b, 0x6d))
    )
}

function Write-RawToComPort {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Port,

        [Parameter(Mandatory = $true)]
        [byte[]]$Data,

        [int]$ChunkSize = 64,
        [int]$DelayMs = 150,
        [string]$Label = "data",
        [int]$BaudRate = 115200
    )

    if ($null -eq $Data -or $Data.Length -eq 0) {
        return 0
    }

    $openPort = Normalize-ComPortName -Port $Port
    if ([string]::IsNullOrWhiteSpace($openPort)) {
        throw "Invalid COM port name: '$Port'"
    }

    try {
        Add-Type -AssemblyName System.IO.Ports -ErrorAction Stop | Out-Null
    } catch { }

    $serial = New-Object System.IO.Ports.SerialPort
    $serial.PortName = $openPort
    $serial.BaudRate = $BaudRate
    $serial.DataBits = 8
    $serial.Parity = [System.IO.Ports.Parity]::None
    $serial.StopBits = [System.IO.Ports.StopBits]::One
    $serial.Handshake = [System.IO.Ports.Handshake]::None
    $serial.DtrEnable = $true
    $serial.RtsEnable = $true
    $estMs = [Math]::Max(5000, [int](($Data.Length / [Math]::Max(1, $ChunkSize)) * ($DelayMs + 80) + 2000))
    $serial.WriteTimeout = [Math]::Min(120000, $estMs)
    $serial.ReadTimeout = 200

    try {
        $serial.Open()
    } catch {
        throw "Could not open serial port $openPort : $($_.Exception.Message)"
    }

    $totalWritten = 0
    $chunkCount = 0
    try {
        $offset = 0
        while ($offset -lt $Data.Length) {
            $len = [Math]::Min($ChunkSize, $Data.Length - $offset)
            $serial.Write($Data, $offset, $len)
            $totalWritten += $len
            $offset += $len
            $chunkCount++
            if ($offset -lt $Data.Length) {
                Start-Sleep -Milliseconds $DelayMs
            }
        }
        try { $serial.BaseStream.Flush() } catch { }
    }
    finally {
        try { $serial.Close() } catch { }
        try { $serial.Dispose() } catch { }
    }

    Write-PrintLog "com-$Label port=$openPort wrote $totalWritten bytes in $chunkCount chunks (size=$ChunkSize delay=${DelayMs}ms baud=$BaudRate)"
    return $totalWritten
}

function Send-RawViaComPort {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PortName,

        [Parameter(Mandatory = $true)]
        [byte[]]$Data,

        [string]$Printer = "",
        [int]$ChunkSize = 64,
        [int]$DelayMs = 150,
        [int]$CutDelayMs = 500
    )

    $port = Normalize-ComPortName -Port $PortName
    if ([string]::IsNullOrWhiteSpace($port)) {
        throw "No COM port for direct serial print (printer='$Printer' port='$PortName')."
    }

    $split = Split-CutSuffix -Data $Data
    $body = $split.body
    $cut = $split.cut

    Write-PrintLog "com-direct printer='$Printer' port='$port' totalBytes=$($Data.Length) body=$($body.Length) cut=$($cut.Length) chunk=$ChunkSize delay=${DelayMs}ms"

    if ($body.Length -gt 0) {
        [void](Write-RawToComPort -Port $port -Data $body -ChunkSize $ChunkSize -DelayMs $DelayMs -Label "body")
        $drainMs = [Math]::Min(8000, [Math]::Max(200, [int]($body.Length / [Math]::Max(1, $ChunkSize) * ($DelayMs + 40) + 150)))
        Start-Sleep -Milliseconds $drainMs
    }

    Start-Sleep -Milliseconds $CutDelayMs

    if ($null -ne $cut -and $cut.Length -gt 0) {
        [void](Write-RawToComPort -Port $port -Data $cut -ChunkSize $cut.Length -DelayMs 0 -Label "cut-payload")
        Start-Sleep -Milliseconds 300
    } else {
        $variants = Get-FallbackCutSequences
        foreach ($seq in $variants) {
            [void](Write-RawToComPort -Port $port -Data $seq -ChunkSize $seq.Length -DelayMs 0 -Label "cut-fallback")
            Start-Sleep -Milliseconds 80
        }
    }
}

function Test-UseComDirect {
    param(
        [string]$PortName,
        [bool]$SlowBluetooth,
        [string]$Mode = "off"
    )
    if ($Mode -eq "off") { return $false }
    $com = Extract-ComPort -Text $PortName
    if (-not [string]::IsNullOrWhiteSpace($com)) { return $true }
    if ($SlowBluetooth -and -not [string]::IsNullOrWhiteSpace($PortName) -and $PortName -match 'COM\d+') {
        return $true
    }
    return $false
}

function Invoke-ComDirectOrSpooler {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Printer,

        [Parameter(Mandatory = $true)]
        [byte[]]$Data,

        [bool]$SlowBluetooth = $false,

        [Parameter(Mandatory = $true)]
        [scriptblock]$SpoolerSend,

        [ValidateSet("auto", "on", "off")]
        [string]$ComDirectMode = "off",

        [int]$ChunkSize = 64,
        [int]$DelayMs = 150,
        [int]$CutDelayMs = 500
    )

    $portName = Get-PrinterPortName -Printer $Printer
    $comPort = Extract-ComPort -Text $portName
    if ([string]::IsNullOrWhiteSpace($comPort)) {
        $comPort = Extract-ComPort -Text $Printer
    }

    $useComDirect = (Get-Command Test-UseComDirect -ErrorAction SilentlyContinue) -and
        (Test-UseComDirect -PortName $comPort -SlowBluetooth $SlowBluetooth -Mode $ComDirectMode)

    $comError = ""
    if ($useComDirect) {
        try {
            Send-RawViaComPort -PortName $comPort -Data $Data -Printer $Printer `
                -ChunkSize $ChunkSize -DelayMs $DelayMs -CutDelayMs $CutDelayMs
            Write-PrintLog "com-direct ok printer='$Printer' port='$comPort'"
            return
        } catch {
            $comError = $_.Exception.Message
            Write-PrintLog "com-direct FAILED printer='$Printer' port='$comPort' reason=$comError — retrying via Windows spooler (WritePrinter)"
        }
    }

    try {
        & $SpoolerSend
    } catch {
        if ($comError) {
            throw "Print failed for '$Printer': direct COM ($comPort) failed ($comError); spooler also failed ($($_.Exception.Message))"
        }
        throw
    }
}
