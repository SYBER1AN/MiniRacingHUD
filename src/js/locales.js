// Global naming note: I use 'locale' for the interface language to avoid confusion with the widget language selector.

const LOCALES = {
    ru: {
        // ---- Settings panel ----
        'widget.language': 'Язык виджета:',
        'widget.language.tooltip': 'Язык подписей виджета',
        'widget.theme': 'Тема виджета:',
        'widget.theme.tooltip': 'Цветовая схема виджета',
        'preset.label': 'Пресет:',
        'preset.tooltip': 'Наборы настроек',
        'interface.language': 'Язык интерфейса:',
        'interface.language.tooltip': 'Язык интерфейса',
        'axis.section': 'Оси и кнопки',
        'axis.wheel': 'Руль:',
        'axis.throttle': 'Газ:',
        'axis.brake': 'Тормоз:',
        'axis.clutch': 'Сцепление:',
        'axis.handbrake': 'Ручник:',
        'axis.handbrakeBtn': 'Ручник (кн.):',
        'axis.gearbox': 'КПП:',
        'tooltip.wheelAxis': 'Ось руля',
        'tooltip.throttleAxis': 'Ось газа',
        'tooltip.brakeAxis': 'Ось тормоза',
        'tooltip.clutchAxis': 'Ось сцепления',
        'tooltip.handbrakeAxis': 'Ось ручника',
        'tooltip.axisRange': 'Диапазон оси',
        'range.full': 'Полный',
        'range.negative': 'Отрицательный',
        'range.positive': 'Положительный',
        'tooltip.invert': 'Инвертировать диапазон',
        'tooltip.showGraph': 'Показать график оси',
        'tooltip.handbrakeButtons': 'Кнопки ручника',
        'tooltip.gearButtons': 'Кнопки передач',
        // ---- Middle column ----
        'widget.scale': 'Масштаб виджета',
        'gear.scale': 'Масштаб индикатора КПП',
        'widget.opacity': 'Прозрачность фона виджета',
        'steering.angle': 'Угол поворота руля',
        'car.select': 'Автомобиль:',
        'car.tooltip': 'Выбор автомобиля',
        'car.placeholder': 'Выбрать...',
        // ---- Right column ----
        'settings.other': 'Прочие настройки',
        'tooltip.pageBg': 'Показать/скрыть фон страницы',
        'toggle.pageBg': 'Фон страницы',
        'tooltip.pedalLabels': 'Включить/выключить подписи',
        'toggle.pedalLabels': 'Подписи педалей',
        'tooltip.reverseOrder': 'Расположить руль/КПП справа от педалей',
        'toggle.reverseOrder': 'Обратный порядок',
        'tooltip.graphIndependent': 'Графики отдельно',
        'toggle.graphIndependent': 'Графики отдельно',
        'tooltip.graphsOnly': 'Показывать только графики, скрыть виджет',
        'toggle.graphsOnly': 'Только графики',
        'tooltip.noRounding': 'Отключить динамическое скругление по форме элементов',
        'toggle.noRounding': 'Не скруглять',
        'tooltip.handbrakeRight': 'Расположить ручник справа от педалей',
        'toggle.handbrakeRight': 'Ручник справа',
        'tooltip.gearIndependent': 'Расположить КПП отдельно от руля',
        'toggle.gearIndependent': 'КПП отдельно',
        'tooltip.rotateGear': 'Синхронизировать поворот КПП с рулём',
        'toggle.rotateGear': 'Вращать КПП',
        // ---- UDP toggles ----
        'tooltip.udpTelemetry': 'Использовать UDP телеметрию',
        'toggle.udpTelemetry': 'UDP-телеметрия',
        'tooltip.udpPedals': 'Показывать педали через UDP',
        'toggle.udpPedals': 'Педали',
        'tooltip.gmeter': 'Индикатор перегрузок',
        'toggle.gmeter': 'G-meter',
        'tooltip.gmeterTrail': 'Рисовать след движения шарика G-meter',
        'toggle.gmeterTrail': 'Шлейф G-meter',
        'tooltip.udpGear': 'Показывать КПП через UDP',
        'toggle.udpGear': 'КПП',
        'tooltip.udpWheel': 'Показывать руль через UDP',
        'toggle.udpWheel': 'Руль',
        'tooltip.udpHandbrake': 'Показывать ручник через UDP',
        'toggle.udpHandbrake': 'Ручник',
        'tooltip.udpSmoothing': 'Сглаживать анимацию (полезно для управления кнопками)',
        'toggle.udpSmoothing': 'Сглаживание UDP',
        // ---- MultiWidget ----
        'multiwidget.title': 'Мультивиджет',
        'multiwidget.tooltip': 'Несколько наборов видимости в одном пресете',
        'multiwidget.copyUrl': 'Копировать URL',
        'multiwidget.urlCopied': 'URL скопирован',
        'multiwidget.copySlot': 'Копировать URL слота {0}',
        // ---- MW entries ----
        'mw.wheel': 'Руль',
        'mw.gearbox': 'КПП',
        'mw.handbrake': 'Ручник',
        'mw.clutch': 'Сцепление',
        'mw.brake': 'Тормоз',
        'mw.throttle': 'Газ',
        'mw.graphs': 'Графики',
        'mw.bg': 'Фон',
        // ---- Save/Reset ----
        'button.reset': 'Сбросить',
        'button.save': 'Сохранить',
        // ---- Help (hidden by default, but for the button) ----
        'help.title': 'Справка',
        // ---- Modals ----
        'capture.defaultTitle': 'Ось руля',
        'capture.defaultText': 'Покрутите руль...',
        'capture.cancel': 'Отмена',
        'capture.wheel.title': 'Ось руля',
        'capture.wheel.text': 'Покрутите руль...',
        'capture.throttle.title': 'Ось газа',
        'capture.throttle.text': 'Нажмите педаль газа...',
        'capture.brake.title': 'Ось тормоза',
        'capture.brake.text': 'Нажмите педаль тормоза...',
        'capture.clutch.title': 'Ось сцепления',
        'capture.clutch.text': 'Нажмите педаль сцепления...',
        'capture.handbrake.title': 'Ручник (ось)',
        'capture.handbrake.text': 'Передёрните ручник...',
        'capture.handbrakeBtn.title': 'Ручник (кнопка)',
        'capture.handbrakeBtn.text': 'Нажмите кнопку...',
        'capture.gear.title': 'Передача',
        'capture.gear.text': 'Нажмите кнопку...',
        'modal.unsavedTitle': 'Несохранённые изменения!',
        'modal.unsavedText': 'Сохранить изменения перед сменой пресета?',
        'modal.yes': 'Да',
        'modal.no': 'Нет',
        'modal.newPreset': 'Новый пресет',
        'modal.presetPlaceholder': 'Введите название...',
        'modal.presetName': 'Название пресета',
        'modal.save': 'Сохранить',
        'modal.cancel': 'Отмена',
        'modal.emptyTitle': 'А чего сохранять-то?',
        'modal.emptyText': 'Для начала настройте что-нибудь!',
        'modal.ok': 'OK',
        'modal.deletePreset': 'Удалить пресет?!',
        'modal.deleteConfirm': 'Вы уверены, что хотите удалить пресет "{0}"?',
        'modal.delete': 'Удалить',
        // ---- Status messages ----
        'status.presetSaved': 'Пресет {0}.js сохранён.',
        'status.configSaved': 'Конфиг сохранён.',
        'status.presetLoaded': 'Пресет {0} загружен.',
        'status.presetCreated': 'Пресет {0} создан.',
        'status.savedAs': 'Сохранить как...',
        'status.copied': '✓ Скопировано!',
        'status.lastDevice': 'Последнее устройство: {0}',
        'status.axis': 'Ось {0}',
        'status.button': 'Кнопка {0}',
        // ---- Theme ----
        'theme.ui.light': 'Светлая тема',
        'theme.ui.dark': 'Тёмная тема',
        'theme.manage.deleteTitle': 'Удалить тему?!',
        'theme.manage.deleteConfirm': 'Вы уверены, что хотите удалить тему "{0}"?',
        'theme.manage.delete': 'Удалить тему',
        'theme.manage.edit': 'Редактировать...',
        // ---- Language names ----
        'lang.ru': 'Русский',
        'lang.en': 'Английский',
        'lang.cn': 'Китайский',
        // ---- Theme display names ----
        'theme.widget.Default': 'Стандартная',
        'theme.widget.Dark': 'Тёмная',
        'theme.widget.White': 'Белая',
        'theme.widget.Black': 'Чёрная',
        'theme.widget.Monochrome': 'Монохромная',
        'theme.widget.Vintage': 'Винтажная',
        'theme.widget.Pastel': 'Пастель',
        'theme.widget.DR2': 'DR2',
        'theme.widget.BeamNG': 'BeamNG',
        // ---- Pedal labels (for the widget language, not interface) ----
        'pedal.handbrake': 'РУЧНИК',
        'pedal.clutch': 'СЦЕПЛЕНИЕ',
        'pedal.brake': 'ТОРМОЗ',
        'pedal.throttle': 'ГАЗ',
        // ---- UDP tooltips (disabled) ----
        'udp.handbrakeDisabled': 'Ручник недоступен через телеметрию игры',
        'udp.handbrakeEnabled': 'Показывать ручник через UDP',
        'udp.wheelDisabled': 'Телеметрия не передаёт градус руля',
        'udp.wheelEnabled': 'Показывать руль через UDP',
        'mw.gmeter': 'G-meter',
        'mode.directInput': 'Режим: DirectInput',
        'mode.gamepadApi': 'Режим: Gamepad API',
        // ---- Help text ----
        'help.appMode.title': '☝️ Настройка (с приложения)',
        'help.appMode.warning': '<strong>• ВАЖНО!</strong> Для настройки виджета, окно с HTML должно иметь достаточную высоту, иначе включается упрощённый режим виджета. <strong>Все настройки сохраняются в виде пресетов. Вы можете создать несколько пресетов для каждой игры.</strong>',
        'help.appMode.step1': '<strong>1.</strong> Кликните на пустой слот оси или кнопки',
        'help.appMode.step2': '<strong>2.</strong> Подвигайте ось или нажмите кнопку',
        'help.appMode.step3': '<strong>3.</strong> Если нужно, настройте диапазон оси и инверсию',
        'help.appMode.step4': '<strong>4.</strong> Не стесняйтесь потыкать другие кнопочки 😉',
        'help.appMode.step5': '<strong>5.</strong> Нажмите «Сохранить» и настроенный пресет сохранится в папку <code>presets</code> в папке программы',
        'help.appMode.step6': '<strong>6. Для работы UDP-телеметрии</strong> оставьте приложение включённым',
        'help.standalone.title': '☝️ Настройка (браузерный вариант)',
        'help.standalone.warning': '<strong>• ВАЖНО!</strong> Для настройки виджета, окно с HTML должно иметь достаточную высоту, иначе включается упрощённый режим виджета. После настройки и сохранения изменений <strong>основной HTML-файл и файл конфигурации <code>NoApp.js</code> должны лежать в одной папке!</strong>',
        'help.standalone.step1': '<strong>1.</strong> Кликните на пустой слот оси или кнопки',
        'help.standalone.step2': '<strong>2.</strong> Подвигайте ось или нажмите кнопку',
        'help.standalone.step3': '<strong>3.</strong> Если нужно, настройте диапазон оси и инверсию',
        'help.standalone.step4': '<strong>4.</strong> Не стесняйтесь потыкать другие кнопочки 😉',
        'help.standalone.step5': '<strong>5.</strong> Нажмите «Сохранить» и настроенный файл скачается в «Загрузки». <strong>Скорее всего, сработает защита браузера 🥴</strong>, не пугайтесь, она среагирует так же на скачивание любого другого JS-файла',
        'help.standalone.step6': '<strong>6.</strong> Поместите загруженный файл в папку с основным HTML-файлом',
        'help.standalone.step7': '<strong>7. Пресеты и телеметрия игры</strong> доступны только при использовании приложения!',
        'help.obs.title': '☝️ Использование в OBS',
        'help.obs.source': '<strong>Источник:</strong> Браузер',
        'help.obs.url': '<strong>URL:</strong> <code id="pageUrl" class="copyable-text" title="Копировать URL"></code>',
        'help.obs.resolution': '<strong>Минимальное разрешение:</strong> <code id="widgetSize" title="Копировать размер"></code>',
        'help.urlParams.title': '☝️ Параметры в адресной строке',
        'help.urlParams.preset': '<strong>•</strong> Параметр <code>?preset=X</code> загружает пресет <code>presets/X.js</code>',
        'help.urlParams.config': '<strong>•</strong> Параметр <code>?config=X</code> загружает пресет из папки с HTML',
        'help.urlParams.steering': '<strong>•</strong> Параметр <code>?steering=X</code> устанавливает угол поворота руля на X градусов',
        'help.urlParams.scale': '<strong>•</strong> Параметр <code>?scale=X</code> устанавливает масштаб виджета в процентах (100–300)',
        'help.urlParams.nogears': '<strong>•</strong> Параметр <code>?nogears</code> отключает индикатор передач',
        'help.urlParams.mw': '<strong>•</strong> Параметр <code>?mw=N</code> выбирает слот мультивиджета (1-6)',
        'help.urlParams.combine': '<strong>•</strong> <strong>Возможно использовать параметры вместе</strong> через <strong>&</strong>, например: <code class="example-url" title="Это просто пример URL">...HUD.html?preset=DR2&amp;steering=420</code>',
    },

    en: {
        'widget.language': 'Widget language:',
        'widget.language.tooltip': 'Widget label language',
        'widget.theme': 'Widget theme:',
        'widget.theme.tooltip': 'Widget color scheme',
        'preset.label': 'Preset:',
        'preset.tooltip': 'Preset configurations',
        'interface.language': 'Interface language:',
        'interface.language.tooltip': 'Interface language',
        'axis.section': 'Axes & Buttons',
        'axis.wheel': 'Wheel:',
        'axis.throttle': 'Throttle:',
        'axis.brake': 'Brake:',
        'axis.clutch': 'Clutch:',
        'axis.handbrake': 'Handbrake:',
        'axis.handbrakeBtn': 'Handbrake (btn.):',
        'axis.gearbox': 'Gearbox:',
        'tooltip.wheelAxis': 'Wheel axis',
        'tooltip.throttleAxis': 'Throttle axis',
        'tooltip.brakeAxis': 'Brake axis',
        'tooltip.clutchAxis': 'Clutch axis',
        'tooltip.handbrakeAxis': 'Handbrake axis',
        'tooltip.axisRange': 'Axis range',
        'range.full': 'Full',
        'range.negative': 'Negative',
        'range.positive': 'Positive',
        'tooltip.invert': 'Invert range',
        'tooltip.showGraph': 'Show graph',
        'tooltip.handbrakeButtons': 'Handbrake buttons',
        'tooltip.gearButtons': 'Gear buttons',
        'widget.scale': 'Widget scale',
        'gear.scale': 'Gear indicator scale',
        'widget.opacity': 'Widget background opacity',
        'steering.angle': 'Steering wheel angle',
        'car.select': 'Car:',
        'car.tooltip': 'Select car',
        'car.placeholder': 'Select...',
        'settings.other': 'Other settings',
        'tooltip.pageBg': 'Show/hide page background',
        'toggle.pageBg': 'Page background',
        'tooltip.pedalLabels': 'Enable/disable labels',
        'toggle.pedalLabels': 'Pedal labels',
        'tooltip.reverseOrder': 'Place wheel/gearbox to the right of pedals',
        'toggle.reverseOrder': 'Reverse order',
        'tooltip.graphIndependent': 'Graphs separately',
        'toggle.graphIndependent': 'Graphs separately',
        'tooltip.graphsOnly': 'Show only graphs, hide widget',
        'toggle.graphsOnly': 'Graphs only',
        'tooltip.noRounding': 'Disable dynamic rounding based on element shape',
        'toggle.noRounding': 'No rounding',
        'tooltip.handbrakeRight': 'Place handbrake to the right of pedals',
        'toggle.handbrakeRight': 'Handbrake right',
        'tooltip.gearIndependent': 'Place gearbox separately from wheel',
        'toggle.gearIndependent': 'Gearbox separate',
        'tooltip.rotateGear': 'Sync gearbox rotation with wheel',
        'toggle.rotateGear': 'Rotate gearbox',
        'tooltip.udpTelemetry': 'Use UDP telemetry',
        'toggle.udpTelemetry': 'UDP telemetry',
        'tooltip.udpPedals': 'Show pedals via UDP',
        'toggle.udpPedals': 'Pedals',
        'tooltip.gmeter': 'G-force indicator',
        'toggle.gmeter': 'G-meter',
        'tooltip.gmeterTrail': 'Draw G-meter ball trail',
        'toggle.gmeterTrail': 'G-meter trail',
        'tooltip.udpGear': 'Show gearbox via UDP',
        'toggle.udpGear': 'Gearbox',
        'tooltip.udpWheel': 'Show wheel via UDP',
        'toggle.udpWheel': 'Wheel',
        'tooltip.udpHandbrake': 'Show handbrake via UDP',
        'toggle.udpHandbrake': 'Handbrake',
        'tooltip.udpSmoothing': 'Smooth animation (useful for button control)',
        'toggle.udpSmoothing': 'UDP smoothing',
        'multiwidget.title': 'Multi-widget',
        'multiwidget.tooltip': 'Multiple visibility slots in one preset',
        'multiwidget.copyUrl': 'Copy URL',
        'multiwidget.urlCopied': 'URL copied',
        'multiwidget.copySlot': 'Copy slot {0} URL',
        'mw.wheel': 'Wheel',
        'mw.gearbox': 'Gearbox',
        'mw.handbrake': 'Handbrake',
        'mw.clutch': 'Clutch',
        'mw.brake': 'Brake',
        'mw.throttle': 'Throttle',
        'mw.graphs': 'Graphs',
        'mw.bg': 'Background',
        'button.reset': 'Reset',
        'button.save': 'Save',
        'help.title': 'Help',
        'capture.defaultTitle': 'Wheel axis',
        'capture.defaultText': 'Turn the wheel...',
        'capture.cancel': 'Cancel',
        'capture.wheel.title': 'Wheel axis',
        'capture.wheel.text': 'Turn the wheel...',
        'capture.throttle.title': 'Throttle axis',
        'capture.throttle.text': 'Press the throttle pedal...',
        'capture.brake.title': 'Brake axis',
        'capture.brake.text': 'Press the brake pedal...',
        'capture.clutch.title': 'Clutch axis',
        'capture.clutch.text': 'Press the clutch pedal...',
        'capture.handbrake.title': 'Handbrake (axis)',
        'capture.handbrake.text': 'Pull the handbrake...',
        'capture.handbrakeBtn.title': 'Handbrake (button)',
        'capture.handbrakeBtn.text': 'Press a button...',
        'capture.gear.title': 'Gear',
        'capture.gear.text': 'Press a button...',
        'modal.unsavedTitle': 'Unsaved changes!',
        'modal.unsavedText': 'Save changes before switching preset?',
        'modal.yes': 'Yes',
        'modal.no': 'No',
        'modal.newPreset': 'New preset',
        'modal.presetPlaceholder': 'Enter name...',
        'modal.presetName': 'Preset name',
        'modal.save': 'Save',
        'modal.cancel': 'Cancel',
        'modal.emptyTitle': 'Nothing to save!',
        'modal.emptyText': 'Configure something first!',
        'modal.ok': 'OK',
        'modal.deletePreset': 'Delete preset?!',
        'modal.deleteConfirm': 'Are you sure you want to delete preset "{0}"?',
        'modal.delete': 'Delete',
        'status.presetSaved': 'Preset {0}.js saved.',
        'status.configSaved': 'Config saved.',
        'status.presetLoaded': 'Preset {0} loaded.',
        'status.presetCreated': 'Preset {0} created.',
        'status.savedAs': 'Save as...',
        'status.copied': '✓ Copied!',
        'status.lastDevice': 'Last device: {0}',
        'status.axis': 'Axis {0}',
        'status.button': 'Button {0}',
        'theme.ui.light': 'Light theme',
        'theme.ui.dark': 'Dark theme',
        'theme.manage.deleteTitle': 'Delete theme?!',
        'theme.manage.deleteConfirm': 'Are you sure you want to delete theme "{0}"?',
        'theme.manage.delete': 'Delete theme',
        'theme.manage.edit': 'Edit...',
        'lang.ru': 'Russian',
        'lang.en': 'English',
        'lang.cn': 'Chinese',
        'theme.widget.Default': 'Default',
        'theme.widget.Dark': 'Dark',
        'theme.widget.White': 'White',
        'theme.widget.Black': 'Black',
        'theme.widget.Monochrome': 'Monochrome',
        'theme.widget.Vintage': 'Vintage',
        'theme.widget.Pastel': 'Pastel',
        'theme.widget.DR2': 'DR2',
        'theme.widget.BeamNG': 'BeamNG',
        'pedal.handbrake': 'HANDBRAKE',
        'pedal.clutch': 'CLUTCH',
        'pedal.brake': 'BRAKE',
        'pedal.throttle': 'THROTTLE',
        'udp.handbrakeDisabled': 'Handbrake not available via game telemetry',
        'udp.handbrakeEnabled': 'Show handbrake via UDP',
        'udp.wheelDisabled': 'Steering angle not available via telemetry',
        'udp.wheelEnabled': 'Show wheel via UDP',
        'mw.gmeter': 'G-meter',
        'mode.directInput': 'Mode: DirectInput',
        'mode.gamepadApi': 'Mode: Gamepad API',
        // ---- Help text ----
        'help.appMode.title': '☝️ Setup (with app)',
        'help.appMode.warning': '<strong>• IMPORTANT!</strong> For widget setup, the HTML window must have sufficient height, otherwise the simplified widget mode is activated. <strong>All settings are saved as presets. You can create multiple presets for each game.</strong>',
        'help.appMode.step1': '<strong>1.</strong> Click on an empty axis or button slot',
        'help.appMode.step2': '<strong>2.</strong> Move an axis or press a button',
        'help.appMode.step3': '<strong>3.</strong> If needed, adjust the axis range and inversion',
        'help.appMode.step4': '<strong>4.</strong> Feel free to try other buttons 😉',
        'help.appMode.step5': '<strong>5.</strong> Click «Save» and the configured preset will be saved to the <code>presets</code> folder in the program directory',
        'help.appMode.step6': '<strong>6. For UDP telemetry to work</strong> keep the app running',
        'help.standalone.title': '☝️ Setup (browser version)',
        'help.standalone.warning': '<strong>• IMPORTANT!</strong> For widget setup, the HTML window must have sufficient height, otherwise the simplified widget mode is activated. After setup and saving changes <strong>the main HTML file and the config file <code>NoApp.js</code> must be in the same folder!</strong>',
        'help.standalone.step1': '<strong>1.</strong> Click on an empty axis or button slot',
        'help.standalone.step2': '<strong>2.</strong> Move an axis or press a button',
        'help.standalone.step3': '<strong>3.</strong> If needed, adjust the axis range and inversion',
        'help.standalone.step4': '<strong>4.</strong> Feel free to try other buttons 😉',
        'help.standalone.step5': '<strong>5.</strong> Click «Save» and the configured file will be downloaded to «Downloads». <strong>Browser protection will likely trigger 🥴</strong>, don\'t worry, it reacts the same way to any JS file download',
        'help.standalone.step6': '<strong>6.</strong> Place the downloaded file in the same folder as the main HTML file',
        'help.standalone.step7': '<strong>7. Presets and game telemetry</strong> are only available when using the app!',
        'help.obs.title': '☝️ Using in OBS',
        'help.obs.source': '<strong>Source:</strong> Browser',
        'help.obs.url': '<strong>URL:</strong> <code id="pageUrl" class="copyable-text" title="Copy URL"></code>',
        'help.obs.resolution': '<strong>Min resolution:</strong> <code id="widgetSize" title="Copy size"></code>',
        'help.urlParams.title': '☝️ URL Parameters',
        'help.urlParams.preset': '<strong>•</strong> Parameter <code>?preset=X</code> loads preset <code>presets/X.js</code>',
        'help.urlParams.config': '<strong>•</strong> Parameter <code>?config=X</code> loads a preset from the HTML folder',
        'help.urlParams.steering': '<strong>•</strong> Parameter <code>?steering=X</code> sets the steering wheel angle to X degrees',
        'help.urlParams.scale': '<strong>•</strong> Parameter <code>?scale=X</code> sets widget scale in percent (100–300)',
        'help.urlParams.nogears': '<strong>•</strong> Parameter <code>?nogears</code> completely disables the gear indicator',
        'help.urlParams.mw': '<strong>•</strong> Parameter <code>?mw=N</code> selects multi-widget slot (1-6)',
        'help.urlParams.combine': '<strong>•</strong> <strong>Parameters can be combined</strong> using <strong>&</strong>, e.g.: <code class="example-url" title="This is just a URL example">...HUD.html?preset=DR2&amp;steering=420</code>',
    }
};

let _currentLocale = 'ru';

function t(key, ...args) {
    let lang = _currentLocale;
    let val = LOCALES[lang]?.[key] ?? LOCALES.ru[key] ?? key;
    if (args.length > 0) {
        for (let i = 0; i < args.length; i++) {
            val = val.replace('{0}', args[i]);
        }
    }
    return val;
}

function setInterfaceLocale(lang) {
    _currentLocale = lang;
    if (typeof currentConfig !== 'undefined') {
        currentConfig.interfaceLanguage = lang;
    }
    applyLocale();
    // Перестраиваем селекторы с актуальной локалью
    if (typeof ThemeManager !== 'undefined') {
        ThemeManager.buildSelect();
        ThemeManager.updateSelectUI();
    }
    if (typeof buildLanguageSelect === 'function') buildLanguageSelect();
    if (typeof buildInterfaceLanguageSelect === 'function') buildInterfaceLanguageSelect();
    if (typeof sendConfigUpdate === 'function') {
        sendConfigUpdate();
    }
}

function applyLocale() {
    // data-i18n-html: update innerHTML (process first to recreate elements)
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        el.innerHTML = t(key);
    });
    // data-i18n: update textContent
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    // data-i18n-attr: update attribute (e.g. data-i18n-attr="title")
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
        const attr = el.getAttribute('data-i18n-attr');
        const key = el.getAttribute('data-i18n-' + attr);
        if (key) {
            el.setAttribute(attr, t(key));
        }
    });
    // data-i18n-placeholder: update placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.setAttribute('placeholder', t(key));
    });
    // Re-initialize dynamic help elements after innerHTML replacement
    if (typeof enableCopyOnCodes === 'function') {
        enableCopyOnCodes('.hud-info');
    }
    if (typeof updatePageUrlDisplay === 'function') {
        updatePageUrlDisplay();
    }
    if (typeof updateWidgetSizeDisplay === 'function') {
        updateWidgetSizeDisplay();
    }
    const exampleUrl = document.querySelector('.example-url');
    if (exampleUrl) {
        const params = exampleUrl.textContent.replace(/^.*\?/, '');
        try {
            const u = new URL(window.location.href);
            u.search = params;
            exampleUrl.dataset.fullText = u.toString();
        } catch (e) {
            // ignore
        }
    }
}

window.t = t;
window.setInterfaceLocale = setInterfaceLocale;
