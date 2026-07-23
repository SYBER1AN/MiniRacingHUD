# PLAN-GIT.md — Перевод проекта в Git

## Решения

| Вопрос | Решение |
|--------|---------|
| Ветка по умолчанию | `main` |
| Коммитить `build/` | **нет** (пересобирается `build.ps1`) |
| Удалённый репозиторий | **пока нет** (только локальный git) |
| `Themes/` | **включить** (используется в C#) |
| `Icons/` | **исключить** |
| Корневая `presets/` | **исключить** (пустая, не используется) |
| `MiniRacingHUD.ai` | **исключить** (бинарный редакторский артефакт) |
| `MiniRacingHUD.png`, `MiniRacingHUD.svg` | **исключить** (не используются в коде) |
| `.opencode/` | **исключить** (конфигурация OpenCode) |
| `*.code-workspace` | **исключить** (VS Code workspace) |

## `.gitignore`

```gitignore
# .NET
bin/
obj/
*.user
*.suo

# Visual Studio
.vs/

# Сборка (генерируется build.ps1)
build/

# Иконки
Icons/

# Adobe Illustrator
*.ai

# Логотипы (не используются в коде)
MiniRacingHUD.png
MiniRacingHUD.svg

# Документация, не для GitHub
CHANGELOG.md
PROJECT.md
AGENTS.md
GIT.md

# OpenCode
.opencode/

# VS Code
*.code-workspace

# Личные пресеты (не для GitHub)
src/presets/

# Dev-утилиты (не для GitHub)
backup.ps1
unpackHTML.ps1
migrate_presets.ps1

# Мусор
Новый текстовый документ.txt
*.bak*
*.backup
*.log
*.tmp
```

## Файлы, входящие в репозиторий

| Категория | Файлы |
|-----------|-------|
| C# (ядро) | `.cs`, `.xaml`, `.csproj` |
| C# (окна) | `ColorEditorWindow.xaml(.cs)`, `ThemeEditorWindow.xaml(.cs)`, `ColorPicker.xaml(.cs)`, `BaseDialogWindow.xaml(.cs)`, `NewThemeDialog.xaml(.cs)`, `AddGameDialog.xaml(.cs)`, `InputField.xaml(.cs)`, `TelemetryWindow.xaml(.cs)` |
| C# (общее) | `ColorEditorShared.xaml(.cs)`, `BlockPanel.xaml.cs`, `VisualTreeHelperEx.cs`, `DirectInputReader.cs`, `LocalizationManager.cs`, `LocExtension.cs` |
| Ресурсы | `Properties/Resources.resx`, `Properties/Resources.Designer.cs`, `Properties/Resources.ru.resx`, `Properties/Resources.en.resx` |
| Telemetry | `Telemetry/*.cs` |
| JS | `src/js/*.js`, `src/NoApp.js` (кроме `src/presets/`) |
| CSS | `src/css/*.css`, `src/css/bg.png` |
| HTML | `src/MiniRacingHUD.html` |
| Темы | `Themes/MinimalistTheme.xaml` |
| Документация | `README.md` |
| Скрипты | `build.ps1`, `build.bat` |
| Ресурсы | `MiniRacingHUD.ico` |


## Шаги

1. Создать `.gitignore` с содержимым выше
2. `git init`
3. `git add .`
4. `git commit -m "Initial commit"`
5. `git branch -M main`
