# Build RebornPOS Windows NSIS installer locally (replaces blocked GitHub Actions windows-latest job).
# Requirements: Windows 10/11, Node 20+, Rust stable (MSVC), WebView2 runtime.
param(
  [string]$PosUrl = "https://app.rebornsense.com/login",
  [switch]$Publish
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Require-MzExe([string]$Path, [string]$Label) {
  if (-not (Test-Path $Path)) { throw "$Label not found: $Path" }
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt 1MB) { throw "$Label too small ($($bytes.Length) bytes)" }
  if ($bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) { throw "$Label missing MZ header" }
}

Write-Host "==> RebornPOS Windows build (root: $Root)"

Write-Host "==> [1/4] Build Print Agent sidecar EXE"
Push-Location (Join-Path $Root "print-agent")
npm ci
New-Item -ItemType Directory -Force -Path dist | Out-Null
npx pkg . --targets node18-win-x64 --output dist/reborn-print-agent.exe
Require-MzExe "dist/reborn-print-agent.exe" "Print Agent EXE"
Pop-Location

Write-Host "==> [2/4] Stage Print Agent for Tauri externalBin"
$binDir = Join-Path $Root "desktop/src-tauri/binaries"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null
Copy-Item -Force `
  (Join-Path $Root "print-agent/dist/reborn-print-agent.exe") `
  (Join-Path $binDir "reborn-print-agent-x86_64-pc-windows-msvc.exe")

Write-Host "==> [3/4] Build NSIS installer"
Push-Location (Join-Path $Root "desktop")
$env:CHASLAY_POS_URL = $PosUrl
npm ci
npm run build:nsis
Pop-Location

Write-Host "==> [4/4] Stage download files"
$nsisDir = Join-Path $Root "desktop/src-tauri/target/release/bundle/nsis"
$installer = Get-ChildItem (Join-Path $nsisDir "*.exe") | Select-Object -First 1
if (-not $installer) { throw "NSIS installer not found under $nsisDir" }

$downloads = Join-Path $Root "backend/public/downloads"
New-Item -ItemType Directory -Force -Path $downloads | Out-Null
$destExe = Join-Path $downloads "reborn-pos-setup.exe"
Copy-Item -Force $installer.FullName $destExe
Require-MzExe $destExe "RebornPOS installer"

$version = (Get-Content (Join-Path $Root "desktop/package.json") | ConvertFrom-Json).version
$manifest = @{
  name = "reborn-pos"
  displayName = "RebornPOS"
  description = "Fullscreen Windows kiosk for Reborn WebPOS. Hardware uses the Print Agent on 127.0.0.1:9101."
  version = $version
  exeFile = "reborn-pos-setup.exe"
  platform = "windows"
  builtAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  signed = $false
}
$manifestPath = Join-Path $downloads "reborn-pos-setup.json"
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding utf8 $manifestPath

Write-Host ""
Write-Host "Built RebornPOS v$version"
Write-Host "  Installer: $destExe ($((Get-Item $destExe).Length) bytes)"
Write-Host "  Manifest:  $manifestPath"

if ($Publish) {
  Write-Host ""
  Write-Host "==> Publishing to production downloads"
  & (Join-Path $Root "scripts/publish-reborn-pos-download.ps1")
}
