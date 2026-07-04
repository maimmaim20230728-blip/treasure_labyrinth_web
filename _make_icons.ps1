# 宝の迷宮 - アイコン/OG画像の生成（System.Drawing）
Add-Type -AssemblyName System.Drawing
$root = 'C:\Users\puipu\treasure_labyrinth'
New-Item -ItemType Directory -Force "$root\icons" | Out-Null

function New-Brush([string]$hex) {
  New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function Draw-Icon([int]$size, [string]$out) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'None'
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#141628'))
  $u = $size / 16.0
  $wall = New-Brush '#3a3f6e'
  # 外周の壁
  $g.FillRectangle($wall, [float]$u, [float]$u, [float]($size - 2 * $u), [float]$u)
  $g.FillRectangle($wall, [float]$u, [float]($size - 2 * $u), [float]($size - 2 * $u), [float]$u)
  $g.FillRectangle($wall, [float]$u, [float]$u, [float]$u, [float]($size - 2 * $u))
  $g.FillRectangle($wall, [float]($size - 2 * $u), [float]$u, [float]$u, [float]($size - 2 * $u))
  # 内壁
  $g.FillRectangle($wall, [float](3 * $u), [float](3 * $u), [float](7 * $u), [float]$u)
  $g.FillRectangle($wall, [float](12 * $u), [float](3 * $u), [float]$u, [float](6 * $u))
  $g.FillRectangle($wall, [float](3 * $u), [float](6 * $u), [float]$u, [float](7 * $u))
  $g.FillRectangle($wall, [float](6 * $u), [float](12 * $u), [float](7 * $u), [float]$u)
  # 宝箱（中央）
  $brown = New-Brush '#8a5a2e'
  $gold = New-Brush '#f5c542'
  $g.FillRectangle($brown, [float](5.5 * $u), [float](6.5 * $u), [float](5 * $u), [float](3.2 * $u))
  $g.FillRectangle($gold, [float](5.5 * $u), [float](5.6 * $u), [float](5 * $u), [float](1.4 * $u))
  $g.FillRectangle($gold, [float](7.7 * $u), [float](6.5 * $u), [float](0.7 * $u), [float](3.2 * $u))
  # キャラ2人（青・赤）
  $g.FillRectangle((New-Brush '#3b6fd6'), [float](3.6 * $u), [float](10.6 * $u), [float](1.6 * $u), [float](1.6 * $u))
  $g.FillRectangle((New-Brush '#e0526b'), [float](11.0 * $u), [float](10.6 * $u), [float](1.6 * $u), [float](1.6 * $u))
  $g.Dispose()
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
Draw-Icon 512 "$root\icons\icon-512.png"
Draw-Icon 192 "$root\icons\icon-192.png"

# OG画像（3:2・Farcaster埋め込みにも流用）
$W = 1200; $H = 800
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#141628'))
$wall = New-Brush '#2a2e56'
for ($i = 0; $i -lt 12; $i++) {
  $g.FillRectangle($wall, [float](($i * 173) % 1100), [float](($i * 271) % 700), [float](40 + ($i * 37) % 260), [float]18)
}
$gold = New-Brush '#f5c542'
$brown = New-Brush '#8a5a2e'
$g.FillRectangle($brown, 880, 430, 220, 140)
$g.FillRectangle($gold, 880, 390, 220, 60)
$g.FillRectangle($gold, 975, 430, 30, 140)
$f1 = New-Object System.Drawing.Font('Yu Gothic UI', 96, [System.Drawing.FontStyle]::Bold)
$f2 = New-Object System.Drawing.Font('Yu Gothic UI', 34, [System.Drawing.FontStyle]::Regular)
$g.DrawString('宝の迷宮', $f1, $gold, 80, 300)
$g.DrawString('TREASURE LABYRINTH', $f2, [System.Drawing.Brushes]::White, 86, 470)
$g.DrawString('なぞって すすむ ドットめいろ', $f2, [System.Drawing.Brushes]::White, 86, 540)
$g.Dispose()
$bmp.Save("$root\og.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output '生成完了'
Get-ChildItem "$root\icons\*.png", "$root\og.png" | Select-Object Name, Length
