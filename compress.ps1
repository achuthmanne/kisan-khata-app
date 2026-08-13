Add-Type -AssemblyName System.Drawing

$dir = "c:\Users\hp\reactprojects\kisan khata\assets\images"
$files = Get-ChildItem -Path $dir -Filter "*.png" | Where-Object { $_.Length -gt 2MB }

foreach ($file in $files) {
    Write-Host "Processing $($file.Name) - size: $([math]::Round($file.Length / 1MB, 2)) MB"
    $imgPath = $file.FullName
    $img = [System.Drawing.Image]::FromFile($imgPath)
    
    # Calculate new size (max width 800)
    $ratio = 800.0 / $img.Width
    if ($ratio -ge 1) {
        $img.Dispose()
        continue
    }
    
    $newWidth = 800
    $newHeight = [int]($img.Height * $ratio)
    
    $bmp = New-Object System.Drawing.Bitmap($newWidth, $newHeight)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.DrawImage($img, 0, 0, $newWidth, $newHeight)
    
    $img.Dispose()
    $g.Dispose()
    
    # Save as PNG
    $tempPath = $imgPath + ".tmp"
    $bmp.Save($tempPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    
    Remove-Item -Path $imgPath -Force
    Rename-Item -Path $tempPath -NewName $file.Name
    
    $newFile = Get-Item $imgPath
    Write-Host "Finished $($file.Name) - NEW size: $([math]::Round($newFile.Length / 1MB, 2)) MB"
}
Write-Host "Compression completed."
