# План: динамическая смена языка без перезапуска

## Проблема
Сейчас `{x:Static res:Resources.XXX}` вычисляется один раз при загрузке XAML.
Смена языка — `Process.Start + Shutdown`.

## Решение

### 1. `LocalizationManager.cs` — статический класс
- `CultureChanged` — событие
- `CurrentCulture` — текущая культура
- `ChangeCulture(culture)` — устанавливает `Thread.CurrentUICulture`, вызывает событие
- `Initialize(culture)` — для стартовой установки

### 2. `LocExtension.cs` — `MarkupExtension`
- Принимает `Key` (имя ресурса)
- `ProvideValue()` — получает `DependencyObject` + `DependencyProperty`, запоминает через `WeakReference`
- Подписывается на `LocalizationManager.CultureChanged`
- При смене: `target.SetValue(property, Resources.ResourceManager.GetString(Key))`
- Отписка при GC цели

### 3. App.xaml.cs
- После `base.OnStartup()`, **до** `new MainWindow()`: читать `AppConfig.json`, вызывать `LocalizationManager.Initialize(culture)`

### 4. Замена во всех XAML
`{x:Static res:Resources.XXX}` → `{loc:Loc XXX}`
Добавить `xmlns:loc="clr-namespace:MiniRacingHUD"` (в файлы, где нет local)

### 5. MainWindow.xaml.cs
- Конструктор: убрать прямой `Thread.CurrentUICulture`, заменить на `LocalizationManager.Initialize()`
- `ApplyLanguage()` → удалить
- `langSelector_SelectionChanged`: `LocalizationManager.ChangeCulture()` + `SaveConfig()` (без рестарта)
- Подписка на `CultureChanged`: обновлять `Title`, `titleText`, статус-бар (UDP/WS статусы — они статичные при старте, но на будущее)

### 6. Code-behind окон
- **ColorEditorWindow** → подписка на `CultureChanged`, обновление заголовка
- **ThemeEditorWindow** → подписка на `CultureChanged`, обновление заголовка
- **TelemetryWindow** → подписка на `CultureChanged`, обновление заголовка + статус "Waiting for data"
- **AddGameDialog** → подписка на `CultureChanged`, обновление заголовка
- **NewThemeDialog** → подписка на `CultureChanged`, обновление заголовка
- **BaseDialogWindow** → подписка на `CultureChanged`, обновление `titleText` + кнопка Close

### 7. Проверка
- `dotnet build` — без ошибок
- Основной сценарий: запуск, смена языка в ComboBox — UI обновляется без перезапуска
- Открытые окна (ColorEditor, ThemeEditor) — обновляются при смене языка
