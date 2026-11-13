<img width="785" height="279" alt="MiniRacingHUD-scr" src="https://github.com/user-attachments/assets/a82351b0-6997-440f-a345-828680681da8" />

# Mini Racing HUD v1.0.1.268

## RU

Минималистичный, полностью настраиваемый HUD для стримов гоночных симуляторов.

### Системные требования

- Windows 10/11
- [.NET 10 Runtime](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) (Включено в self-contained, потому и такой размер сборки)
### Возможности

- Отображение руля, педалей, КПП, перегрузок (G-meter), графиков
- Настройка через обычный браузер (минимальная версия с Gamepad API) или приложение
- Оптимизация в приоритете: переиспользование объектов, минимум аллокаций
- Телеметрия: Dirt Rally 2.0, Automobilista 2, BeamNG.drive, Assetto Corsa Rally, ATS, ETS2 (постараюсь расширять список)
- Автоматическое переключение игры по запущенному процессу
- Возможность добавлять свои игры и создавать пресеты для них, но без телеметрии
- Поддержка рулей, педалей, джойстиков и геймпадов (Gamepad API или DirectInput)
- Для ручника добавлена поддержка клавиатуры (глобальный хук в app-режиме)
- Индикаторы передач с режимами H/L (ETS2/ATS) и автоподстройкой под КПП
- Система пресетов и мультипресетов (несколько отдельных виджетов в одном пресете)
- Таблица итога СУ из лаунчера TVD Rally (https://tvdrally.online/): результаты этапа, своя позиция и отставание
- Автообновление: проверка новой версии при запуске, показ изменений и установка с перезапуском
- Поддержка тем, в том числе кастомных + встроенный редактор тем
- Русский и английский язык интерфейса
- Русский, английский и китайский язык виджета

### Поддерживаемые игры и порты по умолчанию

- Dirt Rally 2.0 — Port: 20777
- Automobilista 2 — Port: 5606
- BeamNG.drive — Port: 4444
- Assetto Corsa Rally — Shared Memory
- ATS/ETS2 — Shared Memory

### Быстрый старт

1. Распакуйте архив, запустите `MiniRacingHUD.exe` и выберите игру
2. Настройте оси/кнопки через интерфейс виджета и сохраните пресет
3. Откройте `file:///путь_к_файлу/MiniRacingHUD.html` в источнике "Браузер" в OBS (в C#-режиме нажмите «Копировать URL» в приложении)
4. Если нужно, измените порт для телеметрии

p.s.: Если вы не видите панель настройки, увеличьте высоту окна и она появится ☝️😉

### Настройка телеметрии

**Dirt Rally 2.0** — UDP, встроено в игру.
Если порт 20777 занят, измените его на другой, например 20778: 
- В `Документы\My Games\DiRT Rally 2.0\hardwaresettings\hardware_settings_config.xml`
добавить в блок `motion_platform`:
```
<udp extradata="3" ip="127.0.0.1" delay="1" port="20778" enabled="true" />
```
- Изменить порт в приложении на 20778

**TVD Rally** — если запущен лаунчер TVD Rally, поддерживается своя кастомная таблица результатов.

**BeamNG.drive** — базовая телеметрия (педали, руль, КПП, ручник) доступна без мода.
Для правильной работы индикатора передач (P, R, N, D, S1, M1...) и G-meter:
- Включить в игре: Настройки → Прочее → UDP-протокол OutGauge и UDP-протокол MotionSim. Порт 4444.
- Скачать [MiniRacingHUD-BeamNG-mod.zip](https://github.com/SYBER1AN/MiniRacingHUD/releases/tag/beamng-mod-v1.0) и положить в папку модов BeamNG.

**ETS2 / ATS** — для работы телеметрии требуется плагин
[SCS Telemetry SDK](https://github.com/RenCloud/scs-sdk-plugin/releases).
- Создать в папке `bin\win_x64` игры (рядом с `eurotrucks2.exe` / `amtrucks.exe`) папку `plugins`, если её нет.
- Положить `scs-telemetry.dll` в `bin\win_x64\plugins`.

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
### Features

- Displays steering wheel, pedals, gearbox, G-meter, graphs
- Customizable via browser (lite version with Gamepad API) or the app
- Object pooling, minimal allocations — optimization was a priority
- Telemetry: Dirt Rally 2.0, Automobilista 2, BeamNG.drive, Assetto Corsa Rally, ATS, ETS2 (more to come)
- Auto-detect game by running process
- Add your own games with custom presets (telemetry not available)
- Supports wheels, pedals, joysticks and gamepads (Gamepad API or DirectInput)
- Assignable keyboard keys for handbrake (global hook in app mode)
- Gear indicator with H/L modes (ETS2/ATS) and auto layouts
- Presets and multi-presets (multiple widget layouts in one preset)
- Stage-results table from the TVD Rally launcher (https://tvdrally.online/): stage results, your position and gap
- Auto-update: checks for a new version at startup, shows the changes and installs with a restart
- Theme system with custom themes + built-in theme editor
- Interface language: Russian, English
- Widget language: Russian, English, Chinese

### Supported Games and Default Ports

- Dirt Rally 2.0 — Port: 20777
- Automobilista 2 — Port: 5606
- BeamNG.drive — Port: 4444
- Assetto Corsa Rally — Shared Memory
- ATS/ETS2 — Shared Memory

### Quick Start

1. Extract the archive, run `MiniRacingHUD.exe` and select your game
2. Bind axes/buttons via the widget UI and save the preset
3. Open `file:///path_to_file/MiniRacingHUD.html` as a Browser source in OBS (in C# mode click "Copy URL" in the app)
4. Change telemetry port if needed

p.s.: If you don't see the settings panel, increase the window height and it will appear ☝️😉

### Telemetry Setup

**Dirt Rally 2.0** — UDP, built-in.
If port 20777 is already in use, open `Documents\My Games\DiRT Rally 2.0\hardwaresettings\hardware_settings_config.xml`
and add this line inside the `motion_platform` block:
```
<udp extradata="3" ip="127.0.0.1" delay="1" port="20778" enabled="true" />
```

**TVD Rally** — if the TVD Rally launcher is running, its own custom results table is supported.

**BeamNG.drive** — basic telemetry (pedals, steering, gear, handbrake) works without a mod.
For gear indicator (P, R, N, D, S1, M1...) and G-meter:
- Enable in-game: Options → Misc → OutGauge and MotionSim UDP protocols. Port 4444.
- Download [MiniRacingHUD-BeamNG-mod.zip](https://github.com/SYBER1AN/MiniRacingHUD/releases/tag/beamng-mod-v1.0) and place into BeamNG's mods folder.

**ETS2 / ATS** — requires the
[SCS Telemetry SDK](https://github.com/RenCloud/scs-sdk-plugin/releases) plugin.
- Create a `plugins` folder inside the game's `bin\win_x64` (next to `eurotrucks2.exe` / `amtrucks.exe`) if it doesn't exist.
- Place `scs-telemetry.dll` into `bin\win_x64\plugins`.

### Download latest version

https://github.com/SYBER1AN/MiniRacingHUD/releases/latest

### Author: SYBER1AN

- https://t.me/SYBER1AN
- https://www.youtube.com/c/SYBER1AN
- https://live.vkvideo.ru/SYBER1AN
