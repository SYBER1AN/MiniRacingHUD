# Полный анализ нагрузки на ЦП — Mini Racing HUD

> **Дата:** июль 2026
> **Цель:** Выявить все источники нагрузки на процессор во всех сценариях работы

---

## Термины

- **Сценарий «Idle»** — приложение открыто, игра НЕ запущена, телеметрия НЕ активна, геймпады НЕ подключены, DI-режим ВЫКЛЮЧЕН.
- **Сценарий «DI ON»** — DirectInput-режим ВКЛЮЧЕН, есть подключённые геймпады/рули.
- **Сценарий «Game ON»** — игра запущена, телеметрия подключена, данные передаются.
- **Сценарий «Full»** — всё вместе: игра + DI-режим + окно телеметрии + клавиатурный ручник.

---

## 1. Основной игровой цикл JavaScript ⚠️

| Свойство | Значение |
|----------|----------|
| **Файл** | `src/js/core.js:2374` |
| **Тип** | `setInterval` |
| **Интервал** | **16.67 мс (60 Гц)** |
| **Сценарий** | **Всегда** (включая Idle) |
| **Нагрузка** | 🔴 **ВЫСОКАЯ** |

Выполняется каждый тик (строки 2133–2371) — полный разбор по подзадачам:

### 1.1. Опрос устройств (строки 2137–2160)

```js
const hasAnyBinding = checkAnyBinding();
const rawDevices = hasAnyBinding ? navigator.getGamepads() : [];
```

- `navigator.getGamepads()` — **вызывается всегда**, даже без биндингов.
- В DI-режиме: итерация `_diDevices` (от C#).

**На Idle:** `hasAnyBinding === false`, массив пуст — но API-вызов всё равно происходит.

### 1.2. Проверка таймаута UDP (строки 2165–2183)

```js
if (performance.now() - udpState.lastDataTime > 2000) { ... }
```

- `performance.now()` — каждый кадр.
- На Idle: `lastDataTime = 0`, условие `true`, но внутри проверка `speed !== 0` — сброс не происходит.

### 1.3. Определение видности (строки 2186–2212)

Вычисление 9+ булевых флагов:
- `showWheel`, `showThrottle`, `showBrake`, `showClutch`, `showHandbrake`, `showGear`, `showGmeter`
- Плюс вызов `window.MultiWidget.isVisible()` для каждого элемента — поиск в конфиге/слотах.

**На Idle:** все `false`, но вычисления выполняются полностью.

### 1.4. Переключение классов DOM (строки 2224–2238)

```js
toggleClass('.some-widget', 'hidden', !showXxx);
toggleClass('.some-widget', 'visible', showXxx);
toggleClass('.some-widget', 'no-data', ...);
```

- До 7 элементов × 2–3 `classList.toggle()` = до **21 операции** с DOM.
- Каждая может триггерить пересчёт стилей (reflow).

### 1.5. Чтение значений (строки 2241–2312)

- Руль: UDP → `readAxisRaw()` (поиск по индексам осей геймпада).
- Педали: UDP → `readAxisRaw()`.
- Ручник: ось + кнопки + клавиатура + UDP.
- Передача: разветвление по 5 протоколам (DR2/AMS2/BeamNG/ETS2/default).

**На Idle:** все возвращают `null`, но логика ветвления выполняется.

### 1.6. Преобразование процентов (строки 2314–2325)

```js
throttlePct = getPedalPercent(rawThrottle, ...);
brakePct   = getPedalPercent(rawBrake, ...);
clutchPct  = getPedalPercent(rawClutch, ...);
handbrakePct = getPedalPercent(rawHandbrake, ...);
```

- На Idle: передаются `null`, возвращают 0.

### 1.7. Запись истории графиков (строки 2328–2340)

- Пропускается, если `anyGraphActive === false`.

**На Idle:** не выполняется (графы по умолч. выкл).

### 1.8. Рендер (строки 2342–2355)

| Функция | Строка | Guard | На Idle |
|---------|--------|-------|---------|
| `renderSteeringWheel(rawAxis)` | 2343 | `if (rawAxis === null \|\| !DOM.wheel) return;` | выход |
| `renderGearDisplay(gear)` | 2344 | `if (!gear \|\| _lastRenderedGear === gear) return;` | выход |
| `syncGearRotation(rawAxis)` | 2345 | по кэшу `_lastGearTransform*` | выход |
| `renderPedals('throttle', ...)` | 2346 | — | `scaleX(0)` |
| `renderPedals('brake', ...)` | 2347 | — | `scaleX(0)` |
| `renderPedals('clutch', ...)` | 2348 | — | `scaleX(0)` |
| `renderPedals('handbrake', ...)` | 2349 | — | `scaleX(0)` |
| `renderGmeterTrail()` | 2354 | `if (!_trailDirty) return;` | выход |

**На Idle:** почти все guard'ы срабатывают, но:
- `renderPedals` — всегда выполняет полный код (нет guard по значению).
- `renderSteeringWheel` — guard null срабатывает, но функция вызвана.

### 1.9. Определение изменения лайаута (строки 2358–2362)

```js
const hash = `${showWheel}-${showHandbrake}-${showGear}-...`;
if (hash !== _lastLayoutHash) { updateWidgetDimensions(); _lastLayoutHash = hash; }
```

- Конкатенация строк + сравнение — каждый кадр.

### 1.10. Рендер графиков (строки 2365–2368)

```js
if (anyGraphActive && Date.now() - lastGraphTime >= GRAPH_FRAME_DELAY) { ... }
```

- `Date.now()` — каждый кадр.
- На Idle: `anyGraphActive === false` → пропуск.

---

## 2. JavaScript: Таймер автосканирования устройств

| Свойство | Значение |
|----------|----------|
| **Файл** | `src/js/core.js:2707` |
| **Тип** | `requestAnimationFrame` |
| **Интервал** | ~16.67 мс (эффективно **30 Гц** через throttle) |
| **Сценарий** | Только при захвате оси/кнопки |
| **Нагрузка** | 🟢 НИЗКАЯ (только при вводе) |

---

## 3. JavaScript: Таймер переподключения WebSocket

| Свойство | Значение |
|----------|----------|
| **Файл** | `src/js/core.js:932` |
| **Тип** | `setTimeout` (эксп. бэкофф 1–30 с) |
| **Сценарий** | Только при потере соединения |
| **Нагрузка** | 🟢 НИЧТОЖНАЯ |

---

## 4. C#: Broadcast Timer (`_broadcastTimer`)

| Свойство | Значение |
|----------|----------|
| **Файл** | `MainWindow.xaml.cs:1358-1362` |
| **Тип** | `System.Threading.Timer` |
| **Интервал** | **16 мс (~62.5 Гц)** |
| **Сценарий** | Только когда `_isRunning == true` (телеметрия активна) |
| **Нагрузка** | 🟡 **НИЗКАЯ** |

**Работа за тик:**
1. `Interlocked.Exchange(ref _broadcastTickBusy, 1)` — guard реентерабельности
2. `provider.ReadReduced()` — чтение из буфера под блокировкой + парсинг
3. Если `_dataReceived == false` → `Dispatcher.Invoke` → статус, return
4. Если первые данные → `OnFirstData()` → `Dispatcher.Invoke` → статус
5. Сериализация `Dictionary<string, object>` в JSON
6. `client.Send(json)` на каждый WebSocket-клиент (с `ContinueWith` очистки ошибок)

**На Idle:** не запущен (телеметрия не активна).

---

## 5. C#: DirectInput Poll Timer (`_diPollTimer`)

| Свойство | Значение |
|----------|----------|
| **Файл** | `MainWindow.xaml.cs:973-978` |
| **Тип** | `System.Threading.Timer` |
| **Интервал** | **16 мс (~62.5 Гц)** |
| **Сценарий** | DI-режим ВКЛ + есть DirectInput-устройства |
| **Нагрузка** | 🟡 **УМЕРЕННАЯ** |

**Работа за тик:**
1. Guard: `_directInputReader != null && HasDevices`
2. `Interlocked.Exchange(ref _diPollTickBusy, 1)`
3. `await Task.Run(() => _directInputReader!.PollAll())` — COM-взаимодействие:
   - `ReEnumerate()` при смене устройств
   - Для каждого устройства: `Poll()`, `GetCurrentJoystickState()`, 8 осей + 128 кнопок + 4 POV
4. Сериализация `List<DirectInputDeviceState>` в JSON
5. `Dispatcher.InvokeAsync` → отправка в WebView2
6. Рассылка всем WS-клиентам

**На Idle:** не запущен (DI-режим OFF по умолчанию).

---

## 6. C#: Auto-Detect Timer

| Свойство | Значение |
|----------|----------|
| **Файл** | `MainWindow.xaml.cs:956-959` |
| **Тип** | `DispatcherTimer` |
| **Интервал** | **3000 мс** |
| **Сценарий** | **Всегда** (если чекбокс автоопределения вкл) |
| **Нагрузка** | 🟢 **НИЗКАЯ** (раз в 3 с, ~1–3 мс работы) |

**Работа за тик:**
- `Process.GetProcessesByName()` для каждого известного процесса (~8 штук)
- Если игра найдена: `SwitchGameAsync()` (остановка старого UDP, запуск нового, уведомление JS)

---

## 7. C#: UDP Receive Loop

| Свойство | Значение |
|----------|----------|
| **Файл** | `Telemetry\UdpTelemetryProviderBase.cs:67-84` |
| **Тип** | `async while` + `UdpClient.ReceiveAsync` |
| **Интервал** | Событийно — async-ожидание |
| **Сценарий** | Телеметрия активна (UDP-сокет открыт) |
| **Нагрузка** | 🟢 **НИЧТОЖНАЯ** (0 CPU в ожидании через IOCP) |

---

## 8. C#: Telemetry Window Timer

| Свойство | Значение |
|----------|----------|
| **Файл** | `TelemetryWindow.xaml.cs:58-60` |
| **Тип** | `System.Threading.Timer` |
| **Интервал** | **33 мс (~30 Гц)** |
| **Сценарий** | Открыто окно телеметрии (отладка) |
| **Нагрузка** | 🟢 **НИЗКАЯ** |

---

## 9. Windows Hooks

| Хук | Файл | Тип | Сценарий | Нагрузка |
|-----|------|-----|----------|----------|
| WndProc (`WM_DEVICECHANGE`) | `MainWindow.xaml.cs:962-964` | событие | Всегда | 🟢 Ничтожная |
| Keyboard (`WH_KEYBOARD_LL`) | `KeyboardHook.cs:18-19` | событие | Ручник на клавиши + не UDP | 🟢 Низкая |

**Keyboard Hook:** устанавливается только когда есть назначенные клавиши ручника. Обрабатывает каждое нажатие системы — маппинг VK → строка, JSON, рассылка WS.

---

## 10. WebSocket-сервер

| Свойство | Значение |
|----------|----------|
| **Файл** | `MainWindow.xaml.cs:1592-1711` |
| **Библиотека** | Fleck |
| **Тип** | Событийный (async callback) |
| **Интервал** | Нет — событийно |
| **Сценарий** | Всегда после запуска |
| **Нагрузка** | 🟢 **НИЧТОЖНАЯ** |

---

## 11. JavaScript: Event-листенеры (частые)

| Листенер | Файл | Сценарий | Нагрузка |
|----------|------|----------|----------|
| `mousemove` (drag-инверт/граф) | `core.js:1104` | Только при drag | 🟢 Низкая |
| `mousemove` (drag-to-clear) | `core.js:1160` | Только при drag | 🟢 Ничтожная |
| `wheel` (custom select) | `core.js:47` | При скролле | 🟢 Ничтожная |
| `resize` | `core.js:1497` | При ресайзе | 🟢 Ничтожная |
| `keydown` | `core.js:1498` | Всегда | 🟢 Ничтожная |
| WS `onmessage` | `core.js:747-902` | При WS-сообщениях | 🟢 Низкая |

---

## 12. Одноразовые/редкие таймеры (ничтожная нагрузка)

| Таймер | Интервал | Сценарий |
|--------|----------|----------|
| `_pageReadyFallback` | 10 с | Старт (остановка при pageReady) |
| `_statusTimer` | 4 с | Обновление статуса |
| `_copyTimer` | 1.2 с | Копирование пути |
| Config Update debounce | 150 мс | Drag слайдера |
| Cross visibility | 200 мс | Нажатие на ось |
| Status auto-hide | 2 с | Показ уведомления |
| Graph render debounce | 100 мс | Изменение графа |
| Widget size display | 50 мс | Пересчёт лайаута |
| DI mode delay | 2 с | Получение DI-устройств |
| Game start delay | 100 мс | Инициализация |
| WS init delay | 100 мс | C#-режим |

---

## Итоговая сводка

### Всегда работают (Idle)

| # | Источник | Частота | Нагрузка |
|---|----------|---------|----------|
| 1 | **JS game loop** (`setInterval` 60 Гц) | **60 Гц** | 🔴 **ВЫСОКАЯ** |
| 2 | Auto-Detect timer | 0.33 Гц | 🟢 Низкая |
| 3 | WndProc hook | событие | 🟢 Ничтожная |
| 4 | WebSocket server | событие | 🟢 Ничтожная |
| 5 | `keydown` listener | событие | 🟢 Ничтожная |

### Условно (по сценариям)

| # | Источник | Частота | Сценарий | Нагрузка |
|---|----------|---------|----------|----------|
| 6 | Broadcast timer | 62.5 Гц | Game ON | 🟡 Низкая |
| 7 | DI poll timer | 62.5 Гц | DI Mode ON | 🟡 Умеренная |
| 8 | Telemetry window | 30 Гц | Debug open | 🟢 Низкая |
| 9 | Keyboard hook | событие | Keys bound | 🟢 Низкая |
| 10 | Scanner rAF (30 Гц) | 30 Гц | Capture mode | 🟢 Низкая |

---

## Вывод

**Основной источник нагрузки — JS-цикл `setInterval` на 60 Гц в `core.js:2374`.** Он работает всегда, включая полный простой (Idle), и выполняет полный набор операций: опрос геймпадов, переключения DOM-классов, проверки видности, рендер педалей, сборку хэша лайаута. На Idle большинство guard'ов срабатывает, но вызовы функций и DOM-операции выполняются каждый кадр.

Все остальные источники либо не работают в простое, либо работают редко/событийно и дают низкую нагрузку.

### Потенциальные оптимизации

1. **Снижение FPS в простое:** Если нет данных >2 секунд — переключаться на 1-2 Гц.
2. **Убрать `navigator.getGamepads()` при отсутствии биндингов:** Сейчас вызывается, потом массив отбрасывается.
3. **Кумулятивный флаг `_domVisibilityDirty`:** Не дёргать `classList.toggle()` каждый кадр — только при изменении видимости.
4. **Guard для `renderPedals()`:** Возвращаться сразу при `pct === null || pct === 0` — сейчас вся функция выполняется для нулевых значений.
5. **Убрать `performance.now()`/`Date.now()` на каждый кадр в простое:** Использовать одно значение на кадр.