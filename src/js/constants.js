// ==========================================
// 1. КЭШИРОВАНИЕ DOM ЭЛЕМЕНТОВ
// ==========================================
const DOM = {
    settingsPanel: document.getElementById('settingsPanel'),
    resetConfigBtn: document.getElementById('resetConfig'),
    saveConfigBtn: document.getElementById('saveConfig'),
    deviceInfo: document.getElementById('deviceInfo'),

    togglePedalLabelsBtn: document.getElementById('togglePedalLabels'),
    toggleGearSync: document.getElementById('toggleGearSync'),
    toggleGraphIndependent: document.getElementById('toggleGraphIndependent'),
    toggleGraphsOnlyBtn: document.getElementById('toggleGraphsOnly'),
    toggleLayoutOrderBtn: document.getElementById('toggleLayoutOrder'),
    toggleHandbrakeRightBtn: document.getElementById('toggleHandbrakeRight'),
    toggleGearIndependent: document.getElementById('toggleGearIndependent'),
    toggleBg: document.getElementById('toggleBg'),
    toggleGmeter: document.getElementById('toggleGmeter'),
    toggleUdpTelemetryBtn: document.getElementById('toggleUdpTelemetry'),
    togglePedalsUdpBtn: document.getElementById('togglePedalsUdp'),
    toggleUdpSmoothingBtn: document.getElementById('toggleUdpSmoothing'),
    toggleWheelUdpBtn: document.getElementById('toggleWheelUdp'),
    toggleHandbrakeUdpBtn: document.getElementById('toggleHandbrakeUdp'),
    toggleGearUdpBtn: document.getElementById('toggleGearUdp'),
    toggleNoCornerRounding: document.getElementById('toggleNoCornerRounding'),
    toggleTvdResults: document.getElementById('toggleTvdResults'),
    toggleTvdPreview: document.getElementById('toggleTvdPreview'),
    tvdResultsSlider: document.getElementById('tvdResultsSlider'),
    tvdResultsValue: document.getElementById('tvdResultsValue'),
    tvdResults: document.getElementById('tvdResults'),
    tvdResultsTitle: document.getElementById('tvdResultsTitle'),
    tvdResultsTrack: document.getElementById('tvdResultsTrack'),
    tvdResultsState: document.getElementById('tvdResultsState'),
    tvdResultsPos: document.getElementById('tvdResultsPos'),
    tvdResultsTime: document.getElementById('tvdResultsTime'),
    tvdResultsGap: document.getElementById('tvdResultsGap'),
    tvdResultsRows: document.getElementById('tvdResultsRows'),
    scaleSlider: document.getElementById('scaleSlider'),
    scaleValue: document.getElementById('scaleValue'),
    gearScaleSlider: document.getElementById('gearScaleSlider'),
    gearScaleValue: document.getElementById('gearScaleValue'),
    widgetBgOpacitySlider: document.getElementById('widgetBgOpacitySlider'),
    widgetBgOpacityValue: document.getElementById('widgetBgOpacityValue'),
    invertWheelBtn: document.getElementById('invertWheel'),
    invertThrottleBtn: document.getElementById('invertThrottle'),
    invertBrakeBtn: document.getElementById('invertBrake'),
    invertClutchBtn: document.getElementById('invertClutch'),
    invertHandbrakeBtn: document.getElementById('invertHandbrake'),
    toggleWheelGraphBtn: document.getElementById('toggleWheelGraph'),
    toggleThrottleGraphBtn: document.getElementById('toggleThrottleGraph'),
    toggleBrakeGraphBtn: document.getElementById('toggleBrakeGraph'),
    toggleClutchGraphBtn: document.getElementById('toggleClutchGraph'),
    toggleHandbrakeGraphBtn: document.getElementById('toggleHandbrakeGraph'),
    graphCanvas: document.getElementById('graphBlock'),
    graphContainer: document.getElementById('graphContainer'),
    graphCanvasIndependent: document.getElementById('graphBlockIndependent'),
    steeringAngleInput: document.getElementById('steeringAngle'),
    steeringSlider: document.getElementById('steeringSlider'),
    wheelAssembly: document.querySelector('.wheel-assembly'),
    wheel: document.getElementById('wheel'),
    pedalsRow: document.querySelector('.pedals-row'),
    handbrake: document.getElementById('handbrake'),
    clutch: document.getElementById('clutch'),
    brake: document.getElementById('brake'),
    throttle: document.getElementById('throttle'),
    fillHandbrake: document.getElementById('fill-handbrake'),
    fillClutch: document.getElementById('fill-clutch'),
    fillBrake: document.getElementById('fill-brake'),
    fillThrottle: document.getElementById('fill-throttle'),
    gearDisplay: document.getElementById('gearDisplay'),
    gearDisplayIndependent: document.getElementById('gearDisplayIndependent'),
    gmeterDisplay: document.getElementById('gmeterDisplay'),
    gmeterBall: document.getElementById('gmeterBall'),
    gmeterTrail: document.getElementById('gmeterTrail'),
    toggleGmeterTrail: document.getElementById('toggleGmeterTrail'),
    hudContainer: document.querySelector('.hud-container'),
    hudContainerWrapper: document.querySelector('.hud-container-wrapper'),
    captureOverlay: document.getElementById('captureOverlay'),
    captureTitle: document.getElementById('captureTitle'),
    captureText: document.getElementById('captureText'),
    cancelCaptureBtn: document.getElementById('cancelCapture'),
    notificationUnsaved: document.getElementById('notificationUnsaved'),
    unsavedOkBtn: document.getElementById('unsavedOkBtn'),
    unsavedCancelBtn: document.getElementById('unsavedCancelBtn'),
    notificationNewPreset: document.getElementById('notificationNewPreset'),
    newPresetOkBtn: document.getElementById('newPresetOkBtn'),
    newPresetCancelBtn: document.getElementById('newPresetCancelBtn'),
    notificationEmpty: document.getElementById('notificationEmptyConfig'),
    emptyOkBtn: document.getElementById('emptyConfigOkBtn'),
    notificationDeletePreset: document.getElementById('notificationDeletePreset'),
    deletePresetOkBtn: document.getElementById('deletePresetOkBtn'),
    deletePresetCancelBtn: document.getElementById('deletePresetCancelBtn'),
    deletePresetMessage: document.getElementById('deletePresetMessage'),
    deletePresetTitle: document.getElementById('deletePresetTitle'),
    notificationStatus: document.getElementById('notificationStatus'),
    statusMessageText: document.getElementById('statusMessageText'),
    languageSelect: document.getElementById('languageSelect'),
    carSelect: document.getElementById('carSelect'),
    wheelRangeSelect: document.getElementById('wheelRangeSelect'),
    throttleRangeSelect: document.getElementById('throttleRangeSelect'),
    brakeRangeSelect: document.getElementById('brakeRangeSelect'),
    clutchRangeSelect: document.getElementById('clutchRangeSelect'),
    handbrakeRangeSelect: document.getElementById('handbrakeRangeSelect'),
    axisValueElements: document.querySelectorAll('.axis-value'),
    handbrakeBtnSlots: document.querySelectorAll('.handbrake-btn-slot'),
    gearBtnSlots: document.querySelectorAll('.gear-btn-slot'),

    // === Мультивиджет ===
    multiWidgetTabs: document.getElementById('multiWidgetTabs'),
    mwTabContainer: document.getElementById('mwTabContainer'),
    mwRemoveSlot: document.getElementById('mwRemoveSlot'),
    mwAddSlot: document.getElementById('mwAddSlot'),

    // === КЭШ CSS ЗНАЧЕНИЙ ===
    cssBaseValues: {
        wheelSize: 0,
        pedalWidth: 0,
        pedalWidthCompact: 0,
        pedalGap: 0,
        widgetGap: 0,
        widgetPadding: 0,
        graphWidth: 0,
        graphWidthIndependent: 0,
        widgetHeight: 0,
        glowBlur: 0,
        markerWidth: 0,
        gearFontSize: 0,
        gearDisplaySize: 0
    },

    // Флаг, указывающий на необходимость пересчёта кэша
    cssCacheValid: false
};

// Карта: configKey → DOM toggle (для Proxy)
const CONFIG_PROXY_MAP = {
    showBg: DOM.toggleBg,
    showPedalLabels: DOM.togglePedalLabelsBtn,
    layoutReverse: DOM.toggleLayoutOrderBtn,
    handbrakeOnRight: DOM.toggleHandbrakeRightBtn,
    gearIndependent: DOM.toggleGearIndependent,
    gearSyncWithWheel: DOM.toggleGearSync,
    graphIndependent: DOM.toggleGraphIndependent,
    graphsOnly: DOM.toggleGraphsOnlyBtn,
    showGmeter: DOM.toggleGmeter,
    showGmeterTrail: DOM.toggleGmeterTrail,
    useUdpTelemetry: DOM.toggleUdpTelemetryBtn,
    showPedalsInUdp: DOM.togglePedalsUdpBtn,
    showHandbrakeUdp: DOM.toggleHandbrakeUdpBtn,
    showWheelUdp: DOM.toggleWheelUdpBtn,
    showGearUdp: DOM.toggleGearUdpBtn,
    udpSmoothing: DOM.toggleUdpSmoothingBtn,
    noCornerRounding: DOM.toggleNoCornerRounding,
    showTvdResults: DOM.toggleTvdResults
};

// Реальный объект конфига (в обход Proxy, для updateToggleState)
let _rawConfig;

/** Создаёт Proxy над currentConfig: при disabled тогглера чтение ключа возвращает false */
function makeConfigProxy(base) {
    // toJSON для JSON.stringify — читает реальные значения, без маскировки Proxy
    base.toJSON = function () { return { ..._rawConfig }; };
    _rawConfig = base;
    return new Proxy(base, {
        get(target, prop) {
            const toggle = CONFIG_PROXY_MAP[prop];
            if (toggle?.classList.contains('disabled')) return false;
            return target[prop];
        },
        set(target, prop, val) { target[prop] = val; return true; }
    });
}

/** Чтение currentConfig без маскировки Proxy */
function getRawConfig(key) { return _rawConfig?.[key]; }

// ==========================================
// 2. ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И КОНСТАНТЫ
// ==========================================
const URL_PARAMS = new URLSearchParams(window.location.search);
const URL_CONFIG_NAME = URL_PARAMS.get('config');
const PRESET_NAME = URL_PARAMS.get('preset');
const CONFIG_FILE = PRESET_NAME ? ('presets/' + PRESET_NAME + '.js')
    : (URL_CONFIG_NAME
        ? (URL_CONFIG_NAME.endsWith('.js') ? URL_CONFIG_NAME : URL_CONFIG_NAME + '.js')
        : 'NoApp.js');
const URL_STEERING_ANGLE = parseInt(URL_PARAMS.get('steering')) || null;
const URL_HIDE_GEAR = URL_PARAMS.has('nogears');
const URL_SCALE_PERCENT = parseInt(URL_PARAMS.get('scale')) || null;
const URL_HIDE_PARAM = URL_PARAMS.get('hide');
const URL_MW_PARAM = parseInt(URL_PARAMS.get('mw')) || null;

let URL_SCALE = null;
if (URL_SCALE_PERCENT !== null) {
    let clamped = Math.max(100, Math.min(300, URL_SCALE_PERCENT));
    let rounded = Math.round(clamped / 50) * 50;
    URL_SCALE = rounded / 100;
}

const NO_TELEMETRY_GAME = 'Без телеметрии';

const LANGUAGES = {
    ru: { handbrake: 'РУЧНИК', clutch: 'СЦЕПЛЕНИЕ', brake: 'ТОРМОЗ', throttle: 'ГАЗ' },
    en: { handbrake: 'HANDBRAKE', clutch: 'CLUTCH', brake: 'BRAKE', throttle: 'THROTTLE' },
    cn: { handbrake: '手刹', clutch: '离合器', brake: '刹车', throttle: '油门' }
};

/** Преобразует event.code в читаемое короткое имя для UI */
const MESSAGES = {
    capture: {
        wheel: { title: 'Ось руля', text: 'Покрутите руль...' },
        throttle: { title: 'Ось газа', text: 'Нажмите педаль газа...' },
        brake: { title: 'Ось тормоза', text: 'Нажмите педаль тормоза...' },
        clutch: { title: 'Ось сцепления', text: 'Нажмите педаль сцепления...' },
        handbrake: { title: 'Ручник (ось)', text: 'Передёрните 😏 ручник...' },
        'handbrake-button': { title: 'Ручник (кнопка)', text: 'Нажмите кнопку...' },
        'gear-button': { title: 'Передача', text: 'Нажмите кнопку...' }
    }
};

const AXIS_CONFIG_MAP = {
    wheel: { axisKey: 'wheelAxis', deviceKey: 'wheelDeviceId', invertKey: 'invertWheel', rangeKey: 'wheelRange', graphKey: 'showWheelGraph', graphBtn: 'toggleWheelGraphBtn' },
    throttle: { axisKey: 'throttleAxis', deviceKey: 'throttleDeviceId', invertKey: 'invertThrottle', rangeKey: 'throttleRange', graphKey: 'showThrottleGraph', graphBtn: 'toggleThrottleGraphBtn' },
    brake: { axisKey: 'brakeAxis', deviceKey: 'brakeDeviceId', invertKey: 'invertBrake', rangeKey: 'brakeRange', graphKey: 'showBrakeGraph', graphBtn: 'toggleBrakeGraphBtn' },
    clutch: { axisKey: 'clutchAxis', deviceKey: 'clutchDeviceId', invertKey: 'invertClutch', rangeKey: 'clutchRange', graphKey: 'showClutchGraph', graphBtn: 'toggleClutchGraphBtn' },
    handbrake: { axisKey: 'handbrakeAxis', deviceKey: 'handbrakeAxisDeviceId', invertKey: 'invertHandbrake', rangeKey: 'handbrakeRange', graphKey: 'showHandbrakeGraph', graphBtn: 'toggleHandbrakeGraphBtn' }
};

const PEDAL_TYPES = ['throttle', 'brake', 'clutch', 'handbrake'];
const SCAN_CONFIG = { AXIS_MOVEMENT_THRESHOLD: 0.00025, BUTTON_MOVEMENT_THRESHOLD: 0.1, UPDATE_RATE: 30 };
const HISTORY_SIZE = 180;
const GRAPH_FRAME_DELAY = 1000 / 180;
const THEME_NAMES = { Default: 'Стандартная', Dark: 'Тёмная', White: 'Белая', Black: 'Чёрная', Monochrome: 'Монохромная', Vintage: 'Винтажная', Pastel: 'Пастель', DR2: 'DR2', BeamNG: 'BeamNG' };
const LANGUAGE_NAMES = { en: 'Английский', ru: 'Русский', cn: 'Китайский' };

// Кэш цветов для производительности
const COLOR_CACHE = { currentTheme: null, cssVars: {} };
const CSS_COLOR_KEYS = {
    pedalHandbrake: '--pedal-handbrake', pedalClutch: '--pedal-clutch', pedalBrake: '--pedal-brake', pedalThrottle: '--pedal-throttle',
    wheelMarker: '--wheel-marker', wheelSpoke: '--wheel-spoke', wheelRim: '--wheel-rim',
    graphGrid: '--graph-grid', graphText: '--graph-text',
    widgetBg: '--widget-bg', pedalBg: '--pedal-bg', pedalText: '--pedal-text',
    gmeterTrail: '--gmeter-trail',
    gmeterRingsDashed: '--gmeter-rings-dashed'
};

// Менеджер пресетов (localStorage + C#)
const ConfigManager = {
    STORAGE_KEY: 'minihud_presets',
    CURRENT_KEY: 'minihud_current_preset',

    listSync() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            return data ? Object.keys(JSON.parse(data)) : [];
        } catch { return []; }
    },

    loadSync(name) {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            const presets = data ? JSON.parse(data) : {};
            return presets[name] || null;
        } catch { return null; }
    },

    saveSync(name, configObj) {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            const presets = data ? JSON.parse(data) : {};
            presets[name] = configObj;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets));
        } catch {}
    },

    deleteSync(name) {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            const presets = data ? JSON.parse(data) : {};
            delete presets[name];
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets));
        } catch {}
    },

    getCurrent() {
        return localStorage.getItem(this.CURRENT_KEY) || '';
    },

    setCurrent(name) {
        if (name) {
            localStorage.setItem(this.CURRENT_KEY, name);
        } else {
            localStorage.removeItem(this.CURRENT_KEY);
        }
    }
};

// Состояние приложения
let currentConfig;
let active = false;
let captureMode = null;
let gameLoopInterval = null;
let deviceName = '';
let lastGraphTime = 0;
let cachedWidgetSize = '???×???';
// История значений для графиков
const lastValues = { wheel: null, throttle: null, brake: null, clutch: null, handbrake: null };
const pedalHistory = {
    wheel: Array(HISTORY_SIZE).fill(0), throttle: Array(HISTORY_SIZE).fill(0),
    brake: Array(HISTORY_SIZE).fill(0), clutch: Array(HISTORY_SIZE).fill(0),
    handbrake: Array(HISTORY_SIZE).fill(0), index: 0
};

// G-meter trail: 60 точек через каждые 30 мс ≈ 1.8 с шлейфа (как было при 180×10 мс)
const GMETER_TRAIL_SIZE = 60;
const GMETER_TRAIL_INTERVAL_MS = 30;
const GMETER_TRAIL_DRAW_MS = 33;
const gmeterTrail = {
    lat: new Float64Array(GMETER_TRAIL_SIZE),
    lon: new Float64Array(GMETER_TRAIL_SIZE),
    idx: 0,
    count: 0
};
const gmeterSmooth = { lat: 0, lon: 0, factor: 0.3 };
const udpSmooth = { steering: 0, throttle: 0, brake: 0, clutch: 0, factor: 0.3 };
const gmeterCache = { width: 100, ballSize: 0.2 };
let _trailDirty = false;
let _trailLastAppendMs = 0;
let _trailLastDrawMs = 0;
// Флаг: девайс уже возвращал ненулевое значение хотя бы по одной оси
// Пока false — все оси геймпада считаем спящими (возвращаем null → 0% на индикаторах)
let _deviceAwake = false;

// Состояние сканера устройств
const scannerState = {
    axis: new Map(), button: new Map(), lastActiveElement: null,
    frameCount: 0, isScanning: false, scanAnimationFrameId: null
};

// Карта коротких имён → конфиг-ключи для глобального скрытия (OFF-режим мультивиджета)
const HIDE_CONFIG_MAP = {
    wh: 'hideWheel', th: 'hideThrottle', br: 'hideBrake',
    cl: 'hideClutch', hb: 'hideHandbrake', gb: 'hideGear',
    gm: 'hideGmeter', gr: 'hideGraphs', bg: 'hideBg', tr: 'hideTvdResults'
};

// Конфигурация по умолчанию
const DEFAULT_CONFIG = {
    language: 'ru', scale: 1.0, steeringAngle: 540, showBg: true, widgetBgOpacity: 0.75, showPedalLabels: true, layoutReverse: false,
    handbrakeOnRight: false, gearIndependent: false, gearOnRight: false, gearSyncWithWheel: false, graphIndependent: false, graphsOnly: false, showGmeter: false, showGmeterTrail: true,
    wheelAxis: null, wheelDeviceId: null, invertWheel: false, wheelRange: 'full', showWheelGraph: false,
    throttleAxis: null, throttleDeviceId: null, invertThrottle: false, throttleRange: 'full', showThrottleGraph: false,
    brakeAxis: null, brakeDeviceId: null, invertBrake: false, brakeRange: 'full', showBrakeGraph: false,
    clutchAxis: null, clutchDeviceId: null, invertClutch: false, clutchRange: 'full', showClutchGraph: false,
    handbrakeAxis: null, handbrakeAxisDeviceId: null, invertHandbrake: false, handbrakeRange: 'full', showHandbrakeGraph: false,
    handbrakeButtons: [-1, -1, -1, -1, -1], handbrakeButtonsDeviceIds: [null, null, null, null, null],
    handbrakeKeyboardKeys: [null, null, null, null, null],
    gearButtons: [-1, -1, -1, -1, -1, -1, -1, -1], gearButtonsDeviceIds: [null, null, null, null, null, null, null, null],
    theme: 'Default', selectedCar: '', gearScale: 1.0, useUdpTelemetry: false,
    showPedalsInUdp: false, showGearUdp: true, showWheelUdp: false, showHandbrakeUdp: false, udpSmoothing: false, noCornerRounding: false,
    hideWheel: false, hideThrottle: false, hideBrake: false,
    hideClutch: false, hideHandbrake: false, hideGear: false,
    hideGmeter: false, hideGraphs: false, hideBg: false, hideTvdResults: false,
    showTvdResults: false, tvdResultsSeconds: 60,
    multiWidgetMode: false,
    multiWidgetSlots: [],
    multiWidgetActiveSlot: 0
};

// Состояние UDP WebSocket
const udpState = {
    socket: null,
    connected: false,
    cSharpEnabled: false,
    handbrakeInTelemetry: false,
    steeringInTelemetry: false,
    data: { throttleInput: 0, steeringInput: 0, brakeInput: 0, clutchInput: 0, handbrake: false, gear: 'N', speed: 0, engineRate: 0 },
    lastDataTime: 0
};

let WS_PORT = (() => {
    const params = new URLSearchParams(window.location.search);
    const wsport = params.get('wsport');
    return wsport ? parseInt(wsport, 10) : 20888;
})();



// Инициализация текущего конфига (Proxy: disabled-тогглеры маскируют чтение в false)
currentConfig = makeConfigProxy({ ...DEFAULT_CONFIG });

// ==========================================
// 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (UTILS)
// ==========================================

/** Получает текущий угол поворота руля (из URL или конфига) */
function getSteeringAngle() {
    return URL_STEERING_ANGLE !== null ? URL_STEERING_ANGLE : currentConfig.steeringAngle;
}

/** Ограничивает значение диапазоном [min, max] */
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/** Есть ли активный UDP-источник данных для КПП */
function hasUdpGear() {
    return currentConfig.useUdpTelemetry && currentConfig.showGearUdp && udpState.connected;
}

/** Есть ли активный UDP-источник данных для руля */
function hasUdpWheel() {
    return currentConfig.useUdpTelemetry && currentConfig.showWheelUdp && udpState.connected;
}

/** Есть ли активный UDP-источник данных для педалей */
function hasUdpPedals() {
    return currentConfig.useUdpTelemetry && currentConfig.showPedalsInUdp && udpState.connected;
}

// --- Клавиатурные бинды ---
const keyboardState = {};

function getKeyDisplayName(code) {
    if (!code) return '';
    if (/^Key[A-Z]$/.test(code)) return code[3];
    if (/^Digit[0-9]$/.test(code)) return code[5];
    if (/^Numpad[0-9]$/.test(code)) return 'N' + code[6];
    if (/^F(1[0-2]|[1-9])$/.test(code)) return code;
    var map = {
        'ArrowUp': '\u2191', 'ArrowDown': '\u2193', 'ArrowLeft': '\u2190', 'ArrowRight': '\u2192',
        'Space': 'Spc', 'Enter': 'Ent', 'Escape': 'Esc',
        'ShiftLeft': 'ShL', 'ShiftRight': 'ShR',
        'ControlLeft': 'CtL', 'ControlRight': 'CtR',
        'AltLeft': 'AlL', 'AltRight': 'AlR',
        'MetaLeft': 'Win', 'MetaRight': 'Win',
        'Backquote': '~', 'Backslash': '\\',
        'Backspace': 'BSp', 'CapsLock': 'CpL',
        'BracketLeft': '[', 'BracketRight': ']',
        'PageUp': 'PgU', 'PageDown': 'PgD',
        'Home': 'Hm', 'End': 'End',
        'Delete': 'Del', 'Insert': 'Ins', 'Tab': 'Tab',
        'Minus': '-', 'Equal': '=', 'Comma': ',', 'Period': '.',
        'Slash': '/', 'Semicolon': ';', 'Quote': '\'', 'NumpadEnter': 'NEnt'
    };
    return map[code] || code.substring(0, 3);
}

/** Нормализует значение оси в диапазон [-1, 1] в зависимости от выбранного режима */
function normalizeAxis(axisValue, range = 'full') {
    let normalized = axisValue;
    if (range === 'positive') normalized = axisValue * 2 - 1;
    else if (range === 'negative') normalized = axisValue * 2 + 1;
    return clamp(normalized, -1, 1);
}

/** Преобразует значение оси в проценты (0-100%) с учетом инверсии и диапазона */
function getPedalPercent(axisValue, invert = false, range = 'full') {
    const normalized = normalizeAxis(axisValue, range);
    let percent = (normalized + 1) * 50;
    if (invert) percent = 100 - percent;
    return clamp(percent, 0, 100);
}

/** Усекает длинный URL для отображения */
function truncateUrl(url, maxLength = 35) {
    if (!url || url.length <= maxLength) return url;
    const start = url.substring(0, maxLength / 2 - 2);
    const end = url.substring(url.length - maxLength / 2 + 2);
    return `${start}...${end}`;
}

/** Настраивает копирование текста при клике на элемент */
function copyToClipboard(element, fullText) {
    if (!element || !fullText) return;
    if (element.classList.contains('copy-initialized')) return;

    element.dataset.fullText = fullText;
    element.style.cursor = 'pointer';
    element.classList.add('copy-initialized');

    element.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.target.closest('[data-full-text]');
        if (!target) return;
        const text = target.dataset.fullText;

        navigator.clipboard.writeText(text).then(() => {
            const originalContent = target.innerHTML;
            target.innerHTML = t('status.copied');
            target.classList.add('copied');
            setTimeout(() => {
                target.innerHTML = originalContent;
                target.classList.remove('copied');
            }, 1200);
        }).catch(err => console.error('Ошибка копирования:', err));
    });
}

/** Включает функцию копирования для всех code элементов в контейнере */
function enableCopyOnCodes(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    const codes = container.querySelectorAll('code');
    codes.forEach(code => {
        if (code.classList.contains('copy-initialized')) return;
        code.classList.add('copyable-text');
        const text = code.dataset.fullText || code.textContent;
        copyToClipboard(code, text);
    });
}

/** Обновляет отображение URL страницы в справке */
function updatePageUrlDisplay() {
    const urlEl = document.getElementById('pageUrl');
    if (!urlEl) return;
    const currentUrl = cleanUrl(window.location.href);
    urlEl.textContent = truncateUrl(currentUrl);
    urlEl.dataset.fullText = currentUrl;
    copyToClipboard(urlEl, currentUrl);
}

/** Удаляет wsport=20888 из URL (стандартный порт не нужно передавать) */
function cleanUrl(url) {
    try {
        const u = new URL(url);
        if (u.searchParams.get('wsport') === '20888') {
            u.searchParams.delete('wsport');
        }
        return u.toString();
    } catch {
        return url;
    }
}

/** Генерирует уникальный ключ для отслеживания состояния оси/кнопки */
function generateKey(type, deviceIndex, index) {
    return `${type}-${deviceIndex}-${index}`;
}

/** Получает базовое числовое значение из CSS переменной */
function getCssBaseValue(varName) {
    if (!DOM.cssCacheValid) {
        updateCssBaseValuesCache();
    }
    return getCssBaseValueCached(varName);
}

/** Обновляет кэш базовых CSS значений */
function updateCssBaseValuesCache() {
    if (DOM.cssCacheValid) return;
    const root = document.documentElement;
    const style = getComputedStyle(root);

    // Вспомогательная функция для получения значения
    const getBaseValue = (varName) => {
        const value = style.getPropertyValue(`--${varName}-base`).trim();
        return parseFloat(value) || 0;
    };

    DOM.cssBaseValues = {
        wheelSize: getBaseValue('wheel-size'),
        pedalWidth: getBaseValue('pedal-width'),
        pedalWidthCompact: getBaseValue('pedal-width-compact'),
        pedalGap: getBaseValue('pedal-gap'),
        widgetGap: getBaseValue('widget-gap'),
        widgetPadding: getBaseValue('widget-padding'),
        graphWidth: getBaseValue('graph-width'),
        graphWidthIndependent: getBaseValue('graph-width-independent'),
        widgetHeight: getBaseValue('widget-height'),
        glowBlur: getBaseValue('glow-blur'),
        markerWidth: getBaseValue('marker-width'),
        gearFontSize: getBaseValue('gear-font-size'),
        gearDisplaySize: getBaseValue('gear-display-size'),
        gmeterBallSize: parseFloat(style.getPropertyValue('--gmeter-ball-size').trim()) / 100 || 0.2
    };
    DOM.cssCacheValid = true;
}

/** Инвалидирует кэш CSS значений (требует пересчёта) */
function invalidateCssCache() {
    DOM.cssCacheValid = false;
}

/** Получает значение из кэша с автоматическим обновлением при необходимости */
function getCssBaseValueCached(varName) {
    if (!DOM.cssCacheValid) {
        updateCssBaseValuesCache();
    }

    // Преобразуем имя переменной в ключ кэша
    const keyMap = {
        'wheel-size': 'wheelSize',
        'pedal-width': 'pedalWidth',
        'pedal-width-compact': 'pedalWidthCompact',
        'pedal-gap': 'pedalGap',
        'widget-gap': 'widgetGap',
        'widget-padding': 'widgetPadding',
        'graph-width': 'graphWidth',
        'graph-width-independent': 'graphWidthIndependent',
        'widget-height': 'widgetHeight',
        'glow-blur': 'glowBlur',
        'marker-width': 'markerWidth',
        'gear-font-size': 'gearFontSize',
        'gear-display-size': 'gearDisplaySize',
        'gmeter-ball-size': 'gmeterBallSize'
    };

    const cacheKey = keyMap[varName];
    return cacheKey ? DOM.cssBaseValues[cacheKey] : 0;
}
