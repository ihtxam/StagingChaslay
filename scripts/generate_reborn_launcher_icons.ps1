# Generate Reborn Android launcher + in-app logo drawables from white PNG logo.
Add-Type -AssemblyName System.Drawing

$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path "$Root\assets\reborn_logo_white.png")) {
    $Root = Split-Path $PSScriptRoot -Parent
}
$Source = Join-Path $Root "assets\reborn_logo_white.png"
$Res = Join-Path $Root "app\src\main\res"
$Drawable = Join-Path $Res "drawable"
New-Item -ItemType Directory -Force -Path $Drawable | Out-Null

$Burgundy = [System.Drawing.Color]::FromArgb(255, 0x80, 0x00, 0x20)
$Transparent = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)

function New-SquareCanvas([int]$size, [System.Drawing.Color]$bg) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear($bg)
    return @{ Bitmap = $bmp; Graphics = $g }
}

function Fit-Logo([System.Drawing.Image]$logo, [int]$canvasSize, [double]$padRatio) {
    $pad = [int]($canvasSize * $padRatio)
    $inner = $canvasSize - (2 * $pad)
    $scale = [Math]::Min($inner / $logo.Width, $inner / $logo.Height)
    $w = [int]($logo.Width * $scale)
    $h = [int]($logo.Height * $scale)
    $x = ($canvasSize - $w) / 2
    $y = ($canvasSize - $h) / 2
    return @{ X = $x; Y = $y; W = $w; H = $h }
}

$logo = [System.Drawing.Image]::FromFile($Source)

# In-app hero logo (transparent background)
$appLogo = New-SquareCanvas 512 $Transparent
$fit = Fit-Logo $logo 512 0.08
$appLogo.Graphics.DrawImage($logo, $fit.X, $fit.Y, $fit.W, $fit.H)
$appLogoPath = Join-Path $Drawable "reborn_logo_white.png"
$appLogo.Bitmap.Save($appLogoPath, [System.Drawing.Imaging.ImageFormat]::Png)
$appLogo.Graphics.Dispose(); $appLogo.Bitmap.Dispose()

# Adaptive icon foreground (transparent, more padding)
$fg = New-SquareCanvas 512 $Transparent
$fitFg = Fit-Logo $logo 512 0.18
$fg.Graphics.DrawImage($logo, $fitFg.X, $fitFg.Y, $fitFg.W, $fitFg.H)
$fgPath = Join-Path $Drawable "ic_launcher_foreground.png"
$fg.Graphics.Dispose()
$fg.Bitmap.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
$fg.Bitmap.Dispose()

# Legacy-style full icon (burgundy + logo) for notifications / fallback
$full = New-SquareCanvas 512 $Burgundy
$fitFull = Fit-Logo $logo 512 0.12
$full.Graphics.DrawImage($logo, $fitFull.X, $fitFull.Y, $fitFull.W, $fitFull.H)
$fullPath = Join-Path $Drawable "ic_launcher_full.png"
$full.Graphics.Dispose()
$full.Bitmap.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)
$full.Bitmap.Dispose()

$mipmapSizes = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}
foreach ($folder in $mipmapSizes.Keys) {
    $px = $mipmapSizes[$folder]
    $outDir = Join-Path $Res $folder
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    $icon = New-SquareCanvas $px $Burgundy
    $f = Fit-Logo $logo $px 0.12
    $icon.Graphics.DrawImage($logo, $f.X, $f.Y, $f.W, $f.H)
    $icon.Graphics.Dispose()
    $out = Join-Path $outDir "ic_launcher.png"
    $icon.Bitmap.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $icon.Bitmap.Save((Join-Path $outDir "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $icon.Bitmap.Dispose()
    Write-Host "Wrote $folder ($px px)"
}

$logo.Dispose()
Write-Host "Done. Drawables in $Drawable"
