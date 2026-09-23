# Build RebornPOS Windows NSIS installer locally (replaces blocked GitHub Actions windows-latest job).
# Requirements: Windows 10/11, Node 20+, Rust stable (MSVC), WebView2 runtime.
param(
  [string]$PosUrl = "https://app.rebornsense.com/login",
  [switch]$Publish
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Require-ExitCode([string]$Step) {
  if ($LASTEXITCODE -ne 0) { throw "$Step failed (exit code $LASTEXITCODE)" }
}

function Resolve-AbsolutePath([string]$Path) {
  if ([string]::IsNullOrWhiteSpace($Path)) { throw "Path is required" }
  if ([System.IO.Path]::IsPathRooted($Path)) { return [System.IO.Path]::GetFullPath($Path) }
  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $Path))
}

function Find-PrintAgentExe([string]$PrintAgentDir) {
  $repoRoot = Split-Path $PrintAgentDir -Parent
  $candidates = @(
    (Join-Path $PrintAgentDir "dist/reborn-print-agent.exe"),
    (Join-Path $PrintAgentDir "reborn-print-agent.exe"),
    (Join-Path $repoRoot "dist/reborn-print-agent.exe")
  )
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return [System.IO.Path]::GetFullPath($candidate)
    }
  }
  throw "Print Agent EXE not found. Checked:`n  $($candidates -join "`n  ")"
}

function Require-MzExe([string]$Path, [string]$Label) {
  $absolute = Resolve-AbsolutePath $Path
  if (-not (Test-Path -LiteralPath $absolute)) { throw "$Label not found: $absolute" }
  $bytes = [System.IO.File]::ReadAllBytes($absolute)
  if ($bytes.Length -lt 1MB) { throw "$Label too small ($($bytes.Length) bytes): $absolute" }
  if ($bytes[0] -ne 0x4D -or $bytes[1] -ne 0x5A) { throw "$Label missing MZ header: $absolute" }
}

Write-Host "==> RebornPOS Windows build (root: $Root)"

Write-Host "==> [1/4] Build Print Agent sidecar EXE"
$PrintAgentDir = Join-Path $Root "print-agent"
$PrintAgentDist = Join-Path $PrintAgentDir "dist"
$PrintAgentExe = Join-Path $PrintAgentDist "reborn-print-agent.exe"
Push-Location $PrintAgentDir
try {
  npm ci
  Require-ExitCode "npm ci (print-agent)"
  New-Item -ItemType Directory -Force -Path $PrintAgentDist | Out-Null
  npx pkg . --targets node18-win-x64 --output $PrintAgentExe
  Require-ExitCode "pkg (print-agent)"
  $PrintAgentExe = Find-PrintAgentExe $PrintAgentDir
  Require-MzExe $PrintAgentExe "Print Agent EXE"
}
finally {
  Pop-Location
}

Write-Host "==> [2/4] Stage Print Agent for Tauri externalBin"
$binDir = Join-Path $Root "desktop/src-tauri/binaries"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null
Copy-Item -Force $PrintAgentExe (Join-Path $binDir "reborn-print-agent-x86_64-pc-windows-msvc.exe")

Write-Host "==> [3/4] Build NSIS installer"
$DesktopDir = Join-Path $Root "desktop"
Push-Location $DesktopDir
try {
  $env:CHASLAY_POS_URL = $PosUrl
  npm ci
  Require-ExitCode "npm ci (desktop)"
  npm run build:nsis
  Require-ExitCode "npm run build:nsis"
}
finally {
  Pop-Location
}

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
  Require-ExitCode "publish-reborn-pos-download.ps1"
}
