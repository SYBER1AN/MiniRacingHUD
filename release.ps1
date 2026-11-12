# release.ps1 - сборка self-contained релиза и подготовка zip для GitHub
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$enc = [System.Text.UTF8Encoding]::new($false)

$csproj = [System.IO.File]::ReadAllText("MiniRacingHUD.csproj", $enc)
$version = [regex]::Match($csproj, '<Version>(.+?)</Version>').Groups[1].Value
$tag = "v$version"

# Проверяем, что такая метка ещё не опубликована
try {
    Invoke-RestMethod -Uri "https://api.github.com/repos/SYBER1AN/MiniRacingHUD/releases/tags/$tag" `
        -Headers @{ "User-Agent" = "MiniRacingHUD-Release" } -TimeoutSec 20 | Out-Null
    Write-Host "Релиз $tag уже существует — подними версию в MiniRacingHUD.csproj." -ForegroundColor Yellow
    exit 1
}
catch { }

Write-Host "Сборка $tag..."
dotnet publish -c Release
if ($LASTEXITCODE -ne 0) {
    Write-Host "Сборка не удалась." -ForegroundColor Red
    exit 1
}

$publishDir = (Resolve-Path "bin\Publish").Path
if (-not (Test-Path (Join-Path $publishDir "MiniRacingHUD.exe"))) {
    Write-Host "В bin\Publish нет MiniRacingHUD.exe." -ForegroundColor Red
    exit 1
}

if (Test-Path "release") { Remove-Item "release" -Recurse -Force }
$releaseDir = (New-Item -ItemType Directory "release").FullName
$zipPath = Join-Path $releaseDir "MiniRacingHUD.zip"

[System.IO.Compression.ZipFile]::CreateFromDirectory(
    $publishDir, $zipPath,
    [System.IO.Compression.CompressionLevel]::Optimal, $false)

$sizeMb = (Get-Item $zipPath).Length / 1MB
Write-Host ("Готово: {0} ({1:N1} МБ)" -f $zipPath, $sizeMb) -ForegroundColor Green
Write-Host "Перетащите этот файл в релиз: $tag"
Start-Process "https://github.com/SYBER1AN/MiniRacingHUD/releases/new?tag=$tag&title=$tag"
