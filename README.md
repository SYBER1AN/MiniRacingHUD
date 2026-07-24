<img width="785" height="279" alt="MiniRacingHUD-scr" src="https://github.com/user-attachments/assets/a82351b0-6997-440f-a345-828680681da8" />

# Mini Racing HUD v1.0.0.214

## RU

Минималистичный, полностью настраиваемый HUD для стримов гоночных симуляторов.

### Системные требования

- Windows 10/11
- [.NET 10 Runtime](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) (Включено в self-contained)
- Edge WebView2 (обычно уже установлен)

### Возможности

- Отображение руля, педалей, КПП, перегрузок (G-meter), графиков
- Настройка через обычный браузер (минимальная версия с Gamepad API) или приложение
- Оптимизация в приоритете: переиспользование объектов, минимум аллокаций
- UDP-телеметрия: Dirt Rally 2.0, Automobilista 2, BeamNG.drive, Assetto Corsa Rally (постараюсь расширять список)
- Автоматическое переключение игры по запущенному процессу
- Возможность добавлять свои игры и создавать пресеты для них, но без телеметрии
- Поддержка рулей, педалей, джойстиков и геймпадов (Gamepad API или DirectInput)
- Поддержка тем, в том числе кастомных + встроенный редактор тем
- Система пресетов и мультипресетов (несколько отдельных виджетов в одном пресете)
- Русский и английский язык интерфейса
- Русский, английский и китайский язык виджета

### Поддерживаемые игры

- Dirt Rally 2.0 — Port: 20777
- Automobilista 2 — Port: 5606
- BeamNG.drive — Port: 4444
- Assetto Corsa Rally — Shared Memory

### Быстрый старт

1. Распакуйте архив, запустите `MiniRacingHUD.exe` и выберите игру
2. Настройте оси/кнопки через интерфейс виджета и сохраните пресет
3. Откройте `file:///путь_к_файлу/MiniRacingHUD.html` в источнике "Браузер" в OBS (в C#-режиме нажмите «Копировать URL» в приложении)
4. Если нужно, измените порт для телеметрии

p.s.: Если вы не видите панель настройки, увеличьте высоту окна и она появится ☝️😉

### Настройка телеметрии DR2

В `Документы\My Games\DiRT Rally 2.0\hardwaresettings\hardware_settings_config.xml`
в блоке `motion_platform` добавить строку, если порт 20777 уже используется:
```
<udp extradata="3" ip="127.0.0.1" delay="1" port="20778" enabled="true" />
```

### Скачать последнюю версию

https://github.com/SYBER1AN/MiniRacingHUD/releases/latest

### Автор: SYBER1AN

- https://t.me/SYBER1AN
- https://www.youtube.com/c/SYBER1AN
- https://live.vkvideo.ru/SYBER1AN

---

## EN

Minimalistic fully customizable HUD for simracing streams.

### System Requirements

- Windows 10/11
- [.NET 10 Runtime](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) (Included in self-contained)
- Edge WebView2 (usually pre-installed)

### Features

- Displays steering wheel, pedals, gearbox, G-meter, graphs
- Customizable via browser (lite version with Gamepad API) or the app
- Object pooling, minimal allocations — optimization was a priority
- UDP telemetry: Dirt Rally 2.0, Automobilista 2, BeamNG.drive, Assetto Corsa Rally (more to come)
- Auto-detect game by running process
- Add your own games with custom presets (telemetry not available)
- Supports wheels, pedals, joysticks and gamepads (Gamepad API or DirectInput)
- Theme system with custom themes + built-in theme editor
- Presets and multi-presets (multiple widget layouts in one preset)
- Interface language: Russian, English
- Widget language: Russian, English, Chinese

### Supported Games

- Dirt Rally 2.0 — Port: 20777
- Automobilista 2 — Port: 5606
- BeamNG.drive — Port: 4444
- Assetto Corsa Rally — Shared Memory

### Quick Start

1. Extract the archive, run `MiniRacingHUD.exe` and select your game
2. Bind axes/buttons via the widget UI and save the preset
3. Open `file:///path_to_file/MiniRacingHUD.html` as a Browser source in OBS (in C# mode click "Copy URL" in the app)
4. Change telemetry port if needed

p.s.: If you don't see the settings panel, increase the window height and it will appear ☝️😉

### DR2 Telemetry Setup

Open `Documents\My Games\DiRT Rally 2.0\hardwaresettings\hardware_settings_config.xml`,
add this line inside the `motion_platform` block if port 20777 is already in use:
```
<udp extradata="3" ip="127.0.0.1" delay="1" port="20778" enabled="true" />
```

### Download latest version

https://github.com/SYBER1AN/MiniRacingHUD/releases/latest

### Author: SYBER1AN

- https://t.me/SYBER1AN
- https://www.youtube.com/c/SYBER1AN
- https://live.vkvideo.ru/SYBER1AN
