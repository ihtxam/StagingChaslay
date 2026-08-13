# Fixes Android Studio "Module not specified" by resetting IDE state and warming Gradle.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $root "..")

$jdk17 = "C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot"
if (-not (Test-Path $jdk17)) {
    Write-Host "JDK 17 not found at $jdk17"
    Write-Host "Install with: winget install Microsoft.OpenJDK.17"
    exit 1
}

$env:JAVA_HOME = $jdk17
$env:PATH = "$jdk17\bin;$env:PATH"

$sdk = "$env:LOCALAPPDATA\Android\Sdk"
if (-not (Test-Path $sdk)) {
    Write-Host "Android SDK not found at $sdk — install via Android Studio SDK Manager."
    exit 1
}

if (-not (Test-Path "local.properties")) {
    $escaped = $sdk -replace '\\', '\\'
    "sdk.dir=$escaped" | Set-Content -Encoding ASCII "local.properties"
    Write-Host "Created local.properties"
}

# Remove stale IDE state that forces Embedded JDK 25 and blocks Gradle sync.
$workspace = ".idea\workspace.xml"
if (Test-Path $workspace) {
    Remove-Item $workspace -Force
    Write-Host "Removed .idea/workspace.xml (was forcing Embedded JDK 25)"
}

Write-Host "Running Gradle sync warm-up..."
.\gradlew.bat :app:tasks --no-daemon | Out-Null
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Done. Now in Android Studio:"
Write-Host "  1. Close Android Studio completely"
Write-Host "  2. Re-open folder: $((Get-Location).Path)"
Write-Host "  3. File -> Sync Project with Gradle Files"
Write-Host "  4. Settings -> Build Tools -> Gradle -> Gradle JDK -> JDK 17 (Microsoft)"
Write-Host "  5. Run the 'app' configuration"
