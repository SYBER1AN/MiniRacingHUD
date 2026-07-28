# Gearbox Mapping — ETS2 / ATS

## Eaton Fuller 18-speed (6-speed H-shifter, Logitech G27/G29 и аналоги)

### Селекторы

| Индекс | Название | Назначение |
|--------|----------|------------|
| `shifterToggle[0]` | Range | Lo (1‑8) / Hi (5L‑8H) |
| `shifterToggle[1]` | Splitter | L / H внутри позиции |

### Слоты H-shifter

Нумерация слотов (shifterSlot) в телеметрии SCS:

| shifterSlot | Позиция шифтера | Назначение в 18-ступке |
|-------------|-----------------|------------------------|
| 0 | Neutral | Нейтраль |
| 1 | Reverse (шифтер) | **Не используется** |
| 2 | 1-я (левый‑верх) | **Реверс** — R1L, R1H, R2L, R2H |
| 3 | 2-я (левый‑низ) | LL (Lo‑Lo), LH — **только Lo Range** |
| 4 | 3-я (середина‑верх) | **Lo Range:** 1L / **Hi Range:** 5L |
| 5 | 4-я (середина‑низ) | **Lo Range:** 1H / **Hi Range:** 5H |
| 6 | 5-я (правый‑верх) | **Lo Range:** 2L / **Hi Range:** 6L |
| 7 | 6-я (правый‑низ) | **Lo Range:** 2H / **Hi Range:** 6H |

### Полная таблица передач

| shifterSlot | Splitter | Range | Реальная передача |
|-------------|----------|-------|-------------------|
| 2 | L | Lo | R1L |
| 2 | H | Lo | R1H |
| 2 | L | Hi | R2L |
| 2 | H | Hi | R2H |
| 3 | L | Lo | LL |
| 3 | H | Lo | LH |
| 3 | — | Hi | *не используется* |
| 4 | L | Lo | 1L |
| 4 | H | Lo | 1H |
| 4 | L | Hi | 5L |
| 4 | H | Hi | 5H |
| 5 | L | Lo | 2L |
| 5 | H | Lo | 2H |
| 5 | L | Hi | 6L |
| 5 | H | Hi | 6H |
| 6 | L | Lo | 3L |
| 6 | H | Lo | 3H |
| 6 | L | Hi | 7L |
| 6 | H | Hi | 7H |
| 7 | L | Lo | 4L |
| 7 | H | Lo | 4H |
| 7 | L | Hi | 8L |
| 7 | H | Hi | 8H |

---

## Eaton Fuller 13-speed (6-speed H-shifter)

**Особенности:**
- 5-ступенчатая передняя секция + 3-ступенчатая вспомогательная (Lo/Hi range + splitter)
- Splitter работает **только в Hi Range** (в Lo Range — механическая блокировка)
- Crawler L — только в Lo Range
- 13 forward + 2 reverse

### Селекторы

Аналогично 18-ступке: `shifterToggle[0]` = Range, `shifterToggle[1]` = Splitter.

### Слоты H-shifter

| shifterSlot | Назначение в 13-ступке |
|-------------|------------------------|
| 0 | Нейтраль |
| 1 | *не используется* |
| 2 | **Reverse** — RL (Lo) / RH (Hi) |
| 3 | **L** — только Lo Range |
| 4 | **Lo:** 1 / **Hi:** 5L / 5H |
| 5 | **Lo:** 2 / **Hi:** 6L / 6H |
| 6 | **Lo:** 3 / **Hi:** 7L / 7H |
| 7 | **Lo:** 4 / **Hi:** 8L / 8H |

### Полная таблица передач

| shifterSlot | Splitter | Range | Передача |
|-------------|----------|-------|----------|
| 2 | — | Lo | RL |
| 2 | — | Hi | RH |
| 3 | — | Lo | L |
| 3 | — | Hi | *не используется* |
| 4 | — | Lo | 1 |
| 4 | L | Hi | 5L |
| 4 | H | Hi | 5H |
| 5 | — | Lo | 2 |
| 5 | L | Hi | 6L |
| 5 | H | Hi | 6H |
| 6 | — | Lo | 3 |
| 6 | L | Hi | 7L |
| 6 | H | Hi | 7H |
| 7 | — | Lo | 4 |
| 7 | L | Hi | 8L |
| 7 | H | Hi | 8H |

### Примечания

`gearDashboard` в телеметрии SCS отдаёт номер передачи, как на приборке. Для 13-ступки это может отличаться от таблицы выше — зависит от реализации коробки в игре.

Splitter в Lo Range игнорируется (механически заблокирован) — его состояние не влияет на отображаемую передачу.

**Детект:** `selectorCount == 2 && gearsForward == 13`.

---

## Eaton Fuller 10-speed (6-speed H-shifter)

**Особенности:**
- Range-only (сплиттера нет, `selectorCount == 1`)
- 5 позиций × 2 range = 10 forward + 2 reverse

### Слоты H-shifter

| shifterSlot | Назначение |
|-------------|------------|
| 0 | Нейтраль |
| 1 | *не используется* |
| 2 | **Reverse** — RL (Lo) / RH (Hi) |
| 3 | **Lo:** 1 / **Hi:** 6 |
| 4 | **Lo:** 2 / **Hi:** 7 |
| 5 | **Lo:** 3 / **Hi:** 8 |
| 6 | **Lo:** 4 / **Hi:** 9 |
| 7 | **Lo:** 5 / **Hi:** 10 |

### Полная таблица передач

| shifterSlot | Splitter | Range | Передача |
|-------------|----------|-------|----------|
| 2 | — | Lo | RL |
| 2 | — | Hi | RH |
| 3 | — | Lo | 1 |
| 3 | — | Hi | 6 |
| 4 | — | Lo | 2 |
| 4 | — | Hi | 7 |
| 5 | — | Lo | 3 |
| 5 | — | Hi | 8 |
| 6 | — | Lo | 4 |
| 6 | — | Hi | 9 |
| 7 | — | Lo | 5 |
| 7 | — | Hi | 10 |

**Детект:** `selectorCount == 1 && gearsForward == 10`.

---

## ZF 12-speed (6-speed H-shifter)

**Особенности:**
- Range + Splitter (`selectorCount == 2`)
- 3 передних позиции × 2 range × 2 split = 12 forward + 2 reverse
- Reverse работает в обоих диапазонах (Lo/Hi)
- **Используется в:** MAN (TipMatic), DAF, Iveco, Mercedes (PowerShift)

### Селекторы

| Индекс | Название | Назначение |
|--------|----------|------------|
| `shifterToggle[0]` | Range | Lo (1‑3) / Hi (4‑6) |
| `shifterToggle[1]` | Splitter | L / H внутри позиции |

### Слоты H-shifter

| shifterSlot | Назначение в ZF12 |
|-------------|-------------------|
| 0 | Нейтраль |
| 3 | **Reverse** — RL / RH (оба диапазона) |
| 4 | **Lo:** 1L / 1H, **Hi:** 4L / 4H |
| 6 | **Lo:** 2L / 2H, **Hi:** 5L / 5H |
| 7 | **Lo:** 3L / 3H, **Hi:** 6L / 6H |

### Полная таблица передач

| shifterSlot | Splitter | Range | Передача |
|-------------|----------|-------|----------|
| 3 | L | Lo | RL |
| 3 | H | Lo | RH |
| 3 | L | Hi | RL |
| 3 | H | Hi | RH |
| 4 | L | Lo | 1L |
| 4 | H | Lo | 1H |
| 4 | L | Hi | 4L |
| 4 | H | Hi | 4H |
| 6 | L | Lo | 2L |
| 6 | H | Lo | 2H |
| 6 | L | Hi | 5L |
| 6 | H | Hi | 5H |
| 7 | L | Lo | 3L |
| 7 | H | Lo | 3H |
| 7 | L | Hi | 6L |
| 7 | H | Hi | 6H |

**Детект:** `selectorCount == 2 && gearsForward == 12`.

---

## ZF 16-speed (6-speed H-shifter)

**Особенности:**
- Range + Splitter (`selectorCount == 2`)
- 4 передних позиции × 2 range × 2 split = 16 forward + 2 reverse
- Reverse в обоих диапазонах
- **Используется в:** MAN (TipMatic), DAF, Iveco, Mercedes (PowerShift)

### Селекторы

| Индекс | Название | Назначение |
|--------|----------|------------|
| `shifterToggle[0]` | Range | Lo (1‑4) / Hi (5‑8) |
| `shifterToggle[1]` | Splitter | L / H внутри позиции |

### Слоты H-shifter

| shifterSlot | Назначение в ZF16 |
|-------------|-------------------|
| 0 | Нейтраль |
| 3 | **Reverse** — RL / RH (оба диапазона) |
| 4 | **Lo:** 1L / 1H, **Hi:** 5L / 5H |
| 5 | **Lo:** 2L / 2H, **Hi:** 6L / 6H |
| 6 | **Lo:** 3L / 3H, **Hi:** 7L / 7H |
| 7 | **Lo:** 4L / 4H, **Hi:** 8L / 8H |

### Полная таблица передач

| shifterSlot | Splitter | Range | Передача |
|-------------|----------|-------|----------|
| 3 | L | Lo | RL |
| 3 | H | Lo | RH |
| 3 | L | Hi | RL |
| 3 | H | Hi | RH |
| 4 | L | Lo | 1L |
| 4 | H | Lo | 1H |
| 4 | L | Hi | 5L |
| 4 | H | Hi | 5H |
| 5 | L | Lo | 2L |
| 5 | H | Lo | 2H |
| 5 | L | Hi | 6L |
| 5 | H | Hi | 6H |
| 6 | L | Lo | 3L |
| 6 | H | Lo | 3H |
| 6 | L | Hi | 7L |
| 6 | H | Hi | 7H |
| 7 | L | Lo | 4L |
| 7 | H | Lo | 4H |
| 7 | L | Hi | 8L |
| 7 | H | Hi | 8H |

**Детект:** `selectorCount == 2 && gearsForward == 16`.

---

## Scania 12 (6-speed H-shifter)

**Особенности:**
- Range + Splitter (`selectorCount == 2`)
- Reverse на Slot 2 (отличается от ZF/Volvo)
- 3 позиции × 2 range × 2 split = 12 forward + 2 reverse
- **Используется в:** Scania (GRS)

### Слоты H-shifter

| shifterSlot | Назначение в Scania 12 |
|-------------|------------------------|
| 0 | Нейтраль |
| 2 | **Reverse** — RL / RH (оба диапазона) |
| 5 | **Lo:** 1L / 1H, **Hi:** 4L / 4H |
| 6 | **Lo:** 2L / 2H, **Hi:** 5L / 5H |
| 7 | **Lo:** 3L / 3H, **Hi:** 6L / 6H |

### Полная таблица передач

| shifterSlot | Splitter | Range | Передача |
|-------------|----------|-------|----------|
| 2 | L | Lo | RL |
| 2 | H | Lo | RH |
| 2 | L | Hi | RL |
| 2 | H | Hi | RH |
| 5 | L | Lo | 1L |
| 5 | H | Lo | 1H |
| 5 | L | Hi | 4L |
| 5 | H | Hi | 4H |
| 6 | L | Lo | 2L |
| 6 | H | Lo | 2H |
| 6 | L | Hi | 5L |
| 6 | H | Hi | 5H |
| 7 | L | Lo | 3L |
| 7 | H | Lo | 3H |
| 7 | L | Hi | 6L |
| 7 | H | Hi | 6H |

**Детект:** `selectorCount == 2 && gearsForward == 12`.

---

## Scania 12+2 (6-speed H-shifter)

**Особенности:**
- Scania 12 + 2 crawler gears (C1, C2)
- Reverse на Slot 2
- Crawlers на Slot 3 (только Lo range)
- 12 forward + 2 crawler + 2 reverse = 14 forward, 2 reverse
- **Используется в:** Scania (GRSO)

### Слоты H-shifter

| shifterSlot | Назначение в Scania 12+2 |
|-------------|---------------------------|
| 0 | Нейтраль |
| 2 | **Reverse** — RL / RH (оба диапазона) |
| 3 | **Crawler:** C1 (Lo, split=L), C2 (Lo, split=H) |
| 5 | **Lo:** 1L / 1H, **Hi:** 4L / 4H |
| 6 | **Lo:** 2L / 2H, **Hi:** 5L / 5H |
| 7 | **Lo:** 3L / 3H, **Hi:** 6L / 6H |

### Полная таблица передач

| shifterSlot | Splitter | Range | Передача |
|-------------|----------|-------|----------|
| 2 | L | Lo | RL |
| 2 | H | Lo | RH |
| 2 | L | Hi | RL |
| 2 | H | Hi | RH |
| 3 | L | Lo | C1 |
| 3 | H | Lo | C2 |
| 3 | — | Hi | *не используется* |
| 5 | L | Lo | 1L |
| 5 | H | Lo | 1H |
| 5 | L | Hi | 4L |
| 5 | H | Hi | 4H |
| 6 | L | Lo | 2L |
| 6 | H | Lo | 2H |
| 6 | L | Hi | 5L |
| 6 | H | Hi | 5H |
| 7 | L | Lo | 3L |
| 7 | H | Lo | 3H |
| 7 | L | Hi | 6L |
| 7 | H | Hi | 6H |

**Детект:** `selectorCount == 2 && gearsForward == 14`.

---

## Volvo 12 (6-speed H-shifter)

**Особенности:**
- Range + Splitter (`selectorCount == 2`)
- Reverse на Slot 3 (как ZF)
- 3 позиции (4, 5, 6) × 2 range × 2 split = 12 forward + 2 reverse
- Slot 7 не используется
- **Используется в:** Volvo (I-Shift), Renault (Optidriver)

### Слоты H-shifter

| shifterSlot | Назначение в Volvo 12 |
|-------------|----------------------|
| 0 | Нейтраль |
| 3 | **Reverse** — RL / RH (оба диапазона) |
| 4 | **Lo:** 1L / 1H, **Hi:** 4L / 4H |
| 5 | **Lo:** 2L / 2H, **Hi:** 5L / 5H |
| 6 | **Lo:** 3L / 3H, **Hi:** 6L / 6H |

### Полная таблица передач

| shifterSlot | Splitter | Range | Передача |
|-------------|----------|-------|----------|
| 3 | L | Lo | RL |
| 3 | H | Lo | RH |
| 3 | L | Hi | RL |
| 3 | H | Hi | RH |
| 4 | L | Lo | 1L |
| 4 | H | Lo | 1H |
| 4 | L | Hi | 4L |
| 4 | H | Hi | 4H |
| 5 | L | Lo | 2L |
| 5 | H | Lo | 2H |
| 5 | L | Hi | 5L |
| 5 | H | Hi | 5H |
| 6 | L | Lo | 3L |
| 6 | H | Lo | 3H |
| 6 | L | Hi | 6L |
| 6 | H | Hi | 6H |

**Детект:** `selectorCount == 2 && gearsForward == 12`.

---

## Volvo 12+2 (6-speed H-shifter)

**Особенности:**
- Volvo 12 + 2 crawler gears (C1, C2) + **4 reverse gears**
- Crawlers на Slot 2 (только Lo range)
- Reverse на Slot 3 — **4 передачи** (RLL, RLH, RHL, RHH) по range+split
- 12 forward + 2 crawler + 4 reverse = 14 forward, 4 reverse
- **Используется в:** Volvo (I-Shift), Renault (Optidriver)

### Слоты H-shifter

| shifterSlot | Назначение в Volvo 12+2 |
|-------------|-------------------------|
| 0 | Нейтраль |
| 2 | **Crawler:** C1 (Lo, split=L), C2 (Lo, split=H) |
| 3 | **Reverse** — RLL (Lo/L), RLH (Lo/H), RHL (Hi/L), RHH (Hi/H) |
| 4 | **Lo:** 1L / 1H, **Hi:** 4L / 4H |
| 5 | **Lo:** 2L / 2H, **Hi:** 5L / 5H |
| 6 | **Lo:** 3L / 3H, **Hi:** 6L / 6H |

### Полная таблица передач

| shifterSlot | Splitter | Range | Передача |
|-------------|----------|-------|----------|
| 2 | L | Lo | C1 |
| 2 | H | Lo | C2 |
| 2 | — | Hi | *не используется* |
| 3 | L | Lo | RLL |
| 3 | H | Lo | RLH |
| 3 | L | Hi | RHL |
| 3 | H | Hi | RHH |
| 4 | L | Lo | 1L |
| 4 | H | Lo | 1H |
| 4 | L | Hi | 4L |
| 4 | H | Hi | 4H |
| 5 | L | Lo | 2L |
| 5 | H | Lo | 2H |
| 5 | L | Hi | 5L |
| 5 | H | Hi | 5H |
| 6 | L | Lo | 3L |
| 6 | H | Lo | 3H |
| 6 | L | Hi | 6L |
| 6 | H | Hi | 6H |

**Детект:** `selectorCount == 2 && gearsForward == 14`.
