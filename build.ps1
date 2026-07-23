# build.ps1 - Собирает src/ в build/MiniRacingHUD.html (inline CSS+JS)
# Для разработки: открыть src/MiniRacingHUD.html напрямую (работает с отдельными файлами)
# Для OBS: запустить build.ps1 → получить build/MiniRacingHUD.html

$srcDir = "src"
$buildDir = "build"
$enc = [System.Text.UTF8Encoding]::new($false)

# Читаем части
$css  = [System.IO.File]::ReadAllText("$srcDir\css\all.css", $enc)
$cssThemes = [System.IO.File]::ReadAllText("$srcDir\css\themes.css", $enc)
$jsLocales = [System.IO.File]::ReadAllText("$srcDir\js\locales.js", $enc)
$js1  = [System.IO.File]::ReadAllText("$srcDir\js\constants.js", $enc)
$jsCars = [System.IO.File]::ReadAllText("$srcDir\js\cars.js", $enc)
$js2  = [System.IO.File]::ReadAllText("$srcDir\js\ui.js", $enc)
$jsMw = [System.IO.File]::ReadAllText("$srcDir\js\multiwidget.js", $enc)
$js3  = [System.IO.File]::ReadAllText("$srcDir\js\core.js", $enc)

# Читаем HTML-шаблон
$html = [System.IO.File]::ReadAllText("$srcDir\MiniRacingHUD.html", $enc)

# Читаем версию из .csproj
$csproj = [System.IO.File]::ReadAllText("MiniRacingHUD.csproj", $enc)
$version = [regex]::Match($csproj, '<Version>(.+?)</Version>').Groups[1].Value

# Заменяем <link> на inline <style>
$html = $html -replace '<link rel="stylesheet" href="css/all\.css">', "<style>`n$css</style>"
$html = $html -replace '<link rel="stylesheet" href="css/themes\.css">', "<style>`n$cssThemes</style>"

# Заменяем <script src="..."> на inline <script>
$html = $html -replace '<script src="js/locales\.js"></script>', "<script>`n$jsLocales</script>"
$html = $html -replace '<script src="js/constants\.js"></script>', "<script>`n$js1</script>"
$html = $html -replace '<script src="js/cars\.js"></script>', "<script>`n$jsCars</script>"
$html = $html -replace '<script src="js/ui\.js"></script>', "<script>`n$js2</script>"
$html = $html -replace '<script src="js/multiwidget\.js"></script>', "<script>`n$jsMw</script>"
$html = $html -replace '<script src="js/core\.js"></script>', "<script>`n$js3</script>"

# Подставляем версию
$html = $html -replace '__VERSION__', $version

# Сохраняем без BOM
$bytes = $enc.GetBytes($html)
[System.IO.File]::WriteAllBytes("$buildDir\MiniRacingHUD.html", $bytes)

# Пресеты не копируются при сборке

Write-Host ('Собрано: build\MiniRacingHUD.html ({0:N0} bytes)' -f $bytes.Length)
Write-Host "Для разработки: открыть src/MiniRacingHUD.html"
Write-Host "Для OBS: использовать build\MiniRacingHUD.html"

# Синхронизация версии в README.md
$readme = [System.IO.File]::ReadAllText("README.md", $enc)
$readme = $readme -replace 'v\d+\.\d+\.\d+\.\d+', "v$version"
[System.IO.File]::WriteAllText("README.md", $readme, $enc)
Write-Host "README.md: версия обновлена на v$version"
