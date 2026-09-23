# Write Tauri updater manifest for RebornPOS (static JSON at /downloads/reborn-pos-update.json).
param(
  [Parameter(Mandatory = $true)][string]$NsisBundleDir,
  [Parameter(Mandatory = $true)][string]$Version,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [string]$DownloadBaseUrl = "https://app.rebornsense.com/downloads",
  [string]$Notes = ""
)

$ErrorActionPreference = "Stop"

$installer = Get-ChildItem (Join-Path $NsisBundleDir "*.exe") | Where-Object { $_.Name -notlike "*.sig" } | Select-Object -First 1
if (-not $installer) { throw "NSIS installer not found under $NsisBundleDir" }

$sigFile = Join-Path $NsisBundleDir ($installer.Name + ".sig")
if (-not (Test-Path $sigFile)) {
  throw "Missing updater signature file: $sigFile (set TAURI_SIGNING_PRIVATE_KEY before build:nsis)"
}

$signature = (Get-Content $sigFile -Raw).Trim()
if ([string]::IsNullOrWhiteSpace($signature)) {
  throw "Signature file is empty: $sigFile"
}

$releaseNotes = if ($Notes) { $Notes } else { "RebornPOS $Version" }
$manifest = @{
  version = $Version
  notes = $releaseNotes
  pub_date = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  platforms = @{
    "windows-x86_64" = @{
      signature = $signature
      url = "$DownloadBaseUrl/reborn-pos-setup.exe"
    }
  }
}

$json = $manifest | ConvertTo-Json -Depth 6
$parent = Split-Path $OutputPath -Parent
if ($parent -and -not (Test-Path $parent)) {
  New-Item -ItemType Directory -Force -Path $parent | Out-Null
}
Set-Content -Encoding utf8 -Path $OutputPath -Value $json
Write-Host "Wrote updater manifest: $OutputPath"
