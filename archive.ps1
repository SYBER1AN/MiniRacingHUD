$csproj = "MiniRacingHUD.csproj"
$version = [regex]::Match((Get-Content $csproj -Raw), '<Version>(.+?)</Version>').Groups[1].Value
$binDir = "bin"

$sources = @(
    @{ Path = "bin\Publish"; Name = "self-contained" },
    @{ Path = "bin\PublishFD"; Name = "framework-dependent" }
)

$z7 = Get-Command "7z.exe" -ErrorAction SilentlyContinue
if (-not $z7) {
    $z7path = "C:\Program Files\7-Zip\7z.exe"
    if (Test-Path $z7path) { $z7 = Get-Item $z7path }
}
if (-not $z7) {
    $z7path = "C:\Program Files\NVIDIA Corporation\NVIDIA App\7z.exe"
    if (Test-Path $z7path) { $z7 = Get-Item $z7path }
}

foreach ($s in $sources) {
    $zipName = "MiniRacingHUD_v${version}_$($s.Name).zip"
    $zipPath = Join-Path $binDir $zipName
    $srcPath = Resolve-Path $s.Path

    if (Test-Path $zipPath) { Remove-Item $zipPath }

    if ($z7) {
        & $z7.FullName a -tzip -mx=1 -y "$zipPath" "$srcPath\*" | Out-Null
    } else {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::CreateFromDirectory(
            $srcPath,
            (Resolve-Path $binDir).Path + "\" + $zipName,
            [System.IO.Compression.CompressionLevel]::Fastest,
            $false
        )
    }

    $size = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
    Write-Host "$zipName - $size MB"
}

Write-Host "Done"