# План оптимизации производительности телеметрии

> **Статус: выполнен** (коммит `e50b533` «Плавность телеметрии: рассылка по пакетам и rAF-цикл»). Все пять пунктов реализованы в `Telemetry/Providers/`; файл оставлен как запись о причине изменений.

## Исходная ситуация

`ReadReduced()` вызывается каждые 16 мс (~62.5 FPS) из `UdpBroadcastTickCore`.

| Провайдер | new Dictionary в hot path | Кэш | Лишние аллокации |
|-----------|:---:|:---:|:---:|
| DR2 | нет | ✅ `_reducedCache` | — |
| AMS2 | нет | ✅ | — |
| BeamNG | нет | ✅ | — |
| **SCS (ETS2/ATS)** | **да, 11 entry × 62.5/с** | ❌ | `new byte[64]` + `ComputeGearName()` |
| **AC Rally** | **да, 20 entry × 62.5/с** | ❌ | ReadReduced = ReadTelemetry — дубль |

## План работ

### 1. ✅ SCS — кэш словаря в reduced-пути

Файл: `Telemetry/Providers/ScsTelemetryProvider.cs`

- Добавить поле `private readonly Dictionary<string, object> _reducedCache = new(11);`
- В `DoRead(bool reduced)`: при `reduced == true` не создавать `new Dictionary(11)`, а `_reducedCache.Clear()` и перезаполнить
- При `reduced == false` — `new Dictionary(50)` (full-путь, вызывается раз в 33 мс)

### 2. ✅ SCS — переиспользовать byte[64] в ReadString

Файл: `Telemetry/Providers/ScsTelemetryProvider.cs`

- Вынести `byte[64]` в `private readonly byte[] _stringBuf = new byte[64];`
- `ReadString(long offset)` — читать в `_stringBuf` вместо `new byte[64]`

### 3. ✅ SCS — кэш ComputeGearName

Файл: `Telemetry/Providers/ScsTelemetryProvider.cs`

- Добавить поля `_lastGearInput` и `_lastGearName` (int, int, bool, bool, int, int, string → можно tuple или просто сравнение)
- Если все входные параметры совпадают — вернуть `_lastGearName` без вызова `DetectAll()`

### 4. ✅ AC Rally — разделить DoRead на reduced/full

Файл: `Telemetry/Providers/AcRallyTelemetryProvider.cs`

- Сейчас `ReadReduced()` → `DoRead()`, `ReadTelemetry()` → `DoRead()` — одно и то же
- Добавить bool параметр `reduced` в `DoRead()`
- При `reduced == true` — только 11 полей (как у SCS), + `_reducedCache`
- Reducer можно составить из полей: gameId, gear, speed, engineRate, steeringInput, throttleInput, brakeInput, clutchInput, handbrake, gearName

### 5. ✅ AC Rally — кэш словаря reduced-пути

Файл: `Telemetry/Providers/AcRallyTelemetryProvider.cs`

- Аналогично SCS: `_reducedCache.Clear()` вместо `new Dictionary(20)` каждые 16 мс

## Ожидаемый эффект

- SCS: −400 байт/тик = −25 KB/с (ген0 сборок меньше)
- SCS: −64 байт/тик = −4 KB/с (byte[])
- SCS: −один вызов DetectAll/тик (экономия CPU + LINQ)
- AC Rally: −800 байт/тик = −50 KB/с
- AC Rally: сокращение полей с 20 до ~11 в hot path

GC будет собираться реже, просадки FPS на слабых системах — менее вероятны.
