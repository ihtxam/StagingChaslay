# Publish RebornPOS installer + manifest to production over SSH (Windows PowerShell).
$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$envFile = Join-Path $env:USERPROFILE ".reborn-agent-env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      Set-Item -Path "env:$($Matches[1])" -Value $Matches[2]
    }
  }
}

$sshAlias = if ($env:REBORN_POS_SSH_ALIAS) { $env:REBORN_POS_SSH_ALIAS }
            elseif ($env:PRODUCTION_SSH_ALIAS) { $env:PRODUCTION_SSH_ALIAS }
            else { "production-reborn" }
$deployPath = if ($env:REBORN_POS_REMOTE_PATH) { $env:REBORN_POS_REMOTE_PATH }
              elseif ($env:PRODUCTION_DEPLOY_PATH) { "$($env:PRODUCTION_DEPLOY_PATH)/backend/public/downloads" }
              else { "/root/rebornSense/backend/public/downloads" }
$localDir = if ($env:REBORN_POS_DOWNLOADS_DIR) { $env:REBORN_POS_DOWNLOADS_DIR }
            else { Join-Path $Root "backend/public/downloads" }

$exe = Join-Path $localDir "reborn-pos-setup.exe"
$json = Join-Path $localDir "reborn-pos-setup.json"
$updateJson = Join-Path $localDir "reborn-pos-update.json"

if (-not (Test-Path $exe)) {
  throw "Missing $exe — run scripts/build-reborn-pos-windows.ps1 first"
}

$bytes = [System.IO.File]::ReadAllBytes($exe)
if ($bytes.Length -lt 1MB -or $bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) {
  throw "$exe is not a valid Windows PE installer"
}

Write-Host "Publishing RebornPOS installer to ${sshAlias}:${deployPath}"
ssh -o BatchMode=yes $sshAlias "mkdir -p '$deployPath'"
scp -o BatchMode=yes $exe "${sshAlias}:${deployPath}/reborn-pos-setup.exe"
if (Test-Path $json) {
  scp -o BatchMode=yes $json "${sshAlias}:${deployPath}/reborn-pos-setup.json"
}
if (Test-Path $updateJson) {
  scp -o BatchMode=yes $updateJson "${sshAlias}:${deployPath}/reborn-pos-update.json"
}

$remoteBytes = ssh -o BatchMode=yes $sshAlias "wc -c < '${deployPath}/reborn-pos-setup.exe' | tr -d ' '"
if ([int64]$remoteBytes -lt 1000000) {
  throw "Remote reborn-pos-setup.exe is too small ($remoteBytes bytes)"
}

Write-Host "Published reborn-pos-setup.exe ($remoteBytes bytes)"
Write-Host "Download: https://app.rebornsense.com/downloads/reborn-pos-setup.exe"
if (Test-Path $updateJson) {
  Write-Host "Updater:  https://app.rebornsense.com/downloads/reborn-pos-update.json"
}
