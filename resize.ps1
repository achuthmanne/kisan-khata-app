Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile("c:\Users\hp\reactprojects\agri-snap\assets\images\logo.png")
$thumb = $img.GetThumbnailImage(130, 160, $null, [intptr]::Zero)
$thumb.Save("c:\Users\hp\reactprojects\agri-snap\assets\images\logo-small.png", [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
$thumb.Dispose()
$bytes = [System.IO.File]::ReadAllBytes("c:\Users\hp\reactprojects\agri-snap\assets\images\logo-small.png")
$base64 = [System.Convert]::ToBase64String($bytes)
$content = "export const LOGO_BASE64 = 'data:image/png;base64," + $base64 + "';"
[System.IO.File]::WriteAllText("c:\Users\hp\reactprojects\agri-snap\constants\logoBase64.ts", $content)
