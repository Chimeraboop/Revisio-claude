# Convertit une photo HEIC (iPhone) en JPEG d'au plus 2000 px de côté, avec le décodeur d'images de Windows
# (extension « HEIF Image Extensions » de Microsoft, présente sur la plupart des PC Windows 10 et 11).
#   powershell -NoProfile -ExecutionPolicy Bypass -File heic-en-jpeg.ps1 <source.heic> <cible.jpg>
param([string]$Source, [string]$Cible)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName PresentationCore
$entree = [IO.File]::OpenRead($Source)
try {
    $decodeur = [Windows.Media.Imaging.BitmapDecoder]::Create($entree, "None", "OnLoad")
    $image = $decodeur.Frames[0]
    $cote = [Math]::Max($image.PixelWidth, $image.PixelHeight)
    if ($cote -gt 2000) {
        $echelle = 2000 / $cote
        $image = New-Object Windows.Media.Imaging.TransformedBitmap($image, (New-Object Windows.Media.ScaleTransform($echelle, $echelle)))
    }
    $encodeur = New-Object Windows.Media.Imaging.JpegBitmapEncoder
    $encodeur.QualityLevel = 85
    $encodeur.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($image))
    $sortie = [IO.File]::Create($Cible)
    try { $encodeur.Save($sortie) } finally { $sortie.Close() }
} finally {
    $entree.Close()
}
