param(
    [string]$SvgPath,
    [string]$OutPath
)

[xml]$svg = Get-Content -Raw -Path $SvgPath
$ns = @{ svg = "http://www.w3.org/2000/svg" }
$paths = Select-Xml -Xml $svg -XPath "//svg:path" -Namespace $ns
$rects = Select-Xml -Xml $svg -XPath "//svg:rect" -Namespace $ns
$circles = Select-Xml -Xml $svg -XPath "//svg:circle" -Namespace $ns

$pathNodes = @()
foreach ($p in $paths) {
    $d = $p.Node.GetAttribute("d")
    if ($d) { $pathNodes += "    <path`n        android:pathData=`"$d`"`n        android:strokeColor=`"@android:color/black`"`n        android:strokeWidth=`"1.8`"`n        android:strokeLineCap=`"round`"`n        android:strokeLineJoin=`"round`"`n        android:fillColor=`"@android:color/transparent`" />" }
}
foreach ($r in $rects) {
    $x = [double]$r.Node.GetAttribute("x")
    $y = [double]$r.Node.GetAttribute("y")
    $w = [double]$r.Node.GetAttribute("width")
    $h = [double]$r.Node.GetAttribute("height")
    $rx = $r.Node.GetAttribute("rx")
    $d = "M$x,$y h$w v$h h-$w z"
    if ($rx -and [double]$rx -gt 0) {
        $d = "M$($x + [double]$rx),$y h$($w - 2*[double]$rx) a$rx,$rx 0 0 1 $rx,$rx v$($h - 2*[double]$rx) a$rx,$rx 0 0 1 -$rx,$rx h-$($w - 2*[double]$rx) a$rx,$rx 0 0 1 -$rx,-$rx v-$($h - 2*[double]$rx) a$rx,$rx 0 0 1 $rx,-$rx z"
    }
    $pathNodes += "    <path`n        android:pathData=`"$d`"`n        android:strokeColor=`"@android:color/black`"`n        android:strokeWidth=`"1.8`"`n        android:strokeLineCap=`"round`"`n        android:strokeLineJoin=`"round`"`n        android:fillColor=`"@android:color/transparent`" />"
}
foreach ($c in $circles) {
    $cx = [double]$c.Node.GetAttribute("cx")
    $cy = [double]$c.Node.GetAttribute("cy")
    $cr = [double]$c.Node.GetAttribute("r")
    $pathNodes += "    <path`n        android:pathData=`"M$cx,$($cy - $cr) a$cr,$cr 0 1 0 0,$($cr * 2) a$cr,$cr 0 1 0 0,-$($cr * 2)`"`n        android:strokeColor=`"@android:color/black`"`n        android:strokeWidth=`"1.8`"`n        android:strokeLineCap=`"round`"`n        android:strokeLineJoin=`"round`"`n        android:fillColor=`"@android:color/transparent`" />"
}

$body = $pathNodes -join "`n"
$content = @"
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
$body
</vector>
"@

New-Item -ItemType Directory -Force -Path (Split-Path $OutPath) | Out-Null
Set-Content -Path $OutPath -Value $content -Encoding UTF8
