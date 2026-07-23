// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ И ОБРАБОТЧИКИ СОБЫТИЙ
// ==========================================

/** Универсальная инициализация кастомного селекта */
function initCustomSelect(selectId, onChangeCallback) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const trigger = select.querySelector('.custom-select-trigger');
    const optionsContainer = select.querySelector('.custom-options');
    const options = select.querySelectorAll('.custom-option');
    if (!trigger || !optionsContainer) return;

    select.onSelectChange = onChangeCallback;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.custom-select').forEach(s => {
            if (s !== select) {
                s.classList.remove('active');
            }
        });
        select.classList.toggle('active');
    });
    options.forEach(option => {
        if (option.classList.contains('preset-separator')) return;
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            trigger.textContent = option.textContent;
            select.classList.remove('active');
            if (onChangeCallback) onChangeCallback(option, select);
        });
    });
}

/** Добавляет поддержку прокрутки колёсиком для кастомных селекторов */
function initSelectWheelScroll() {
    document.querySelectorAll('.custom-select').forEach(select => {
        const trigger = select.querySelector('.custom-select-trigger');
        const optionsContainer = select.querySelector('.custom-options');

        if (!trigger || !optionsContainer) return;

        // Обработка прокрутки колёсиком (перечитываем опции каждый раз)
        select.addEventListener('wheel', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const options = select.querySelectorAll('.custom-option');
            const scrollable = Array.from(options).filter(o => !o.classList.contains('preset-separator'));
            if (scrollable.length === 0) return;

            const delta = Math.sign(e.deltaY);

            let currentIndex = -1;
            scrollable.forEach((opt, idx) => {
                if (opt.classList.contains('selected')) {
                    currentIndex = idx;
                }
            });

            let newIndex = currentIndex + delta;
            if (newIndex < 0) newIndex = scrollable.length - 1;
            if (newIndex >= scrollable.length) newIndex = 0;

            options.forEach(opt => opt.classList.remove('selected'));
            const newOption = scrollable[newIndex];
            newOption.classList.add('selected');
            trigger.textContent = newOption.textContent;

            const onChangeCallback = select.onSelectChange;
            if (onChangeCallback) {
                onChangeCallback(newOption, select);
            }
        }, { passive: false });
    });
}

// Загрузка внешнего конфига
if (typeof DEVICES === 'undefined' || !DEVICES?.default) DEVICES = { default: { language: "en", steeringAngle: 540 } };
(function loadConfigFile(path, retried) {
    function runInit() {
        if (!window.chrome?.webview) {
            loadConfig();
        } else {
            if (!currentConfig) currentConfig = { ...DEFAULT_CONFIG };
            applyConfig();
        }
        ThemeManager.buildSelect();
        buildLanguageSelect();
        buildPresetSelect();
        if (!window.chrome?.webview) {
            initUdpWebSocket();
        }
        updateCssBaseValuesCache();
        updateWidgetLayout();
        updateUIFromConfig();
        updatePedalConfig();

        if (typeof window.MultiWidget !== 'undefined') window.MultiWidget.init();

        if (!window.chrome?.webview && !PRESET_NAME) {
            const currentPreset = ConfigManager.getCurrent();
            if (currentPreset) {
                loadPresetByName(currentPreset);
            } else {
                markSaved();
            }
        } else {
            markSaved();
        }

        // Init interface language
        if (currentConfig.interfaceLanguage) {
            setInterfaceLocale(currentConfig.interfaceLanguage);
        } else {
            currentConfig.interfaceLanguage = 'ru';
            setInterfaceLocale('ru');
        }

        // Init UI theme
        var savedTheme = localStorage.getItem('minihud_ui_theme') || 'dark';
        if (!window.chrome?.webview) applyUiTheme(savedTheme);
        setThemeIcon(savedTheme);

        // Localize modal static text and buttons
        if (DOM.cancelCaptureBtn) DOM.cancelCaptureBtn.textContent = t('capture.cancel');
        if (DOM.unsavedOkBtn) DOM.unsavedOkBtn.textContent = t('modal.yes');
        if (DOM.unsavedCancelBtn) DOM.unsavedCancelBtn.textContent = t('modal.no');
        if (DOM.newPresetOkBtn) DOM.newPresetOkBtn.textContent = t('modal.save');
        if (DOM.newPresetCancelBtn) DOM.newPresetCancelBtn.textContent = t('modal.cancel');
        if (DOM.emptyOkBtn) DOM.emptyOkBtn.textContent = t('modal.ok');
        if (DOM.deletePresetOkBtn) DOM.deletePresetOkBtn.textContent = t('modal.delete');
        if (DOM.deletePresetCancelBtn) DOM.deletePresetCancelBtn.textContent = t('modal.cancel');
        var _el;
        _el = document.querySelector('#notificationUnsaved .modal-title');
        if (_el) _el.textContent = t('modal.unsavedTitle');
        _el = document.querySelector('#notificationUnsaved .modal-text');
        if (_el) _el.textContent = t('modal.unsavedText');
        _el = document.querySelector('#notificationNewPreset .modal-title');
        if (_el) _el.textContent = t('modal.newPreset');
        _el = document.getElementById('newPresetName');
        if (_el) { _el.placeholder = t('modal.presetPlaceholder'); _el.title = t('modal.presetName'); }
        _el = document.querySelector('#notificationEmptyConfig .modal-title');
        if (_el) _el.textContent = t('modal.emptyTitle');
        _el = document.querySelector('#notificationEmptyConfig .modal-text');
        if (_el) _el.textContent = t('modal.emptyText');

        setTimeout(function() { start(); }, 100);
    }

    if (!path) {
        // HTTP mode with WS — defer init so loadConfig/applyConfig are defined
        setTimeout(runInit, 0);
        return;
    }

    const script = document.createElement('script');
    script.src = path;
    script.onload = runInit;
    script.onerror = () => {
        if (!retried && !path.startsWith('presets/')) {
            console.warn(`[Config] ${path} не найден, пробуем presets/Default.js`);
            loadConfigFile('presets/Default.js', true);
        } else {
            console.warn('[Config] Файл конфига не найден, используются настройки по умолчанию.');
            DEVICES = { default: { language: "en", steeringAngle: 540 } };
            runInit();
        }
    };
    document.head.appendChild(script);
})(CONFIG_FILE);

// Запрос списка пресетов у C# (асинхронный — ответ придёт в message handler)
function requestPresetList() {
    if (window.chrome?.webview) {
        window.chrome.webview.postMessage(JSON.stringify({ action: 'requestPresetList' }));
    }
}

// --- MultiWidget overlay ---
window._visibilityOverlay = null;
var _configReady = false;

// --- Обработка сообщений от C# (WebView2) ---
if (window.chrome?.webview) {
    window.chrome.webview.addEventListener('message', event => {
        try {
            const data = event.data;
            if (data.action === 'initSession' && data.wsPort) {
                window.isMiniRacingHUD = true;
                const pg = document.getElementById('presetGroup');
                if (pg) pg.style.display = 'flex';
                const ilg = document.getElementById('interfaceLanguageGroup');
                if (ilg) ilg.style.display = 'none';
                if (data.interfaceLanguage) setInterfaceLocale(data.interfaceLanguage);
                if (data.uiTheme) {
                    var st = localStorage.getItem('minihud_ui_theme');
                    if (st !== data.uiTheme) {
                        localStorage.setItem('minihud_ui_theme', data.uiTheme);
                    }
                    applyUiTheme(data.uiTheme);
                    setThemeIcon(data.uiTheme);
                }
                console.log('[C# message] config: selectedGame=' + data.selectedGame + ', linkedPreset=' + data.linkedPreset);
                WS_PORT = data.wsPort;
                updatePageUrlDisplay();
                window._selectedGame = data.selectedGame || 'Dirt Rally 2.0';
                udpState.handbrakeInTelemetry = data.handbrakeInTelemetry === true;
                if (data.steeringInTelemetry !== undefined) udpState.steeringInTelemetry = data.steeringInTelemetry === true;
                if (data.diMode !== undefined) {
                    _useDiMode = data.diMode === true;
                }
                if (!URL_CONFIG_NAME && !PRESET_NAME) {
                    window._linkedPreset = data.linkedPreset || '';
                    setCarSelectVisibility();
                }
                if (udpState.socket) {
                    closeUdpWebSocket();
                    setTimeout(initUdpWebSocket, 100);
                } else if (!udpState.socket) {
                    setTimeout(initUdpWebSocket, 100);
                }
                if (window.chrome?.webview) {
                    window.chrome.webview.postMessage(JSON.stringify({ action: 'getStatus' }));
                }
                updateAllToggleStates();
            } else if (data.action === 'gameChange') {
                window._selectedGame = data.selectedGame || 'Dirt Rally 2.0';
                udpState.handbrakeInTelemetry = data.handbrakeInTelemetry === true;
                if (data.steeringInTelemetry !== undefined) udpState.steeringInTelemetry = data.steeringInTelemetry === true;
                updateAllToggleStates();
                if (!URL_CONFIG_NAME && !PRESET_NAME) {
                    window._linkedPreset = data.linkedPreset || '';
                    setCarSelectVisibility();
                    ConfigManager.setCurrent('');
                    loadPresetForCurrentGame();
                }
            } else if (data.action === 'interfaceLanguageChange') {
                if (data.interfaceLanguage) setInterfaceLocale(data.interfaceLanguage);
                } else if (data.action === 'presetContent') {
                if (!PRESET_NAME) applyPreset(data.presetName, data.content);
            } else if (data.action === 'presetList') {
                const names = (data.configs || []).filter(n => n !== 'NoApp');
                buildPresetSelect(names);

                if (window._deletePresetName) {
                    const deletedName = window._deletePresetName;
                    window._deletePresetName = null;

                    if (names.length > 0) {
                        const delIdx = (window._presetNames || []).indexOf(deletedName);
                        let adjIdx = Math.min(delIdx, names.length - 1);
                        if (adjIdx < 0) adjIdx = 0;
                        const adj = names[adjIdx];

                        ConfigManager.setCurrent(adj);
                        var trigger = document.getElementById('presetSelect')?.querySelector('.custom-select-trigger');
                        if (trigger) trigger.textContent = adj;
                        loadPresetByName(adj, true);
                    } else {
                        ConfigManager.setCurrent('');
                        var trigger = document.getElementById('presetSelect')?.querySelector('.custom-select-trigger');
                        if (trigger) trigger.textContent = '';
                    }
                    return;
                }

                var alreadyLoaded = ConfigManager.getCurrent();
                if (alreadyLoaded && names.includes(alreadyLoaded))
                {
                    var trigger = document.getElementById('presetSelect')?.querySelector('.custom-select-trigger');
                    if (trigger) trigger.textContent = alreadyLoaded;
                    return;
                }

                if (window._selectedGame && !window.isMiniRacingHUD) {
                    loadPresetForCurrentGame();
                }
            } else if (data.action === 'wsRestart') {
                if (udpState.socket) closeUdpWebSocket();
                setTimeout(initUdpWebSocket, 100);
            } else if (data.action === 'status') {
                udpState.cSharpEnabled = data.udp === 'on';
                if (data.handbrakeInTelemetry !== undefined) udpState.handbrakeInTelemetry                 = data.handbrakeInTelemetry === true;
                if (data.steeringInTelemetry !== undefined) udpState.steeringInTelemetry = data.steeringInTelemetry === true;
                updateAllToggleStates();
            } else if (data.action === 'setVisibility') {
                window.MultiWidget.applyVisibilityOverlay(data.hide);
            } else if (data.action === 'applyVisibilityPreset') {
                window.MultiWidget.applyVisibilityPreset(data.hide);
            } else if (data.action === 'enableMultiWidget') {
                window.MultiWidget.enableMultiWidget(data.slots || [], data.activeSlot || 0);
            } else if (data.action === 'disableMultiWidget') {
                window.MultiWidget.disableMultiWidget();
            } else if (data.action === 'themeColors') {
                if (typeof ColorManager !== 'undefined') {
                    ColorManager.apply(data.colors || {});
                }
            } else if (data.action === 'colorUpdate') {
                if (typeof ColorManager !== 'undefined') {
                    ColorManager.apply(data.colors || {});
                }
            } else if (data.action === 'themeChange') {
                if (typeof ThemeManager !== 'undefined') {
                    ThemeManager.apply(data.theme);
                }
            } else if (data.action === 'customThemeList') {
                window._customThemes = {};
                (data.themes || []).forEach(function(t) { window._customThemes[t.name] = t; });
                ThemeManager.apply(currentConfig.theme);
                const container = document.getElementById('themeOptions');
                const themeSelect = document.getElementById('themeSelect');
                if (!container || !themeSelect) return;
                container.querySelectorAll('[data-custom]').forEach(function(el) { el.remove(); });
                const anchor = container.querySelector('.preset-separator');
                (data.themes || []).forEach(function(th) {
                    const opt = document.createElement('div');
                    opt.className = 'custom-option';
                    opt.dataset.custom = '1';
                    opt.dataset.value = th.name;
                    opt.style.position = 'relative';
                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = th.name;
                    nameSpan.style.overflow = 'hidden';
                    nameSpan.style.textOverflow = 'ellipsis';
                    nameSpan.style.whiteSpace = 'nowrap';
                    nameSpan.style.display = 'block';
                    nameSpan.style.marginRight = '16px';
                    opt.appendChild(nameSpan);
                    const deleteBtn = document.createElement('span');
                    deleteBtn.className = 'preset-delete-btn';
                    deleteBtn.textContent = '\u2715';
                    deleteBtn.title = t('theme.manage.delete');
                    deleteBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        themeSelect.classList.remove('active');
                        showNotification('deletePreset', {
                            title: t('theme.manage.deleteTitle'),
                            message: t('theme.manage.deleteConfirm', th.name),
                            onConfirm: function() {
                                if (currentConfig.theme === th.name) {
                                    ThemeManager.apply('Default');
                                }
                                if (window.chrome?.webview) {
                                    window.chrome.webview.postMessage(JSON.stringify({ action: 'deleteTheme', name: th.name }));
                                }
                            }
                        });
                    });
                    opt.appendChild(deleteBtn);
                    opt.addEventListener('click', function(e) {
                        e.stopPropagation();
                        if (typeof ThemeManager !== 'undefined') {
                            ThemeManager.apply(th.name);
                        }
                        themeSelect.classList.remove('active');
                    });
                    if (anchor) {
                        container.insertBefore(opt, anchor);
                    } else {
                        container.appendChild(opt);
                    }
                });
                return;
            }
        } catch (e) {
            console.warn('[UDP] Ошибка обработки сообщения от C#:', e);
        }
    });
}

// --- Event Listeners ---

// Логика сворачивания справки
const toggleHelpBtn = document.getElementById('toggleHelpBtn');
const hudInfoBlock = document.getElementById('hudInfoBlock');
if (toggleHelpBtn && hudInfoBlock) {
    toggleHelpBtn.addEventListener('click', () => {
        hudInfoBlock.classList.toggle('collapsed');
        toggleHelpBtn.classList.add('animation-stopped');
    });
}

function applyUiTheme(name) {
    document.documentElement.setAttribute('data-theme-ui', name);
}

function setThemeIcon(theme) {
    var btn = document.querySelector('.theme-btn');
    if (!btn) return;
    var sun = btn.querySelector('.theme-icon-sun');
    var moon = btn.querySelector('.theme-icon-moon');
    if (!sun || !moon) return;
    var isDark = theme === 'dark';
    sun.style.display = isDark ? '' : 'none';
    moon.style.display = isDark ? 'none' : '';
    var key = isDark ? 'theme.ui.light' : 'theme.ui.dark';
    btn.setAttribute('data-i18n-title', key);
    btn.title = t(key);
}

// Toggle UI-темы (светлая/тёмная)
document.querySelector('.theme-btn')?.addEventListener('click', () => {
    var current = localStorage.getItem('minihud_ui_theme') || 'dark';
    var next = current === 'dark' ? 'light' : 'dark';
    applyUiTheme(next);
    setThemeIcon(next);
    if (window.chrome?.webview) {
        window.chrome.webview.postMessage(JSON.stringify({ action: 'toggleUiTheme' }));
    }
    localStorage.setItem('minihud_ui_theme', next);
});

DOM.toggleBg?.addEventListener('click', () => {
    currentConfig.showBg = !currentConfig.showBg;
    document.documentElement.classList.toggle('hide-bg', !currentConfig.showBg);
    updateAllToggleStates();
    sendConfigUpdate();
});


DOM.togglePedalLabelsBtn?.addEventListener('click', () => {
    currentConfig.showPedalLabels = !currentConfig.showPedalLabels;
    updateAllToggleStates();
    updatePedalConfig();
    updateWidgetLayout();
    sendConfigUpdate();
});

DOM.toggleGearSync?.addEventListener('click', () => {
    if (DOM.toggleGearSync.classList.contains('disabled')) return;
    currentConfig.gearSyncWithWheel = !currentConfig.gearSyncWithWheel;
    updateAllToggleStates();
    sendConfigUpdate();
});

DOM.toggleGraphIndependent?.addEventListener('click', () => {
    if (DOM.toggleGraphIndependent.classList.contains('disabled')) return;
    currentConfig.graphIndependent = !currentConfig.graphIndependent;
    if (!currentConfig.graphIndependent) {
        currentConfig.graphsOnly = false;
    }
    updateAllToggleStates();
    updateWidgetLayout();
    GraphManager.updateVisibility();
    GraphManager.debouncedRender();
    sendConfigUpdate();
});

DOM.toggleLayoutOrderBtn?.addEventListener('click', () => {
    currentConfig.layoutReverse = !currentConfig.layoutReverse;
    updateAllToggleStates();

    if (currentConfig.gearIndependent) {
        currentConfig.gearOnRight = !currentConfig.layoutReverse;
    }

    updateWidgetLayout();
    sendConfigUpdate();
});

DOM.toggleHandbrakeRightBtn?.addEventListener('click', () => {
    currentConfig.handbrakeOnRight = !currentConfig.handbrakeOnRight;
    updateAllToggleStates();
    updatePedalOrder();
    sendConfigUpdate();
});

DOM.toggleGearIndependent?.addEventListener('click', () => {
    if (DOM.toggleGearIndependent.classList.contains('disabled')) return;
    currentConfig.gearIndependent = !currentConfig.gearIndependent;
    if (currentConfig.gearIndependent) {
        currentConfig.showGmeter = false;
        currentConfig.gearOnRight = !currentConfig.layoutReverse;
    }
    updateAllToggleStates();
    updateWidgetLayout();
    updateGearScaleFactor();
    sendConfigUpdate();
});

DOM.toggleGmeter?.addEventListener('click', () => {
    if (DOM.toggleGmeter.classList.contains('disabled')) return;
    currentConfig.showGmeter = !currentConfig.showGmeter;
    if (currentConfig.showGmeter) {
        currentConfig.gearIndependent = false;
    }
    updateAllToggleStates();
    updateWidgetLayout();
    sendConfigUpdate();
});

DOM.toggleGmeterTrail?.addEventListener('click', () => {
    if (DOM.toggleGmeterTrail.classList.contains('disabled')) return;
    currentConfig.showGmeterTrail = !currentConfig.showGmeterTrail;
    updateAllToggleStates();
    if (!currentConfig.showGmeterTrail && DOM.gmeterTrail) {
        const ctx = DOM.gmeterTrail.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, DOM.gmeterTrail.width, DOM.gmeterTrail.height);
    }
    sendConfigUpdate();
});

DOM.toggleGraphsOnlyBtn?.addEventListener('click', () => {
    if (DOM.toggleGraphsOnlyBtn.classList.contains('disabled')) return;
    currentConfig.graphsOnly = !currentConfig.graphsOnly;
    if (currentConfig.graphsOnly) {
        currentConfig.graphIndependent = true;
    }
    updateAllToggleStates();
    updateWidgetLayout();
    GraphManager.updateVisibility();
    GraphManager.debouncedRender();
    sendConfigUpdate();
});

DOM.toggleNoCornerRounding?.addEventListener('click', () => {
    currentConfig.noCornerRounding = !currentConfig.noCornerRounding;
    updateAllToggleStates();
    updateWidgetLayout();
    sendConfigUpdate();
});

DOM.toggleUdpTelemetryBtn?.addEventListener('click', () => {
    if (DOM.toggleUdpTelemetryBtn.classList.contains('disabled') || DOM.toggleUdpTelemetryBtn.disabled) return;
    currentConfig.useUdpTelemetry = !currentConfig.useUdpTelemetry;

    if (currentConfig.useUdpTelemetry) {
        initUdpWebSocket();
    }

    updateGearPosition();
    updateWidgetLayout();
    updateAllToggleStates();
    sendConfigUpdate();
});

DOM.togglePedalsUdpBtn?.addEventListener('click', () => {
    if (DOM.togglePedalsUdpBtn.disabled) return;
    currentConfig.showPedalsInUdp = !currentConfig.showPedalsInUdp;
    updateAllToggleStates();
    sendConfigUpdate();
});

DOM.toggleWheelUdpBtn?.addEventListener('click', () => {
    if (DOM.toggleWheelUdpBtn.disabled) return;
    currentConfig.showWheelUdp = !currentConfig.showWheelUdp;
    updateAllToggleStates();
    updateWidgetLayout();
    sendConfigUpdate();
});

DOM.toggleHandbrakeUdpBtn?.addEventListener('click', () => {
    if (DOM.toggleHandbrakeUdpBtn.disabled) return;
    currentConfig.showHandbrakeUdp = !currentConfig.showHandbrakeUdp;
    updateAllToggleStates();
    updateWidgetLayout();
    sendConfigUpdate();
});

DOM.toggleGearUdpBtn?.addEventListener('click', () => {
    if (DOM.toggleGearUdpBtn.disabled) return;
    currentConfig.showGearUdp = !currentConfig.showGearUdp;
    updateAllToggleStates();
    updateWidgetLayout();
    sendConfigUpdate();
});

DOM.toggleUdpSmoothingBtn?.addEventListener('click', () => {
    if (DOM.toggleUdpSmoothingBtn.disabled) return;
    currentConfig.udpSmoothing = !currentConfig.udpSmoothing;
    updateAllToggleStates();
    sendConfigUpdate();
});

DOM.cancelCaptureBtn?.addEventListener('click', () => {
    stopScanning();
    captureMode = null;
});

// ==========================================
// UDP WebSocket Клиент
// ==========================================

let _wsReconnectDelay = 1000;
let _wsReconnectTimer = null;
let _diDevices = [];
let _useDiMode = false;
let _gpBindings = {};
let _diBindings = {};
let _gpPopulated = false;
let _diPopulated = false;
let _diTimeout = null;

var BINDING_KEYS = [
    'wheelAxis', 'wheelDeviceId', 'invertWheel', 'wheelRange', 'showWheelGraph',
    'throttleAxis', 'throttleDeviceId', 'invertThrottle', 'throttleRange', 'showThrottleGraph',
    'brakeAxis', 'brakeDeviceId', 'invertBrake', 'brakeRange', 'showBrakeGraph',
    'clutchAxis', 'clutchDeviceId', 'invertClutch', 'clutchRange', 'showClutchGraph',
    'handbrakeAxis', 'handbrakeAxisDeviceId', 'invertHandbrake', 'handbrakeRange', 'showHandbrakeGraph',
    'handbrakeButtons', 'handbrakeButtonsDeviceIds',
    'gearButtons', 'gearButtonsDeviceIds'
];

var BINDING_DEFAULTS = {
    wheelAxis: null, wheelDeviceId: null, invertWheel: false, wheelRange: 'full', showWheelGraph: false,
    throttleAxis: null, throttleDeviceId: null, invertThrottle: false, throttleRange: 'full', showThrottleGraph: false,
    brakeAxis: null, brakeDeviceId: null, invertBrake: false, brakeRange: 'full', showBrakeGraph: false,
    clutchAxis: null, clutchDeviceId: null, invertClutch: false, clutchRange: 'full', showClutchGraph: false,
    handbrakeAxis: null, handbrakeAxisDeviceId: null, invertHandbrake: false, handbrakeRange: 'full', showHandbrakeGraph: false,
    handbrakeButtons: [-1, -1, -1, -1, -1], handbrakeButtonsDeviceIds: [null, null, null, null, null],
    gearButtons: [-1, -1, -1, -1, -1, -1, -1, -1], gearButtonsDeviceIds: [null, null, null, null, null, null, null, null]
};

function saveBindings(target) {
    BINDING_KEYS.forEach(function(k) { target[k] = currentConfig[k]; });
}

function loadBindings(source) {
    BINDING_KEYS.forEach(function(k) { currentConfig[k] = source[k]; });
    if (typeof applyConfig === 'function') applyConfig();
}

function clearBindings() {
    BINDING_KEYS.forEach(function(k) { currentConfig[k] = BINDING_DEFAULTS[k]; });
    if (typeof applyConfig === 'function') applyConfig();
}

function clearWsReconnectTimer() {
    if (_wsReconnectTimer) {
        clearTimeout(_wsReconnectTimer);
        _wsReconnectTimer = null;
    }
}

function initUdpWebSocket() {
    if (udpState.socket) return;
    clearWsReconnectTimer();

    try {
        udpState.socket = new WebSocket(`ws://127.0.0.1:${WS_PORT}`);

        udpState.socket.onopen = () => {
            udpState.connected = true;
            window._wsConnected = true;
            _wsReconnectDelay = 1000;
            udpSmooth.steering = 0; udpSmooth.throttle = 0; udpSmooth.brake = 0; udpSmooth.clutch = 0;
            updateAllToggleStates();
            updateWidgetLayout();
            udpState.socket.send(JSON.stringify({ action: 'requestPreset' }));
            // Синхронизировать изменения, сделанные до соединения WS
            sendConfigUpdate();
        };

        udpState.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                // Контрольные сообщения — редкий путь
                if (data.action) {
                    switch (data.action) {
                        case 'presetContent':
                            if (data.presetName && data.content && (!PRESET_NAME || data.presetName === PRESET_NAME)) {
                                applyPreset(data.presetName, data.content);
                            }
                            return;

                        case 'status':
                            udpState.cSharpEnabled = data.udp === 'on';
                            if (data.handbrakeInTelemetry !== undefined) udpState.handbrakeInTelemetry = data.handbrakeInTelemetry === true;
                            if (data.steeringInTelemetry !== undefined) udpState.steeringInTelemetry = data.steeringInTelemetry === true;
                            updateAllToggleStates();
                            return;

                        case 'diState':
                            if (data.devices && data.devices.length > 0) {
                                _diDevices = data.devices;
                                clearTimeout(_diTimeout);
                                _diTimeout = setTimeout(function() {
                                    if (!_useDiMode) return;
                                    saveBindings(_diBindings);
                                    _diPopulated = true;
                                    _useDiMode = false;
                                    if (_gpPopulated) loadBindings(_gpBindings);
                                    else clearBindings();
                                    updateBindingsUI();
                                    updateUIFromConfig();
                                }, 2000);
                            }
                            return;

                        case 'toggleDiMode':
                            if (!data.enabled) { clearTimeout(_diTimeout); _diTimeout = null; }
                            if (_useDiMode) { saveBindings(_diBindings); _diPopulated = true; }
                            else { saveBindings(_gpBindings); _gpPopulated = true; }

                            _useDiMode = data.enabled === true;

                            var source = _useDiMode ? _diBindings : _gpBindings;
                            var populated = _useDiMode ? _diPopulated : _gpPopulated;
                            if (populated) loadBindings(source);
                            else clearBindings();

                            updateBindingsUI();
                            updateUIFromConfig();
                            updateWidgetLayout();
                            if (typeof GraphManager !== 'undefined') GraphManager.debouncedRender();
                            return;

                        case 'configUpdate':
                            console.log('[WS] received configUpdate, isMiniRacingHUD=' + window.isMiniRacingHUD + ', config type=' + typeof data.config + ', theme=' + (data.config?.theme || 'N/A'));
                            if (window.isMiniRacingHUD || PRESET_NAME) { console.log('[WS] configUpdate SKIPPED (isMiniRacingHUD=' + window.isMiniRacingHUD + ', PRESET_NAME=' + PRESET_NAME + ')'); return; }
                            if (data.config && typeof data.config === 'object') {
                                Object.assign(currentConfig, data.config);

                                if (currentConfig.multiWidgetMode && currentConfig.multiWidgetSlots) {
                                    if (typeof syncOverlayToSlot === 'function') {
                                        syncOverlayToSlot();
                                    }
                                    if (typeof _multiWidgetSlots !== 'undefined') {
                                        _multiWidgetSlots = JSON.parse(JSON.stringify(currentConfig.multiWidgetSlots));
                                    }
                                    var slotIdx = currentConfig.multiWidgetActiveSlot || 0;
                                    if (typeof URL_MW_PARAM !== 'undefined' && URL_MW_PARAM !== null) {
                                        slotIdx = Math.min(URL_MW_PARAM - 1, currentConfig.multiWidgetSlots.length - 1);
                                        if (slotIdx < 0) slotIdx = 0;
                                    }
                                    if (typeof _multiWidgetActiveSlot !== 'undefined') {
                                        _multiWidgetActiveSlot = slotIdx;
                                    }
                                    currentConfig.multiWidgetActiveSlot = slotIdx;
                                    if (typeof applySlotToOverlay === 'function') {
                                        applySlotToOverlay(slotIdx);
                                    }
                                    if (typeof renderMultiWidgetTabs === 'function') {
                                        renderMultiWidgetTabs();
                                    }
                                    if (typeof HIDE_CONFIG_MAP !== 'undefined') {
                                        _savedOffModeHide = Object.keys(HIDE_CONFIG_MAP).map(function(key) {
                                            return currentConfig[HIDE_CONFIG_MAP[key]];
                                        });
                                    }
                                } else {
                                    window._hideOverlay = null;
                                    window._urlOverlayExplicit = false;
                                }

                                applyConfig();
                                updateAllToggleStates();
                                updateWidgetLayout();
                                if (typeof GraphManager !== 'undefined') GraphManager.debouncedRender();
                                if (typeof window.MultiWidget !== 'undefined') window.MultiWidget.syncPanelCheckboxes();
                                console.log('[WS] configUpdate applied');
                            } else {
                                console.log('[WS] configUpdate: invalid config', data.config);
                            }
                            return;

                        case 'themeColors':
                            if (!PRESET_NAME && typeof ColorManager !== 'undefined') {
                                ColorManager.apply(data.colors || {});
                            }
                            return;

                        case 'colorUpdate':
                            if (!PRESET_NAME && typeof ColorManager !== 'undefined') {
                                ColorManager.apply(data.colors || {});
                                if (data.name) {
                                    if (!window._customThemes) window._customThemes = {};
                                    window._customThemes[data.name] = window._customThemes[data.name] || {};
                                    window._customThemes[data.name].colors = data.colors;
                                }
                            }
                            return;
                    }
                    return;
                }

                // Валидация полей телеметрии
                var numericKeys = ['throttleInput','brakeInput','clutchInput','steeringInput','speed','speedMs','speedKmh','engineRate','gForceLateral','gForceLongitudinal','gameId'];
                numericKeys.forEach(function(k) { if (typeof data[k] !== 'number') data[k] = 0; });
                if (typeof data.gear !== 'number') data.gear = 0;

                udpState.data = data;
                udpState.lastDataTime = performance.now();

                // G-meter: сглаживание + запись сырых точек в буфер
                if (currentConfig.showGmeter && window.MultiWidget.isVisible('gm')) {
                    let lat = data.gForceLateral || 0;
                    let lon = data.gForceLongitudinal || 0;
                    if (data.gameId === 1) lon = -lon;
                    gmeterSmooth.lat += (lat - gmeterSmooth.lat) * gmeterSmooth.factor;
                    gmeterSmooth.lon += (lon - gmeterSmooth.lon) * gmeterSmooth.factor;
                    lat = gmeterSmooth.lat;
                    lon = gmeterSmooth.lon;
                    renderGmeter(lat, lon);
                    gmeterTrail.lat[gmeterTrail.idx] = lat;
                    gmeterTrail.lon[gmeterTrail.idx] = lon;
                    gmeterTrail.idx = (gmeterTrail.idx + 1) % GMETER_TRAIL_SIZE;
                    if (gmeterTrail.count < GMETER_TRAIL_SIZE) gmeterTrail.count++;
                    _trailDirty = true;
                }
            } catch (e) {
                console.warn('[UDP] Ошибка парсинга:', e);
            }
        };

        udpState.socket.onclose = () => {
            udpState.connected = false;
            window._wsConnected = false;
            udpState.socket = null;
            udpState.data = { throttleInput: 0, steeringInput: 0, brakeInput: 0, clutchInput: 0, gear: 'N', speed: 0, engineRate: 0 };
            gmeterTrail.lat.fill(0);
            gmeterTrail.lon.fill(0);
            gmeterTrail.idx = 0;
            gmeterTrail.count = 0;
            _trailDirty = false;
            gmeterSmooth.lat = 0;
            gmeterSmooth.lon = 0;

            // Если DI был включён — откатываемся на GP (для standalone/OBS)
            if (_useDiMode && !window.isMiniRacingHUD) {
                saveBindings(_diBindings);
                _diPopulated = true;
                _useDiMode = false;
                if (_gpPopulated) loadBindings(_gpBindings);
                else clearBindings();
                updateBindingsUI();
                updateUIFromConfig();
                updateWidgetLayout();
            }

            updateAllToggleStates();
            updateWidgetLayout();
            _wsReconnectTimer = setTimeout(() => {
                _wsReconnectDelay = Math.min(_wsReconnectDelay * 2, 30000);
                initUdpWebSocket();
            }, _wsReconnectDelay);
        };

        udpState.socket.onerror = (e) => {
            udpState.connected = false;
            udpState.socket = null;
            updateAllToggleStates();
            updateWidgetLayout();
            console.warn('[UDP] Ошибка WS:', e);
        };
    } catch (e) {
        console.warn('[UDP] Не удалось подключиться:', e);
    }
}

function closeUdpWebSocket() {
    clearWsReconnectTimer();
    if (udpState.socket) {
        udpState.socket.close();
        udpState.socket = null;
    }
    udpState.connected = false;
    udpState.data = { throttleInput: 0, steeringInput: 0, brakeInput: 0, clutchInput: 0, gear: 'N', speed: 0, engineRate: 0 };
    gmeterTrail.lat.fill(0);
    gmeterTrail.lon.fill(0);
    gmeterTrail.idx = 0;
    gmeterTrail.count = 0;
    _trailDirty = false;
    gmeterSmooth.lat = 0;
    gmeterSmooth.lon = 0;
    updateAllToggleStates();
    updateWidgetLayout();
}

DOM.resetConfigBtn?.addEventListener('click', resetConfig);
DOM.saveConfigBtn?.addEventListener('click', savePreset);

DOM.scaleSlider?.addEventListener('input', () => {
    const scale = parseFloat(DOM.scaleSlider.value);
    DOM.scaleValue.value = Math.round(scale * 100) + '%';
    currentConfig.scale = scale;
    invalidateCssCache();
    setVisualScale(scale);
    updateWidgetLayout();
    if (typeof GraphManager !== 'undefined') {
        GraphManager.debouncedRender();
    }
    sendConfigUpdateDebounced();
});

DOM.scaleSlider?.addEventListener('change', () => {
    updateWidgetLayout();
    requestAnimationFrame(() => {
        if (typeof GraphManager.render === 'function') {
            if (GraphManager.renderTimeout) {
                clearTimeout(GraphManager.renderTimeout);
                GraphManager.renderTimeout = null;
            }
            GraphManager.render();
        }
    });
});

DOM.scaleValue?.addEventListener('change', () => {
    let value = parseFloat(DOM.scaleValue.value) || 100;
    value = Math.max(100, Math.min(300, value));
    DOM.scaleValue.value = value + '%';
    DOM.scaleSlider.value = (value / 100).toFixed(2);
    currentConfig.scale = value / 100;
    updateWidgetLayout();
    sendConfigUpdate();
});

DOM.gearScaleSlider?.addEventListener('input', () => {
    const scale = parseFloat(DOM.gearScaleSlider.value);
    DOM.gearScaleValue.value = Math.round(scale * 100) + '%';
    currentConfig.gearScale = scale;
    updateGearScaleFactor();
    updateWidgetLayout();
    sendConfigUpdateDebounced();
});

DOM.gearScaleValue?.addEventListener('change', () => {
    let value = parseFloat(DOM.gearScaleValue.value) || 100;
    value = Math.max(100, Math.min(200, value));
    DOM.gearScaleValue.value = value + '%';
    DOM.gearScaleSlider.value = (value / 100).toFixed(2);
    currentConfig.gearScale = value / 100;
    updateGearScaleFactor();
    updateWidgetLayout();
    sendConfigUpdate();
});

// Прозрачность фона
DOM.widgetBgOpacitySlider?.addEventListener('input', () => {
    const val = parseFloat(DOM.widgetBgOpacitySlider.value);
    DOM.widgetBgOpacityValue.value = Math.round(val * 100) + '%';
    currentConfig.widgetBgOpacity = val;
    ThemeManager.applyColors();
    sendConfigUpdateDebounced();
});

DOM.widgetBgOpacityValue?.addEventListener('change', () => {
    let val = parseFloat(DOM.widgetBgOpacityValue.value) || 100;
    val = Math.max(0, Math.min(100, val));
    DOM.widgetBgOpacityValue.value = val + '%';
    DOM.widgetBgOpacitySlider.value = (val / 100).toFixed(2);
    currentConfig.widgetBgOpacity = val / 100;
    ThemeManager.applyColors();
    sendConfigUpdate();
});

DOM.axisValueElements.forEach(el => {
    el.addEventListener('click', (e) => {
        if (!e.target.classList.contains('clear-axis')) {
            const mode = el.dataset.mode;
            startScanning(mode);
        }
    });
});

DOM.handbrakeBtnSlots.forEach(el => {
    el.addEventListener('click', (e) => {
        if (!e.target.classList.contains('clear-axis')) {
            const mode = el.dataset.mode;
            startScanning(mode);
        }
    });
});

DOM.gearBtnSlots.forEach(el => {
    el.addEventListener('click', (e) => {
        if (!e.target.classList.contains('clear-axis')) {
            const mode = el.dataset.mode;
            startScanning(mode);
        }
    });
});

// --- Drag-toggling: инверсии и графики ---
var _dragBtnTrack = null;
var _dragBtnTarget = false;
var _dragBtnLast = null;
var _dragBtnCurr = null;

var DRAG_BTN_MAP = {
    invertWheel: 'invertWheel', invertThrottle: 'invertThrottle',
    invertBrake: 'invertBrake', invertClutch: 'invertClutch', invertHandbrake: 'invertHandbrake',
    toggleWheelGraph: 'showWheelGraph', toggleThrottleGraph: 'showThrottleGraph',
    toggleBrakeGraph: 'showBrakeGraph', toggleClutchGraph: 'showClutchGraph',
    toggleHandbrakeGraph: 'showHandbrakeGraph'
};

var axisAssignmentEl = document.querySelector('.axis-assignment');
if (axisAssignmentEl) {
    axisAssignmentEl.addEventListener('mousedown', function(e) {
        var btn = e.target.closest('.invert-btn, .graph-toggle-btn');
        if (!btn || !DRAG_BTN_MAP[btn.id]) return;
        _dragBtnTrack = btn.classList.contains('invert-btn') ? 'invert' : 'graph';
        _dragBtnTarget = !btn.classList.contains('active');
        _dragBtnLast = null;
        _dragBtnCurr = btn;
        btn.classList.add('drag-active');
        toggleDragBtn(btn, _dragBtnTarget);
        e.preventDefault();
    });
    axisAssignmentEl.addEventListener('mousemove', function(e) {
        if (!_dragBtnTrack) return;
        if (e.buttons !== 1) { _dragBtnTrack = null; return; }
        var btn = e.target.closest('.invert-btn, .graph-toggle-btn');
        if (!btn || btn === _dragBtnLast || !DRAG_BTN_MAP[btn.id]) return;
        var type = btn.classList.contains('invert-btn') ? 'invert' : 'graph';
        if (type !== _dragBtnTrack) return;
        if (_dragBtnCurr && _dragBtnCurr !== btn) _dragBtnCurr.classList.remove('drag-active');
        _dragBtnLast = btn;
        _dragBtnCurr = btn;
        btn.classList.add('drag-active');
        toggleDragBtn(btn, _dragBtnTarget);
    });
    document.addEventListener('mouseup', function() {
        setTimeout(function() {
            if (_dragBtnCurr) _dragBtnCurr.classList.remove('drag-active');
            _dragBtnTrack = null;
            _dragBtnLast = null;
            _dragBtnCurr = null;
        }, 0);
    });
}

// --- Показываем крестики очистки пока зажата кнопка мыши ---
var _crossVisibleTimer = null;
document.addEventListener('mousedown', function(e) {
    if (e.target.closest('.axis-value, .handbrake-btn-slot, .gear-btn-slot, .mw-tab, .mw-tab-remove')) {
        clearTimeout(_crossVisibleTimer);
        _crossVisibleTimer = setTimeout(function() {
            document.body.classList.add('cross-visible');
        }, 200);
    }
});
document.addEventListener('mouseup', function() {
    clearTimeout(_crossVisibleTimer);
    document.body.classList.remove('cross-visible');
});

// --- Drag-to-clear: крестики осей/табов ---
var _dragDelStart = null;
var _dragDelMoved = false;
var _dragDelItems = [];
var _dragDelLast = null;
var _dragDelJustExecuted = false;

document.addEventListener('mousedown', function(e) {
    var el = e.target.closest('.clear-axis, .mw-tab-remove');
    if (!el) return;
    _dragDelStart = el;
    _dragDelMoved = false;
    _dragDelItems = [el];
    _dragDelLast = el;
    el.classList.add('drag-active');
    e.preventDefault();
});

document.addEventListener('mousemove', function(e) {
    if (!_dragDelStart) return;
    if (e.buttons !== 1) { endDragDel(); return; }
    _dragDelMoved = true;
    var container = e.target.closest('.axis-value, .handbrake-btn-slot, .gear-btn-slot, .mw-tab');
    if (!container) return;
    var target = container.querySelector('.clear-axis') || container.querySelector('.mw-tab-remove');
    if (!target || target === _dragDelLast) return;
    _dragDelLast = target;
    if (_dragDelItems.indexOf(target) === -1) {
        _dragDelItems.push(target);
        target.classList.add('drag-active');
    }
});

document.addEventListener('mouseup', function() {
    if (_dragDelMoved) {
        _dragDelJustExecuted = true;
        var items = _dragDelItems.slice();
        endDragDel();
        var actions = items.map(function(el) {
            el.classList.remove('drag-active');
            if (el.classList.contains('mw-tab-remove')) {
                var tab = el.closest('.mw-tab');
                return { type: 'tab', index: parseInt(tab.dataset.slot) };
            } else {
                return { type: 'clear', mode: el.dataset.mode };
            }
        });
        actions.filter(function(a) { return a.type === 'tab'; })
            .sort(function(a, b) { return b.index - a.index; })
            .forEach(function(a) { removeMultiWidgetSlotAt(a.index); });
        actions.filter(function(a) { return a.type === 'clear'; })
            .forEach(function(a) {
                if (a.mode.startsWith('gear-button')) clearGearAssignment(a.mode);
                else clearInputAssignment(a.mode);
            });
        setTimeout(function() { _dragDelJustExecuted = false; }, 0);
    } else {
        endDragDel();
    }
});

window.addEventListener('blur', function() {
    clearTimeout(_crossVisibleTimer);
    document.body.classList.remove('cross-visible');
    endDragDel();
});

function endDragDel() {
    _dragDelStart = null;
    _dragDelMoved = false;
    _dragDelItems = [];
    _dragDelLast = null;
}

document.addEventListener('click', function(e) {
    if (_dragDelJustExecuted && e.target.closest('.mw-tab-remove')) {
        e.stopPropagation();
    }
}, true);

function toggleDragBtn(btn, state) {
    var configKey = DRAG_BTN_MAP[btn.id];
    if (!configKey) return;
    btn.classList.toggle('active', state);
    currentConfig[configKey] = state;
    if (_dragBtnTrack === 'graph' && typeof GraphManager !== 'undefined') {
        if (!state) {
            var historyKey = configKey.replace('show', '').replace('Graph', '').toLowerCase();
            GraphManager.clear(historyKey);
        }
        GraphManager.updateVisibility();
        updateAllToggleStates();
        updateWidgetLayout();
        GraphManager.requestRender();
    }
    sendConfigUpdate();
}

const INVERT_CONFIG = {
    invertWheelBtn: 'invertWheel', invertThrottleBtn: 'invertThrottle',
    invertBrakeBtn: 'invertBrake', invertClutchBtn: 'invertClutch', invertHandbrakeBtn: 'invertHandbrake'
};
Object.entries(INVERT_CONFIG).forEach(([btnKey, configKey]) => {
    const btn = DOM[btnKey];
    btn?.addEventListener('click', () => {
        if (_dragBtnTrack) return;
        btn.classList.toggle('active');
        currentConfig[configKey] = btn.classList.contains('active');
        sendConfigUpdate();
    });
});

const GRAPH_CONFIG = {
    toggleWheelGraphBtn: 'showWheelGraph', toggleThrottleGraphBtn: 'showThrottleGraph',
    toggleBrakeGraphBtn: 'showBrakeGraph', toggleClutchGraphBtn: 'showClutchGraph',
    toggleHandbrakeGraphBtn: 'showHandbrakeGraph'
};
Object.entries(GRAPH_CONFIG).forEach(([btnKey, configKey]) => {
    const btn = DOM[btnKey];
    btn?.addEventListener('click', () => {
        if (_dragBtnTrack) return;
        GraphManager.toggle(btn, configKey);
    });
});

DOM.steeringSlider.addEventListener('input', () => {
    DOM.steeringAngleInput.value = DOM.steeringSlider.value + '°';
    currentConfig.steeringAngle = parseInt(DOM.steeringSlider.value);
    updateAnglePreset();
    clearCarSelection();
    sendConfigUpdateDebounced();
});

DOM.steeringAngleInput.addEventListener('change', updateSteeringAngle);

document.querySelectorAll('.angle-preset').forEach(btn => {
    btn.addEventListener('click', () => {
        const angle = parseInt(btn.dataset.angle);
        DOM.steeringAngleInput.value = angle + '°';
        DOM.steeringSlider.value = angle;
        currentConfig.steeringAngle = angle;
        updateAnglePreset();
        clearCarSelection();
        sendConfigUpdate();
    });
});

// Язык виджета
initCustomSelect('languageSelect', (option) => {
    currentConfig.language = option.dataset.value;
    updatePedalConfig();
    sendConfigUpdate();
});

// Язык интерфейса
initCustomSelect('interfaceLanguageSelect', (option) => {
    setInterfaceLocale(option.dataset.value);
});

function setCarSelectVisibility() {
    const group = document.querySelector('.car-selector-group');
    if (!group) return;
    group.style.display = (window._selectedGame === 'Dirt Rally 2.0') ? '' : 'none';
}

// Выбор автомобиля
const optionsContainer = document.getElementById('carOptions');
if (optionsContainer && typeof CARS_DATA !== 'undefined') {
    setCarSelectVisibility();
    const grouped = {};
    CAR_CLASS_ORDER.forEach(cls => { grouped[cls] = []; });
    Object.keys(CARS_DATA).forEach(carName => {
        const cls = CARS_DATA[carName].class;
        if (!grouped[cls]) grouped[cls] = [];
        grouped[cls].push(carName);
    });
    let allOptions = [];
    CAR_CLASS_ORDER.forEach(cls => {
        if (grouped[cls].length === 0) return;
        grouped[cls].sort((a, b) => a.localeCompare(b, 'ru'));
        const header = document.createElement('div');
        header.className = 'car-class-header';
        header.textContent = CAR_CLASSES[cls] || cls;
        optionsContainer.appendChild(header);
        grouped[cls].forEach((carName, idx, arr) => {
            const opt = document.createElement('div');
            opt.className = 'custom-option';
            opt.dataset.value = carName;
            opt.dataset.steering = CARS_DATA[carName].steering;
            opt.textContent = carName;
            opt.title = carName;
            if (idx === arr.length - 1) opt.classList.add('last-in-group');
            optionsContainer.appendChild(opt);
            allOptions.push(opt);
        });
    });
    if (allOptions.length > 0) allOptions[allOptions.length - 1].classList.remove('last-in-group');
    const carSelect = document.getElementById('carSelect');
    if (carSelect) {
        const trigger = carSelect.querySelector('.custom-select-trigger');
        const options = carSelect.querySelectorAll('.custom-option');
                carSelect.onSelectChange = (option) => {
                    const steering = parseInt(option.dataset.steering);
                    currentConfig.steeringAngle = steering;
                    currentConfig.selectedCar = option.dataset.value;
                    DOM.steeringSlider.value = steering;
                    DOM.steeringAngleInput.value = steering + '°';
                    updateAnglePreset();
                    sendConfigUpdate();
                    const name = option.textContent;
                    trigger.textContent = name.length > 20 ? name.substring(0, 20) + '...' : name;
                    trigger.title = name;
                    trigger.classList.remove('placeholder');
                };
                trigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    document.querySelectorAll('.custom-select').forEach(s => {
                        if (s !== carSelect) s.classList.remove('active');
                    });
                    const isActive = carSelect.classList.contains('active');
                    if (!isActive) {
                        const rect = trigger.getBoundingClientRect();
                        const dropdownWidth = 900;
                        const left = rect.left + rect.width / 2 - dropdownWidth / 2;
                        optionsContainer.style.position = 'fixed';
                        optionsContainer.style.top = (rect.bottom + 4) + 'px';
                        optionsContainer.style.left = left + 'px';
                        optionsContainer.style.width = dropdownWidth + 'px';
                        optionsContainer.style.zIndex = '99999';
                    } else {
                        optionsContainer.style.position = '';
                        optionsContainer.style.top = '';
                        optionsContainer.style.left = '';
                        optionsContainer.style.width = '';
                        optionsContainer.style.zIndex = '';
                    }
                    carSelect.classList.toggle('active');
                });
                options.forEach(option => {
                    option.addEventListener('click', (e) => {
                        e.stopPropagation();
                        options.forEach(opt => opt.classList.remove('selected'));
                        option.classList.add('selected');
                        carSelect.classList.remove('active');
                        optionsContainer.style.position = '';
                        optionsContainer.style.top = '';
                        optionsContainer.style.left = '';
                        optionsContainer.style.width = '';
                        optionsContainer.style.zIndex = '';
                        if (carSelect.onSelectChange) carSelect.onSelectChange(option, carSelect);
                    });
                });
            }
        }

// Диапазоны осей
['wheel', 'throttle', 'brake', 'clutch', 'handbrake'].forEach(mode => {
    initCustomSelect(`${mode}RangeSelect`, (option) => {
        currentConfig[`${mode}Range`] = option.dataset.value;
        sendConfigUpdate();
    });
});

function onBeforeUnload(e) {
    closeUdpWebSocket();
    if (gameLoopInterval) { clearInterval(gameLoopInterval); gameLoopInterval = null; }
    if (scannerState.scanAnimationFrameId) {
        cancelAnimationFrame(scannerState.scanAnimationFrameId);
        scannerState.scanAnimationFrameId = null;
    }
    // Очистка таймера графика
    if (typeof GraphManager !== 'undefined' && GraphManager.renderTimeout) {
        clearTimeout(GraphManager.renderTimeout);
        GraphManager.renderTimeout = null;
    }
    // Удаление всех глобальных слушателей
    window.removeEventListener('beforeunload', onBeforeUnload);
    window.removeEventListener('gamepadconnected', onGamepadConnected);

    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('DOMContentLoaded', onDOMContentLoaded);
    document.removeEventListener('keydown', onKeyDown);
    active = false;
}

function onGamepadConnected(e) { }

function onKeyDown(e) {
    if (e.key === 'Escape') {
        if (scannerState.isScanning) {
            stopScanning();
            captureMode = null;
        }
        document.querySelectorAll('.notification-modal.show').forEach(m => {
            const cancelBtn = m.querySelector('.modal-cancel-btn');
            if (cancelBtn) cancelBtn.click();
            else m.classList.remove('show');
        });
        return;
    }
}

function onDocumentClick(e) {
    if (e.target.classList.contains('clear-axis')) {
        if (_dragDelJustExecuted) return;
        const mode = e.target.dataset.mode;
        if (mode.startsWith('gear-button')) clearGearAssignment(mode);
        else clearInputAssignment(mode);
    }
    if (e.target.closest('.custom-select')) return;
    document.querySelectorAll('.custom-select').forEach(s => {
        s.classList.remove('active');
    });
}

function onDOMContentLoaded(e) {
    updatePageUrlDisplay();
    enableCopyOnCodes('.hud-info');

    const exampleUrl = document.querySelector('.example-url');
    if (exampleUrl) {
        const params = exampleUrl.textContent.replace(/^.*\?/, '');
        const u = new URL(window.location.href);
        u.search = params;
        exampleUrl.dataset.fullText = u.toString();
    }

    setTimeout(initSelectWheelScroll, 200);

    var isStandalone = !window.chrome?.webview;
    var helpApp = document.getElementById('helpAppMode');
    var helpStandalone = document.getElementById('helpStandaloneMode');
    if (helpApp && helpStandalone) {
        helpApp.style.display = isStandalone ? 'none' : '';
        helpStandalone.style.display = isStandalone ? '' : 'none';
    }

    setThemeIcon(localStorage.getItem('minihud_ui_theme') || 'dark');
}

// === РЕГИСТРАЦИЯ ОБРАБОТЧИКОВ ===
window.addEventListener('beforeunload', onBeforeUnload);
window.addEventListener('gamepadconnected', onGamepadConnected);

document.addEventListener('click', onDocumentClick);
document.addEventListener('DOMContentLoaded', onDOMContentLoaded);
window.addEventListener('resize', updateWidgetDimensions);
document.addEventListener('keydown', onKeyDown);

// ==========================================
// 2. СОХРАНЕНИЕ И ЗАГРУЗКА КОНФИГУРАЦИИ
// ==========================================

/** Сборка объекта конфигурации из текущего состояния (все поля) */
function buildConfigObject() {
    if (_useDiMode) saveBindings(_diBindings);
    else saveBindings(_gpBindings);
    var obj = JSON.parse(JSON.stringify(currentConfig));
    BINDING_KEYS.forEach(function(k) { delete obj[k]; });
    delete obj.diBindings;
    delete obj.gpBindings;
    delete obj.interfaceLanguage;
    obj.diBindings = JSON.parse(JSON.stringify(_diBindings));
    obj.gpBindings = JSON.parse(JSON.stringify(_gpBindings));
    return obj;
}

/** Сериализация конфига в JS-код */
function serializeConfig(configObj) {
    return `const DEVICES = {\ndefault: ${JSON.stringify(configObj, null, 2).trim()}\n};`;
}

/** Авто-создание пресета для текущей игры, если его ещё нет */
function loadPresetForCurrentGame() {
    console.log('[loadPresetForCurrentGame] _selectedGame=' + window._selectedGame + ', _presetNames=' + JSON.stringify(window._presetNames) + ', _linkedPreset=' + window._linkedPreset);
    if (!window._selectedGame) return;

    // C#-режим: C# сам управляет пресетами, не создаём и не перезаписываем
    if (window.isMiniRacingHUD) {
        if (window._linkedPreset && window._presetNames && window._presetNames.includes(window._linkedPreset)) {
            var trigger = document.getElementById('presetSelect')?.querySelector('.custom-select-trigger');
            if (trigger) trigger.textContent = window._linkedPreset;
            // Не вызываем loadPresetByName — C# пришлёт presetContent сам
        }
        return;
    }

    // Standalone-режим: auto-creation
    var defaultName = window._selectedGame === NO_TELEMETRY_GAME
        ? 'Default'
        : window._selectedGame.replace(/[^a-zA-Z0-9а-яА-Я\-_]/g, '_');

    var wasCreated = false;
    if (window._presetNames && !window._presetNames.includes(defaultName)) {
        var configObj = buildConfigObject();
        configObj.multiWidgetMode = false;
        delete configObj.multiWidgetSlots;
        delete configObj.multiWidgetActiveSlot;
        Object.keys(HIDE_CONFIG_MAP).forEach(function(key) {
            configObj[HIDE_CONFIG_MAP[key]] = false;
        });
        ConfigManager.saveSync(defaultName, configObj);
        _lastSaveTime = Date.now();
        _presetJustCreated = true;
        showStatusMessage(t('status.presetCreated', defaultName));
        window._presetNames.push(defaultName);
        buildPresetSelect(window._presetNames);
        wasCreated = true;
    }

    var filename = defaultName;
    if (!wasCreated && window._linkedPreset && window._presetNames.includes(window._linkedPreset)) {
        filename = window._linkedPreset;
    }

    window._linkedPreset = filename;
    var trigger = document.getElementById('presetSelect')?.querySelector('.custom-select-trigger');
    if (trigger) trigger.textContent = filename;
    if (window._presetNames && window._presetNames.includes(filename)) {
        loadPresetByName(filename, true);
    }
}

/** Скачивание JS-файла с конфигом */
function downloadConfig(configCode, filename = 'NoApp.js') {
    if (window.chrome?.webview) {
        window.chrome.webview.postMessage(JSON.stringify({ action: 'savePreset', content: configCode, filename: filename }));
    } else {
        const blob = new Blob([configCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 100);
    }
}

/** Проверка, есть ли настроенные оси/кнопки */
function hasAnyBindings() {
    return !(
        currentConfig.wheelAxis === null &&
        currentConfig.throttleAxis === null &&
        currentConfig.brakeAxis === null &&
        currentConfig.clutchAxis === null &&
        currentConfig.handbrakeAxis === null &&
        currentConfig.handbrakeButtons.every(btn => btn === -1)
    );
}

// Отслеживание несохранённых изменений
let _lastSavedConfigHash = '';
let _lastSaveTime = 0;
let _presetJustCreated = false;

function getConfigHash() {
    try { return JSON.stringify(buildConfigObject()); } catch { return ''; }
}

function markSaved() {
    _lastSavedConfigHash = getConfigHash();
}

// Debounce-утилита для слайдеров
let _configUpdateTimer = null;
function sendConfigUpdateDebounced() {
    if (_configUpdateTimer) clearTimeout(_configUpdateTimer);
    _configUpdateTimer = setTimeout(sendConfigUpdate, 150);
}

/** Отправка текущего конфига через WS всем клиентам (C# пересылает) */
function sendConfigUpdate() {
    if (!udpState.socket || udpState.socket.readyState !== WebSocket.OPEN) {
        return;
    }
    if (!window.isMiniRacingHUD) {
        return;
    }
    _configUpdateTimer = null;
    var payload = {
        action: 'configUpdate',
        config: buildConfigObject(),
        presetName: PRESET_NAME || ''
    };
    var msg = JSON.stringify(payload);
    udpState.socket.send(msg);
}

function hasUnsavedChanges() {
    return _lastSavedConfigHash && _lastSavedConfigHash !== getConfigHash();
}

/** Сохранение конфигурации: проверка → сборка → сериализация → сохранение */
function savePreset() {
    if (!hasAnyBindings()) {
        showNotification('emptyConfig');
        return;
    }

    var configObj = buildConfigObject();
    DEVICES.default = configObj;
    const configCode = serializeConfig(configObj);

    if (window.isMiniRacingHUD) {
        // App mode: сохраняем в текущий пресет (или создаём Default)
        let presetName = ConfigManager.getCurrent();
        if (!presetName) {
            presetName = 'Default';
            ConfigManager.setCurrent(presetName);
            const trigger = document.getElementById('presetSelect')?.querySelector('.custom-select-trigger');
            if (trigger) trigger.textContent = presetName;
        }
        if (window.chrome?.webview) {
            window.chrome.webview.postMessage(JSON.stringify({
                action: 'savePreset',
                content: configCode,
                filename: presetName
            }));
        } else {
            ConfigManager.saveSync(presetName, configObj);
        }
    } else {
        // NoApp mode: скачиваем NoApp.js с языком интерфейса
        configObj.interfaceLanguage = _currentLocale;
        const noAppCode = serializeConfig(configObj);
        downloadConfig(noAppCode, 'NoApp.js');
    }

    _lastSaveTime = Date.now();
    markSaved();
    if (window.isMiniRacingHUD) {
        var name = ConfigManager.getCurrent() || 'Default';
        showStatusMessage(t('status.presetSaved', name));
    } else {
        showStatusMessage(t('status.configSaved'));
    }
}

/** Внутренняя загрузка пресета (без проверки dirty) */
function _doLoadPreset(name) {
    const trigger = document.getElementById('presetSelect')?.querySelector('.custom-select-trigger');
    if (!name) {
        ConfigManager.setCurrent('');
        if (trigger) trigger.textContent = '';
        loadConfig();
        applyConfig();
        markSaved();
        if (typeof window.MultiWidget !== 'undefined') window.MultiWidget.syncPanelCheckboxes();
        if (window.chrome?.webview) {
            window.chrome.webview.postMessage(JSON.stringify({ action: 'updateGamePreset', presetName: '' }));
        }
        return;
    }

    if (window.chrome?.webview) {
        window.chrome.webview.postMessage(JSON.stringify({
            action: 'loadConfig',
            filename: name
        }));
        // markSaved() и trigger будут в applyPreset после ответа от C#
    } else {
        const presetData = ConfigManager.loadSync(name);
        if (presetData) {
            ConfigManager.setCurrent(name);
            if (trigger) trigger.textContent = name;
            var savedLang = _currentLocale;
            parseExternalConfig(presetData);
            currentConfig.interfaceLanguage = savedLang;
            var activeSrc = _useDiMode ? _diBindings : _gpBindings;
            var activePop = _useDiMode ? _diPopulated : _gpPopulated;
            if (activePop) loadBindings(activeSrc);
            else applyConfig();
            markSaved();
            if (!_presetJustCreated && Date.now() - _lastSaveTime > 100) {
                showStatusMessage(t('status.presetLoaded', name));
            }
            _presetJustCreated = false;

            if (typeof URL_MW_PARAM !== 'undefined' && URL_MW_PARAM !== null) {
                window.MultiWidget.enableMultiWidget(currentConfig.multiWidgetSlots || [], currentConfig.multiWidgetActiveSlot || 0);
            } else if (currentConfig.multiWidgetMode && currentConfig.multiWidgetSlots && currentConfig.multiWidgetSlots.length > 0) {
                window.MultiWidget.enableMultiWidget(currentConfig.multiWidgetSlots, currentConfig.multiWidgetActiveSlot);
            } else {
                window._hideOverlay = null;
                window._urlOverlayExplicit = false;
                var mwTabs = document.getElementById('multiWidgetTabs');
                if (mwTabs) {
                    mwTabs.classList.remove('visible');
                    mwTabs.style.display = 'none';
                }
                window.MultiWidget.syncPanelCheckboxes();
                if (typeof updateCopyBtnText === 'function') updateCopyBtnText();
                applyConfig();
            }
        }
    }
}

/** Загрузка пресета с проверкой несохранённых изменений */
function loadPresetByName(name, skipCheck) {
    if (!skipCheck && hasUnsavedChanges()) {
        showNotification('unsaved', {
            okText: 'Сохранить',
            cancelText: 'Не сохранять',
            onOk: () => { savePreset(); _doLoadPreset(name); },
            onCancel: () => { _doLoadPreset(name); },
            onOverlayClick: () => {
                const current = ConfigManager.getCurrent();
                const trigger = document.getElementById('presetSelect')?.querySelector('.custom-select-trigger');
                if (trigger) trigger.textContent = current || '';
            }
        });
    } else {
        _doLoadPreset(name);
    }
}

/** Применение содержимого пресета (из C# ответа или WS broadcast) */
function applyPreset(name, content) {
    try {
        const match = content.match(/default:\s*(\{[\s\S]*\})\s*\};/);
        if (match) {
            const configObj = JSON.parse(match[1]);
            ConfigManager.setCurrent(name);
            var trigger = document.getElementById('presetSelect')?.querySelector('.custom-select-trigger');
            if (trigger) trigger.textContent = name;
            var optionsContainer = document.getElementById('presetOptions');
            if (optionsContainer) {
                optionsContainer.querySelectorAll('.custom-option').forEach(function(opt) {
                    opt.classList.toggle('selected', opt.dataset.value === name);
                });
            }
            parseExternalConfig(configObj);
            var activeSrc = _useDiMode ? _diBindings : _gpBindings;
            var activePop = _useDiMode ? _diPopulated : _gpPopulated;
            if (activePop) loadBindings(activeSrc);
            else applyConfig();
            DEVICES.default = { ...currentConfig };
            _configReady = true;
            markSaved();
            if (!_presetJustCreated && Date.now() - _lastSaveTime > 100) {
                showStatusMessage(t('status.presetLoaded', name));
            }
            _presetJustCreated = false;

            // Восстановить режим мультивиджета, если был сохранён в пресете
            if (typeof URL_MW_PARAM !== 'undefined' && URL_MW_PARAM !== null) {
                window.MultiWidget.enableMultiWidget(currentConfig.multiWidgetSlots || [], currentConfig.multiWidgetActiveSlot || 0);
            } else if (currentConfig.multiWidgetMode && currentConfig.multiWidgetSlots && currentConfig.multiWidgetSlots.length > 0) {
                window.MultiWidget.enableMultiWidget(currentConfig.multiWidgetSlots, currentConfig.multiWidgetActiveSlot);
            } else {
                window._hideOverlay = null;
                window._urlOverlayExplicit = false;
                var mwTabs = document.getElementById('multiWidgetTabs');
                if (mwTabs) {
                    mwTabs.classList.remove('visible');
                    mwTabs.style.display = 'none';
                }
                window.MultiWidget.syncPanelCheckboxes();
                if (typeof updateCopyBtnText === 'function') updateCopyBtnText();
                applyConfig();
            }
        } else {
            console.warn('[Config] Не удалось разобрать содержимое пресета');
        }
    } catch (e) {
        console.warn('[Config] Ошибка загрузки пресета:', e);
    }
}

/** Парсинг внешнего конфига в currentConfig */
function parseExternalConfig(config) {
    if (!config) return;

    currentConfig = makeConfigProxy({ ...DEFAULT_CONFIG });

    if (config.scale !== undefined) currentConfig.scale = config.scale;
    if (config.language) currentConfig.language = config.language;
    if (config.interfaceLanguage) currentConfig.interfaceLanguage = config.interfaceLanguage;
    if (config.steeringAngle) currentConfig.steeringAngle = config.steeringAngle;
    if (config.selectedCar) currentConfig.selectedCar = config.selectedCar;
    if (config.gearScale !== undefined) currentConfig.gearScale = config.gearScale;
    if (config.widgetBgOpacity !== undefined) currentConfig.widgetBgOpacity = config.widgetBgOpacity;
    Object.entries(AXIS_CONFIG_MAP).forEach(([key, cfg]) => {
        if (config[cfg.axisKey] !== undefined) {
            currentConfig[cfg.axisKey] = config[cfg.axisKey];
            currentConfig[cfg.deviceKey] = config[cfg.deviceKey];
            currentConfig[cfg.invertKey] = config[cfg.invertKey] || false;
            currentConfig[cfg.rangeKey] = config[cfg.rangeKey] || 'full';
        }
    });

    if (config.handbrakeButtons) {
        currentConfig.handbrakeButtons = Array.isArray(config.handbrakeButtons) ? [...config.handbrakeButtons].concat([-1, -1, -1, -1, -1]).slice(0, 5) : [-1, -1, -1, -1, -1];
        if (config.handbrakeButtonsDeviceIds && Array.isArray(config.handbrakeButtonsDeviceIds)) {
            currentConfig.handbrakeButtonsDeviceIds = [...config.handbrakeButtonsDeviceIds];
            while (currentConfig.handbrakeButtonsDeviceIds.length < 5) currentConfig.handbrakeButtonsDeviceIds.push(null);
        } else { currentConfig.handbrakeButtonsDeviceIds = [null, null, null, null, null]; }
    }

    if (config.gearButtons && Array.isArray(config.gearButtons)) {
        currentConfig.gearButtons = [...config.gearButtons];
        while (currentConfig.gearButtons.length < 8) currentConfig.gearButtons.push(-1);
        if (currentConfig.gearButtons.length > 8) currentConfig.gearButtons = currentConfig.gearButtons.slice(0, 8);
    } else { currentConfig.gearButtons = [-1, -1, -1, -1, -1, -1, -1, -1]; }

    if (config.gearButtonsDeviceIds && Array.isArray(config.gearButtonsDeviceIds)) {
        currentConfig.gearButtonsDeviceIds = [...config.gearButtonsDeviceIds];
        while (currentConfig.gearButtonsDeviceIds.length < 8) currentConfig.gearButtonsDeviceIds.push(null);
    } else { currentConfig.gearButtonsDeviceIds = [null, null, null, null, null, null, null, null]; }

    deviceName = currentConfig.wheelDeviceId || currentConfig.throttleDeviceId || currentConfig.brakeDeviceId ||
        currentConfig.clutchDeviceId || currentConfig.handbrakeAxisDeviceId ||
        (currentConfig.handbrakeButtonsDeviceIds?.find(id => id !== null)) || '';

    if (config.showWheelGraph !== undefined) currentConfig.showWheelGraph = config.showWheelGraph;
    if (config.showThrottleGraph !== undefined) currentConfig.showThrottleGraph = config.showThrottleGraph;
    if (config.showBrakeGraph !== undefined) currentConfig.showBrakeGraph = config.showBrakeGraph;
    if (config.showClutchGraph !== undefined) currentConfig.showClutchGraph = config.showClutchGraph;
    if (config.showHandbrakeGraph !== undefined) currentConfig.showHandbrakeGraph = config.showHandbrakeGraph;

    if (config.showBg !== undefined) currentConfig.showBg = config.showBg;
    if (config.showPedalLabels !== undefined) currentConfig.showPedalLabels = config.showPedalLabels;
    if (config.gearSyncWithWheel !== undefined) currentConfig.gearSyncWithWheel = config.gearSyncWithWheel;
    if (config.graphIndependent !== undefined) currentConfig.graphIndependent = config.graphIndependent;
    if (config.showGmeter !== undefined) currentConfig.showGmeter = config.showGmeter;
    if (config.showGmeterTrail !== undefined) currentConfig.showGmeterTrail = config.showGmeterTrail;
    if (config.graphsOnly !== undefined) currentConfig.graphsOnly = config.graphsOnly;
    if (config.layoutReverse !== undefined) currentConfig.layoutReverse = config.layoutReverse;
    if (config.handbrakeOnRight !== undefined) currentConfig.handbrakeOnRight = config.handbrakeOnRight;
    if (config.gearIndependent !== undefined) currentConfig.gearIndependent = config.gearIndependent;
    if (config.gearOnRight !== undefined) currentConfig.gearOnRight = config.gearOnRight;

    if (config.useUdpTelemetry !== undefined) currentConfig.useUdpTelemetry = config.useUdpTelemetry;
    if (config.showPedalsInUdp !== undefined) currentConfig.showPedalsInUdp = config.showPedalsInUdp;
    if (config.showGearUdp !== undefined) currentConfig.showGearUdp = config.showGearUdp;
    else if (config.showGearInUdp !== undefined) currentConfig.showGearUdp = config.showGearInUdp;
    if (config.showWheelUdp !== undefined) currentConfig.showWheelUdp = config.showWheelUdp;
    if (config.showHandbrakeUdp !== undefined) currentConfig.showHandbrakeUdp = config.showHandbrakeUdp;
    if (config.udpSmoothing !== undefined) currentConfig.udpSmoothing = config.udpSmoothing;
    if (config.noCornerRounding !== undefined) currentConfig.noCornerRounding = config.noCornerRounding;

    // hideXxx — глобальное скрытие элементов (OFF-режим мультивиджета)
    Object.keys(HIDE_CONFIG_MAP).forEach(function(key) {
        var configKey = HIDE_CONFIG_MAP[key];
        if (config[configKey] !== undefined) currentConfig[configKey] = config[configKey];
    });

    // MultiWidget — режим и слоты
    if (config.multiWidgetMode !== undefined) currentConfig.multiWidgetMode = config.multiWidgetMode;
    if (config.multiWidgetSlots !== undefined) {
        currentConfig.multiWidgetSlots = Array.isArray(config.multiWidgetSlots) ? JSON.parse(JSON.stringify(config.multiWidgetSlots)) : [];
    }
    if (config.multiWidgetActiveSlot !== undefined) currentConfig.multiWidgetActiveSlot = config.multiWidgetActiveSlot;

    DOM.steeringAngleInput.value = currentConfig.steeringAngle + '°';
    DOM.steeringSlider.value = currentConfig.steeringAngle;

    currentConfig.theme = config.theme || 'Default';

    // Восстанавливаем бинды для обоих режимов из пресета
    if (config.diBindings) {
        Object.assign(_diBindings, config.diBindings);
        _diPopulated = true;
    }
    if (config.gpBindings) {
        Object.assign(_gpBindings, config.gpBindings);
        _gpPopulated = true;
    }

    // Фоллбэк для старых пресетов (без diBindings/gpBindings):
    // копируем корневые поля биндов в хранилище активного режима
    if (!config.diBindings && !config.gpBindings) {
        saveBindings(_useDiMode ? _diBindings : _gpBindings);
        if (_useDiMode) _diPopulated = true;
        else _gpPopulated = true;
    }
}

/** Обновляет CSS-переменную --gear-scale-factor с учётом gearIndependent и наличия источника КПП */
function updateGearScaleFactor() {
    const hasGearButtons = currentConfig.gearButtons && currentConfig.gearButtons.some(b => b !== -1);
    const hasGearSource = hasGearButtons || hasUdpGear();
    const effectiveScale = (currentConfig.gearIndependent || !hasGearSource) ? 1.0 : (currentConfig.gearScale || 1.0);
    document.documentElement.style.setProperty('--gear-scale-factor', effectiveScale);
}

/** Применение currentConfig к UI и layout */
function applyConfig() {
    document.documentElement.classList.toggle('hide-bg', !currentConfig.showBg);

    // Инициализация: текст передачи скрыт по умолчанию (no-data)
    if (DOM.gearDisplay && !DOM.gearDisplay.classList.contains('no-data')) {
        DOM.gearDisplay.classList.add('no-data');
    }
    if (DOM.gearDisplayIndependent && !DOM.gearDisplayIndependent.classList.contains('no-data')) {
        DOM.gearDisplayIndependent.classList.add('no-data');
    }

    updateUIFromConfig();
    updateWidgetLayout();
    updatePedalConfig();

    if (URL_SCALE !== null) currentConfig.scale = URL_SCALE;
    if (DOM.scaleValue && DOM.scaleSlider) {
        DOM.scaleValue.value = Math.round((currentConfig.scale || 1.0) * 100) + '%';
        DOM.scaleSlider.value = (currentConfig.scale || 1.0).toFixed(2);
    }

    setVisualScale(currentConfig.scale || 1.0);

    ThemeManager.applyColors();

    if (DOM.gearScaleValue && DOM.gearScaleSlider) {
        DOM.gearScaleValue.value = Math.round((currentConfig.gearScale || 1.0) * 100) + '%';
        DOM.gearScaleSlider.value = (currentConfig.gearScale || 1.0).toFixed(2);
    }
    updateGearScaleFactor();

    if (DOM.widgetBgOpacityValue && DOM.widgetBgOpacitySlider) {
        DOM.widgetBgOpacityValue.value = Math.round((currentConfig.widgetBgOpacity ?? 1.0) * 100) + '%';
        DOM.widgetBgOpacitySlider.value = (currentConfig.widgetBgOpacity ?? 1.0).toFixed(2);
    }

    ThemeManager.apply(currentConfig.theme || 'Default');
    updatePedalOrder();

    if (currentConfig.useUdpTelemetry) {
        initUdpWebSocket();
        updateGearPosition();
    }

    updateCarSelectUI();
}

function updateCarSelectUI() {
    const carSelect = document.getElementById('carSelect');
    if (!carSelect) return;
    const trigger = carSelect.querySelector('.custom-select-trigger');
    const options = carSelect.querySelectorAll('.custom-option');
    if (!currentConfig.selectedCar) {
        trigger.textContent = t('car.placeholder');
        trigger.classList.add('placeholder');
        options.forEach(opt => opt.classList.remove('selected'));
        return;
    }
    trigger.classList.remove('placeholder');
    options.forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === currentConfig.selectedCar);
        if (opt.dataset.value === currentConfig.selectedCar) {
            const name = opt.textContent;
            trigger.textContent = name.length > 20 ? name.substring(0, 20) + '...' : name;
            trigger.title = name;
        }
    });
}

/** Загрузка конфигурации: парсинг → применение */
function loadConfig() {
    const config = DEVICES.default;
    if (!config) return;

    parseExternalConfig(config);
    var activeSrc = _useDiMode ? _diBindings : _gpBindings;
    var activePop = _useDiMode ? _diPopulated : _gpPopulated;
    if (activePop) loadBindings(activeSrc);
    applyConfig();
    _configReady = true;
}

function resetConfig() {
    // Очистка таймеров перед сбросом
    if (typeof GraphManager !== 'undefined') {
        GraphManager.cleanup();
    }
    currentConfig = makeConfigProxy({ ...DEFAULT_CONFIG });
    deviceName = '';
    scannerState.lastActiveElement = null;
    DOM.steeringAngleInput.value = '540°';
    DOM.steeringSlider.value = 540;
    DOM.gearScaleValue.value = '100%';
    DOM.gearScaleSlider.value = 1.0;
    updateGearScaleFactor();
    DOM.widgetBgOpacityValue.value = '100%';
    DOM.widgetBgOpacitySlider.value = 1.0;
    setVisualScale(currentConfig.scale || 1.0);

    // Сохраняем желаемые значения до updateUIFromConfig,
    // чтобы восстановить после becomingDisabled-мутаций
    var _defaults = {
        showGmeter: DEFAULT_CONFIG.showGmeter,
        showGmeterTrail: DEFAULT_CONFIG.showGmeterTrail,
        useUdpTelemetry: DEFAULT_CONFIG.useUdpTelemetry,
        gearIndependent: DEFAULT_CONFIG.gearIndependent,
        gearSyncWithWheel: DEFAULT_CONFIG.gearSyncWithWheel,
        graphIndependent: DEFAULT_CONFIG.graphIndependent,
        graphsOnly: DEFAULT_CONFIG.graphsOnly
    };

    updateUIFromConfig();

    // Восстанавливаем значения, которые becomingDisabled мог испортить
    currentConfig.showGmeter = _defaults.showGmeter;
    currentConfig.showGmeterTrail = _defaults.showGmeterTrail;
    currentConfig.useUdpTelemetry = _defaults.useUdpTelemetry;
    currentConfig.gearIndependent = _defaults.gearIndependent;
    currentConfig.gearSyncWithWheel = _defaults.gearSyncWithWheel;
    currentConfig.graphIndependent = _defaults.graphIndependent;
    currentConfig.graphsOnly = _defaults.graphsOnly;

    // Очистка savedActive — fallback в updateAllToggleStates прочитает currentConfig
    ['toggleGmeter','toggleGmeterTrail','toggleUdpTelemetryBtn',
     'toggleGearIndependent','toggleGearSync',
     'toggleGraphIndependent','toggleGraphsOnlyBtn'].forEach(function(id) {
        if (DOM[id]) DOM[id].dataset.savedActive = '';
    });

    // Повторная синхронизация — теперь fallback покажет правильное active
    updateAllToggleStates();

    updateDeviceInfo();
    updateGearPosition();
    // Сброс мультивиджета
    _multiWidgetSlots = [];
    _multiWidgetActiveSlot = 0;
    _savedOffModeHide = null;
    window._hideOverlay = null;
    window._urlOverlayExplicit = false;

    var mwTabs = document.getElementById('multiWidgetTabs');
    if (mwTabs) {
        mwTabs.classList.remove('visible');
        mwTabs.style.display = 'none';
    }
    var mwToggle = document.getElementById('mwToggle');
    if (mwToggle) mwToggle.classList.remove('active');

    if (typeof window.MultiWidget !== 'undefined') window.MultiWidget.syncPanelCheckboxes();

    currentConfig.theme = 'Default';
    ThemeManager.apply('Default');
    ThemeManager.updateSelectUI();
}

// ==========================================
// 3. ГЛАВНЫЙ ЦИКЛ (GAME LOOP)
// ==========================================
let isInitialized = false;
var _gameLoopUpdate = null;

function start() {
    if (!navigator.getGamepads) return;
    if (active || isInitialized) return;
    isInitialized = true;
    active = true;
    let lastLayoutHash = '';

    _gameLoopUpdate = () => {
        try {

        // Выбор источника устройств: Gamepad API или DirectInput
        const hasAnyBinding = currentConfig.wheelAxis !== null ||
            currentConfig.throttleAxis !== null || currentConfig.brakeAxis !== null ||
            currentConfig.clutchAxis !== null || currentConfig.handbrakeAxis !== null ||
            currentConfig.handbrakeButtons.some(b => b !== -1) ||
            currentConfig.gearButtons.some(b => b !== -1);

        const deviceMap = {};
        if (_useDiMode) {
            if (_diDevices && Array.isArray(_diDevices)) {
                for (let i = 0; i < _diDevices.length; i++) {
                    const d = _diDevices[i];
                    if (d && d.id) deviceMap[d.id] = d;
                }
            }
        } else {
            const rawDevices = hasAnyBinding ? navigator.getGamepads() : [];
            const devices = rawDevices && Array.isArray(rawDevices) ? rawDevices : [];
            if (hasAnyBinding) {
                for (let i = 0; i < devices.length; i++) {
                    const d = devices[i];
                    if (d && d.id) deviceMap[d.id] = d;
                }
            }
        }

        const isUdpReady = currentConfig.useUdpTelemetry && udpState.connected && udpState.data;

        // Тайм-аут телеметрии: если данные не приходили >2 секунд — сброс на нейтральные
        if (udpState.connected && udpState.lastDataTime > 0 && performance.now() - udpState.lastDataTime > 2000) {
            if (udpState.data.speed !== 0 || udpState.data.engineRate !== 0 || udpState.data.gear !== 0) {
                udpState.data = { throttleInput: 0, steeringInput: 0, brakeInput: 0, clutchInput: 0, gear: 0, speed: 0, engineRate: 0 };
                udpSmooth.steering = 0; udpSmooth.throttle = 0; udpSmooth.brake = 0; udpSmooth.clutch = 0;
                gmeterSmooth.lat = 0; gmeterSmooth.lon = 0;
                gmeterTrail.lat.fill(0);
                gmeterTrail.lon.fill(0);
                gmeterTrail.idx = 0;
                gmeterTrail.count = 0;
                _trailDirty = false;
                if (DOM.gmeterTrail) {
                    const ctx = DOM.gmeterTrail.getContext('2d');
                    if (ctx) ctx.clearRect(0, 0, DOM.gmeterTrail.width, DOM.gmeterTrail.height);
                }
                if (currentConfig.showGmeter && window.MultiWidget.isVisible('gm')) {
                    renderGmeter(0, 0);
                }
            }
        }

        // === 1. Определяем видимость и источник данных для каждого элемента ===
        const wheelFromUdp = isUdpReady && currentConfig.showWheelUdp;
        const pedalsFromUdp = isUdpReady && currentConfig.showPedalsInUdp;
        const gearFromUdp = isUdpReady && currentConfig.showGearUdp;
        const handbrakeFromUdp = isUdpReady && currentConfig.showHandbrakeUdp;

        const isVisible = window.MultiWidget.isVisible;

        const wheelDev = deviceMap[currentConfig.wheelDeviceId];
        const hasWheelGamepad = currentConfig.wheelAxis !== null;
        const hasWheelUdp = wheelFromUdp;
        const showWheel = isVisible('wh') && (hasWheelUdp || hasWheelGamepad);

        const showThrottle = isVisible('th') && (pedalsFromUdp || currentConfig.throttleAxis !== null);
        const showBrake = isVisible('br') && (pedalsFromUdp || currentConfig.brakeAxis !== null);
        const showClutch = isVisible('cl') && (pedalsFromUdp || currentConfig.clutchAxis !== null);
        const hasHandbrakeAxisGamepad = currentConfig.handbrakeAxis !== null;
        const hasHandbrakeButtons = currentConfig.handbrakeButtons.some(btn => btn !== -1);
        const showHandbrake = isVisible('hb') && (hasHandbrakeAxisGamepad || hasHandbrakeButtons || (handbrakeFromUdp && udpState.data && 'handbrake' in udpState.data));

const hasGearButtonsGamepad = currentConfig.gearButtons && currentConfig.gearButtons.some(b => b !== -1);
const showGear = isVisible('gb') && (gearFromUdp || hasGearButtonsGamepad);
const hasGearDataSource = isVisible('gb') && (gearFromUdp || hasGearButtonsGamepad);
const showAssembly = showWheel || showGear;

// Управление классом no-data для текста передачи (плавное скрытие/появление)
const isGearInd = currentConfig.gearIndependent && hasGearDataSource && showWheel;
if (DOM.gearDisplay) {
    const nd = !hasGearDataSource || isGearInd;
    DOM.gearDisplay.classList.toggle('no-data', nd);
    if (nd) DOM.gearDisplay.classList.remove('forward', 'reverse');
}
if (DOM.gearDisplayIndependent) {
    const nd = !hasGearDataSource;
    DOM.gearDisplayIndependent.classList.toggle('no-data', nd);
    if (nd) DOM.gearDisplayIndependent.classList.remove('forward', 'reverse');
}

        // === 2. Видимость DOM-элементов ===
        if (DOM.wheelAssembly) DOM.wheelAssembly.classList.toggle('hidden', !showAssembly);
        if (DOM.wheel) DOM.wheel.classList.toggle('visible', showWheel);
        if (DOM.handbrake) DOM.handbrake.classList.toggle('visible', showHandbrake);
        if (DOM.clutch) DOM.clutch.classList.toggle('visible', showClutch);
        if (DOM.brake) DOM.brake.classList.toggle('visible', showBrake);
        if (DOM.throttle) DOM.throttle.classList.toggle('visible', showThrottle);
        if (DOM.gearDisplay) {
            if (showGear && !showWheel) {
                DOM.gearDisplay.style.width = 'var(--wheel-size)';
                DOM.gearDisplay.style.height = 'var(--wheel-size)';
                DOM.gearDisplay.style.fontSize = 'calc(var(--gear-font-size-base) * var(--scale-factor) * 2.5)';
                DOM.gearDisplay.style.borderWidth = 'calc(var(--marker-width) / 2)';
            }
            // Когда руль есть — размеры управляются через updateGearDisplaySize()
        }

        // === 3. Читаем сырые значения: UDP или геймпад ===
        let wheelRaw, throttleRaw, brakeRaw, clutchRaw, handbrakeAxisRaw, gear;

        if (wheelFromUdp) {
            wheelRaw = udpState.data.steeringInput !== undefined ? udpState.data.steeringInput : 0;
            if (currentConfig.udpSmoothing) wheelRaw = udpSmooth.steering += (wheelRaw - udpSmooth.steering) * udpSmooth.factor;
        } else {
            wheelRaw = readAxisRaw('wheelAxis', 'wheelDeviceId', deviceMap);
        }

        if (pedalsFromUdp) {
            const udp = udpState.data;
            throttleRaw = udp.throttleInput !== undefined ? udp.throttleInput * 2 - 1 : 0;
            if (currentConfig.udpSmoothing) throttleRaw = udpSmooth.throttle += (throttleRaw - udpSmooth.throttle) * udpSmooth.factor;
            brakeRaw = udp.brakeInput !== undefined ? udp.brakeInput * 2 - 1 : 0;
            if (currentConfig.udpSmoothing) brakeRaw = udpSmooth.brake += (brakeRaw - udpSmooth.brake) * udpSmooth.factor;
            clutchRaw = udp.clutchInput !== undefined ? udp.clutchInput * 2 - 1 : 0;
            if (currentConfig.udpSmoothing) clutchRaw = udpSmooth.clutch += (clutchRaw - udpSmooth.clutch) * udpSmooth.factor;
        } else {
            throttleRaw = readAxisRaw('throttleAxis', 'throttleDeviceId', deviceMap);
            brakeRaw = readAxisRaw('brakeAxis', 'brakeDeviceId', deviceMap);
            clutchRaw = readAxisRaw('clutchAxis', 'clutchDeviceId', deviceMap);
        }

        // Ручник — ВСЕГДА из геймпада
        handbrakeAxisRaw = readAxisRaw('handbrakeAxis', 'handbrakeAxisDeviceId', deviceMap);

        // Кнопки ручника (геймпад)
        let handbrakeButtonsPressed = false;
        currentConfig.handbrakeButtons.forEach((btnIndex, slotIdx) => {
            if (btnIndex === -1) return;
            const dev = deviceMap[currentConfig.handbrakeButtonsDeviceIds[slotIdx]];
            if (dev?.buttons?.[btnIndex]?.pressed) handbrakeButtonsPressed = true;
        });

        // Передача
        if (gearFromUdp) {
            const g = udpState.data.gear;
            if (udpState.data.gameId === 3) {
                // BeamNG: если есть gearName (через Lua-мод OutGauge display1) — используем строку режима
                var gearName = udpState.data.gearName;
                if (gearName && gearName !== '') {
                    gear = gearName;
                } else {
                    // BeamNG OutGauge: 0=R, 1=N, 2=1...
                    if (g === 0 || g === -1) gear = 'R';
                    else if (g === 1 || g === undefined) gear = 'N';
                    else gear = String(g - 1);
                }
            } else {
                if (g === 0 || g === undefined) gear = 'N';
                else if (g === -1) gear = 'R';
                else gear = String(g);
            }
        } else if (hasGearButtonsGamepad) {
            gear = readGearInput(deviceMap);
        } else {
            gear = null;
        }

        // === 4. Конвертируем в проценты для рендера ===
        const throttlePct = throttleRaw !== null
            ? getPedalPercent(throttleRaw, pedalsFromUdp ? false : currentConfig.invertThrottle, pedalsFromUdp ? 'full' : currentConfig.throttleRange)
            : 0;
        const brakePct = brakeRaw !== null
            ? getPedalPercent(brakeRaw, pedalsFromUdp ? false : currentConfig.invertBrake, pedalsFromUdp ? 'full' : currentConfig.brakeRange)
            : 0;
        const clutchPct = clutchRaw !== null
            ? getPedalPercent(clutchRaw, pedalsFromUdp ? false : currentConfig.invertClutch, pedalsFromUdp ? 'full' : currentConfig.clutchRange)
            : 0;
        const handbrakeAxisPct = handbrakeAxisRaw !== null ? getPedalPercent(handbrakeAxisRaw, currentConfig.invertHandbrake, currentConfig.handbrakeRange) : 0;
        const handbrakePct = showHandbrake ? Math.max(handbrakeAxisPct, handbrakeButtonsPressed ? 100 : 0, (handbrakeFromUdp && udpState.data.handbrake === true) ? 100 : 0) : 0;

        // === 5. Запись в историю графиков (только если есть активный график) ===
        const anyGraphActive = currentConfig.showWheelGraph || currentConfig.showThrottleGraph ||
            currentConfig.showBrakeGraph || currentConfig.showClutchGraph ||
            currentConfig.showHandbrakeGraph;

        if (anyGraphActive) {
            const idx = pedalHistory.index;
            pedalHistory.wheel[idx] = wheelRaw !== null ? getPedalPercent(wheelRaw, !currentConfig.invertWheel, currentConfig.wheelRange) : 0;
            pedalHistory.throttle[idx] = throttlePct;
            pedalHistory.brake[idx] = brakePct;
            pedalHistory.clutch[idx] = clutchPct;
            pedalHistory.handbrake[idx] = handbrakePct;
            pedalHistory.index = (pedalHistory.index + 1) % HISTORY_SIZE;
        }

        // === 6. Рендер ===
        if (showWheel) renderSteeringWheel(wheelRaw);
        if (gear !== null) renderGearDisplay(gear);
        syncGearRotation(wheelRaw);
        if (showThrottle) renderPedals('throttle', throttlePct);
        if (showBrake) renderPedals('brake', brakePct);
        if (showClutch) renderPedals('clutch', clutchPct);
        if (showHandbrake) renderPedals('handbrake', handbrakePct);

        // G-meter trail render — только по флагу новых данных
        if (currentConfig.showGmeter && udpState.connected && window.MultiWidget.isVisible('gm') && _trailDirty) {
            renderGmeterTrail();
            _trailDirty = false;
        }

        // === 7. Проверка изменения макета ===
        const currentLayoutHash = `${showWheel}-${showHandbrake}-${showClutch}-${showBrake}-${showThrottle}-${showGear}-${anyGraphActive}`;
        if (currentLayoutHash !== lastLayoutHash) {
            updateWidgetDimensions();
            lastLayoutHash = currentLayoutHash;
        }

        // Рендер графика
        if (anyGraphActive && Date.now() - lastGraphTime >= GRAPH_FRAME_DELAY) {
            GraphManager.render();
            lastGraphTime = Date.now();
        }
        } catch (e) {
            console.error('[HUD] update error:', e);
        }
    };

    gameLoopInterval = setInterval(_gameLoopUpdate, 1000 / 60);
}

// ==========================================
// 4. ВИЗУАЛИЗАЦИЯ СОСТОЯНИЯ (RENDER LOOP)
// ==========================================

/** Чтение сырого значения оси (-1..1 или null) */
function readAxisRaw(axisKey, deviceKey, deviceMap) {
    if (currentConfig[axisKey] === null || !currentConfig[deviceKey]) return null;
    const dev = deviceMap[currentConfig[deviceKey]];
    if (!dev?.axes || dev.axes[currentConfig[axisKey]] === undefined) return null;
    const val = dev.axes[currentConfig[axisKey]];
    if (val !== 0) _deviceAwake = true;
    if (val === 0 && !_deviceAwake) return null;
    return val;
}

/** Вычисление угла поворота руля из сырого значения оси */
function calcSteeringRotation(rawAxis) {
    const normalized = normalizeAxis(rawAxis, currentConfig.wheelRange);
    const angle = normalized * (getSteeringAngle() / 2);
    return currentConfig.invertWheel ? -angle : angle;
}

/** Рендер руля: установка угла поворота */
function renderSteeringWheel(rawAxis) {
    if (rawAxis === null || !DOM.wheel) return;
    const rotation = calcSteeringRotation(rawAxis);
    const newTransform = `rotate(${rotation}deg)`;
    if (DOM.wheel.style.transform !== newTransform) DOM.wheel.style.transform = newTransform;
}

let _lastRenderedGear = null;

/** Рендер индикатора передачи (текст + классы) */
function renderGearDisplay(gear) {
    if (!gear || _lastRenderedGear === gear) return;
    _lastRenderedGear = gear;

    if (DOM.gearDisplay && !DOM.gearDisplay.classList.contains('no-data')) {
        DOM.gearDisplay.textContent = gear;
        DOM.gearDisplay.classList.remove('forward', 'reverse');
        DOM.gearDisplay.classList.add('gear-display');
        if (gear === 'R') DOM.gearDisplay.classList.add('reverse');
        else if (gear !== 'N' && gear !== 'P') DOM.gearDisplay.classList.add('forward');
    }
    if (DOM.gearDisplayIndependent && !DOM.gearDisplayIndependent.classList.contains('no-data')) {
        DOM.gearDisplayIndependent.textContent = gear;
        DOM.gearDisplayIndependent.classList.remove('forward', 'reverse');
        DOM.gearDisplayIndependent.classList.add('gear-display-independent');
        if (gear === 'R') DOM.gearDisplayIndependent.classList.add('reverse');
        else if (gear !== 'N' && gear !== 'P') DOM.gearDisplayIndependent.classList.add('forward');
    }
}

let _lastGearTransformOnWheel = null;
let _lastGearTransformIndep = null;

/** Синхронизация вращения КПП с рулём (берёт сырое значение оси, не читает заново) */
function syncGearRotation(rawWheelAxis) {
    const syncEnabled = currentConfig.gearSyncWithWheel && rawWheelAxis !== null;
    let rotation = 0;
    if (syncEnabled) rotation = calcSteeringRotation(rawWheelAxis);

    if (DOM.gearDisplay) {
        const onWheel = DOM.gearDisplay.parentElement === DOM.wheelAssembly;
        const transform = onWheel
            ? `translate(-50%, -50%) rotate(${rotation}deg)`
            : `rotate(${rotation}deg)`;
        if (_lastGearTransformOnWheel !== transform) {
            DOM.gearDisplay.style.transform = transform;
            _lastGearTransformOnWheel = transform;
        }
    }

    if (DOM.gearDisplayIndependent) {
        const transform = `rotate(${rotation}deg)`;
        if (_lastGearTransformIndep !== transform) {
            DOM.gearDisplayIndependent.style.transform = transform;
            _lastGearTransformIndep = transform;
        }
    }
}

/** Рендер G-meter: перемещение шарика по перегрузкам */
function renderGmeter(lateral, longitudinal) {
    if (!DOM.gmeterDisplay || !DOM.gmeterBall) return;
    if (!currentConfig.showGmeter || !window.MultiWidget.isVisible('gm')) return;

    const maxG = 2;
    let clampedLat = Math.max(-maxG, Math.min(maxG, lateral));
    let clampedLon = Math.max(-maxG, Math.min(maxG, longitudinal));

    const magnitude = Math.sqrt(clampedLat ** 2 + clampedLon ** 2);
    if (magnitude > maxG) {
        clampedLat *= maxG / magnitude;
        clampedLon *= maxG / magnitude;
    }

    const gmeterW = gmeterCache.width;
    const ballSize = gmeterCache.ballSize;
    const ballW = gmeterW * ballSize;
    const maxOffset = (gmeterW - ballW) / 2;

    const offsetX = (clampedLat / maxG) * maxOffset;
    const offsetY = (clampedLon / maxG) * maxOffset;

    DOM.gmeterBall.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
}

/** Кеш DOM-ссылок педалей (заполняется один раз при старте) */
const _pedalRefs = {};
['throttle', 'brake', 'clutch', 'handbrake'].forEach(type => {
    _pedalRefs[type] = {
        fill: document.getElementById(`fill-${type}`),
        container: document.getElementById(type),
        bg: document.querySelector(`#${type} .pedal-bg`)
    };
});

/** Рендер визуального состояния педали (заполнение и свечение) */
function renderPedals(pedalType, percent) {
    const refs = _pedalRefs[pedalType];
    if (!refs?.fill || !refs?.container || !refs?.bg) return;
    const { fill: fillEl, container, bg: bgEl } = refs;

    lastValues[pedalType] = percent;
    fillEl.style.transform = `scaleY(${percent / 100})`;
    bgEl.style.transform = `scaleY(${1 - percent / 100})`;

    const glowBlur = (window.glowParams?.blur || 6);
    container.style.boxShadow = percent >= 100 ?
        `0 0 ${glowBlur}px 0 var(--pedal-${pedalType})` : 'none';
}

/** Чтение текущей передачи с кнопок */
function readGearInput(deviceMap) {
    let currentGear = 'N';
    for (let i = 0; i < 8; i++) {
        const btnIndex = currentConfig.gearButtons[i];
        if (btnIndex === -1) continue;
        const deviceId = currentConfig.gearButtonsDeviceIds[i];
        if (!deviceId) continue;
        const device = deviceMap[deviceId];
        if (device?.buttons?.[btnIndex]?.pressed) {
            currentGear = DOM.gearBtnSlots[i]?.dataset.gear || String(i + 1);
            break;
        }
    }
    return currentGear;
}

// ==========================================
// 5. СКанирование Устройств (Input Scanning)
// ==========================================

/** Сканирование осей геймпада */
function scanAxes(gamepad, deviceIndex) {
    if (!gamepad) return null;
    const axes = gamepad.axes;
    if (!axes?.length) return null;

    for (let i = 0; i < axes.length; i++) {
        const axisKey = generateKey('axis', deviceIndex, i);
        if (!scannerState.axis.has(axisKey)) {
            scannerState.axis.set(axisKey, { lastValue: axes[i], minValue: axes[i], maxValue: axes[i] });
        }
        const axisState = scannerState.axis.get(axisKey);
        const currentValue = axes[i];
        const isMoving = Math.abs(currentValue - axisState.lastValue) > SCAN_CONFIG.AXIS_MOVEMENT_THRESHOLD;

        axisState.lastValue = currentValue;
        if (currentValue < axisState.minValue) axisState.minValue = currentValue;
        if (currentValue > axisState.maxValue) axisState.maxValue = currentValue;

        if (isMoving) return { type: 'axis', deviceIndex, index: i, value: currentValue, gamepadId: gamepad.id };
    }
    return null;
}

/** Сканирование кнопок геймпада */
function scanButtons(gamepad, deviceIndex) {
    if (!gamepad) return null;
    const buttons = gamepad.buttons;
    if (!buttons?.length) return null;

    for (let i = 0; i < buttons.length; i++) {
        const btnKey = generateKey('button', deviceIndex, i);
        if (!scannerState.button.has(btnKey)) {
            scannerState.button.set(btnKey, { lastValue: buttons[i].value, lastPressed: buttons[i].pressed });
        }
        const btnState = scannerState.button.get(btnKey);
        const button = buttons[i];
        const valueChanged = Math.abs(button.value - btnState.lastValue) > SCAN_CONFIG.BUTTON_MOVEMENT_THRESHOLD;
        const pressedChanged = button.pressed !== btnState.lastPressed;

        if (valueChanged || pressedChanged) {
            btnState.lastValue = button.value;
            btnState.lastPressed = button.pressed;
            return { type: 'button', deviceIndex, index: i, value: button.value, pressed: button.pressed, gamepadId: gamepad.id };
        }
    }
    return null;
}

/** Сканирование одного геймпада на наличие активности (обёртка) */
function scanDeviceInput(gamepad, deviceIndex) {
    if (!gamepad) return null;

    // Сканируем оси если не в режиме захвата кнопок
    if (!captureMode?.startsWith('handbrake-button') && !captureMode?.startsWith('gear-button')) {
        const axisResult = scanAxes(gamepad, deviceIndex);
        if (axisResult) return axisResult;
    }

    // Сканируем кнопки если в режиме захвата кнопок
    if (captureMode?.startsWith('handbrake-button') || captureMode?.startsWith('gear-button')) {
        const buttonResult = scanButtons(gamepad, deviceIndex);
        if (buttonResult) return buttonResult;
    }

    return null;
}

/** Цикл сканирования устройств */
function scanLoop() {
    if (!scannerState.isScanning) {
        cancelAnimationFrame(scannerState.scanAnimationFrameId);
        scannerState.scanAnimationFrameId = null;
        return;
    }

    if (++scannerState.frameCount >= Math.round(60 / SCAN_CONFIG.UPDATE_RATE)) {
        scannerState.frameCount = 0;

        if (_useDiMode) {
            if (_diDevices && Array.isArray(_diDevices)) {
                for (var diIdx = 0; diIdx < _diDevices.length; diIdx++) {
                    var diDev = _diDevices[diIdx];
                    if (!diDev) continue;
                    var adapted = {
                        id: diDev.id,
                        axes: diDev.axes,
                        buttons: (diDev.buttons || []).map(function(b) {
                            return { value: b.pressed ? 1 : 0, pressed: b.pressed };
                        })
                    };
                    var active = scanDeviceInput(adapted, 100 + diIdx);
                    if (active) {
                        stopScanning();
                        assignCapturedInput(active);
                        return;
                    }
                }
            }
        } else {
            var gamepads = navigator.getGamepads();
            if (!gamepads) return;
            for (var i = 0; i < gamepads.length; i++) {
                var active = scanDeviceInput(gamepads[i], i);
                if (active) {
                    stopScanning();
                    assignCapturedInput(active);
                    return;
                }
            }
        }
    }
    scannerState.scanAnimationFrameId = requestAnimationFrame(scanLoop);
}

/** Запуск режима захвата ввода */
function startScanning(mode) {
    if (!navigator.getGamepads) return;
    captureMode = mode;
    scannerState.isScanning = true;
    scannerState.axis.clear();
    scannerState.button.clear();

    DOM.captureOverlay.classList.add('show');

    let msg;
    if (mode.startsWith('gear-button')) {
        const gearLabels = ['1', '2', '3', '4', '5', '6', '7', 'R'];
        const idx = parseInt(mode.split('-')[2], 10);
        const label = gearLabels[idx] || '?';
        msg = { title: t('capture.gear.title') + ' ' + label, text: t('capture.gear.text') };
    } else {
        const modeKey = mode.startsWith('handbrake-button') ? 'handbrakeBtn' : mode;
        msg = { title: t('capture.' + modeKey + '.title'), text: t('capture.' + modeKey + '.text') };
    }

    DOM.captureTitle.textContent = msg.title;
    DOM.captureText.textContent = msg.text;

    scannerState.scanAnimationFrameId = requestAnimationFrame(scanLoop);
}

/** Остановка режима захвата */
function stopScanning() {
    scannerState.isScanning = false;
    DOM.captureOverlay.classList.remove('show');
    if (scannerState.scanAnimationFrameId) {
        cancelAnimationFrame(scannerState.scanAnimationFrameId);
        scannerState.scanAnimationFrameId = null;
    }
    scannerState.axis.clear();
    scannerState.button.clear();
}

/** Назначение захваченной оси */
function assignAxisCapture(element, device) {
    const configKeys = AXIS_CONFIG_MAP[captureMode];
    if (!configKeys) return;

    const deviceId = device?.id;
    let selectedRange = 'full';
    const rangeSelect = document.getElementById(`${captureMode}RangeSelect`);
    const selectedOption = rangeSelect?.querySelector('.custom-option.selected');
    if (selectedOption) selectedRange = selectedOption.dataset.value;

    currentConfig[configKeys.axisKey] = element.index;
    currentConfig[configKeys.deviceKey] = deviceId;
    currentConfig[configKeys.rangeKey] = selectedRange;
}

/** Назначение захваченной кнопки */
function assignButtonCapture(element, device) {
    if (captureMode.startsWith('handbrake-button')) {
        const slotIndex = parseInt(captureMode.split('-')[2]);
        currentConfig.handbrakeButtons = currentConfig.handbrakeButtons || [-1, -1, -1, -1, -1];
        currentConfig.handbrakeButtonsDeviceIds = currentConfig.handbrakeButtonsDeviceIds || [null, null, null, null, null];
        currentConfig.handbrakeButtons[slotIndex] = element.index;
        currentConfig.handbrakeButtonsDeviceIds[slotIndex] = device?.id;
    } else if (captureMode.startsWith('gear-button')) {
        const slotIndex = parseInt(captureMode.split('-')[2]);
        currentConfig.gearButtons = currentConfig.gearButtons || [-1, -1, -1, -1, -1, -1, -1, -1];
        currentConfig.gearButtonsDeviceIds = currentConfig.gearButtonsDeviceIds || [null, null, null, null, null, null, null, null];
        currentConfig.gearButtons[slotIndex] = element.index;
        currentConfig.gearButtonsDeviceIds[slotIndex] = device?.id;
    }
}

/** Назначение захваченного ввода конфигурации (диспетчер) */
function assignCapturedInput(element) {
    const gamepads = navigator.getGamepads();
    const isDiDevice = element.deviceIndex >= 100 && element.gamepadId;
    const device = isDiDevice ? null : gamepads[element.deviceIndex];
    const deviceObj = device || { id: element.gamepadId };
    deviceName = device?.id || element.gamepadId || `Device ${element.deviceIndex}`;
    scannerState.lastActiveElement = element;
    updateDeviceInfo();

    if (element.type === 'axis') {
        assignAxisCapture(element, deviceObj);
    } else if (element.type === 'button') {
        assignButtonCapture(element, deviceObj);
    }

    updateAllToggleStates();
    updateUIFromConfig();
    updateWidgetLayout();
    GraphManager.updateButtonsState();
}

/** Очистка назначения для оси или кнопки */
function clearInputAssignment(mode) {
    if (mode.startsWith('handbrake-button')) {
        const slotIndex = parseInt(mode.split('-')[2]);
        if (currentConfig.handbrakeButtons) {
            currentConfig.handbrakeButtons[slotIndex] = -1;
            currentConfig.handbrakeButtonsDeviceIds[slotIndex] = null;
        }
        if (scannerState.lastActiveElement?.type === 'button' && `handbrake-button-${slotIndex}` === mode) {
            scannerState.lastActiveElement = null;
        }
    } else {
        const configKeys = AXIS_CONFIG_MAP[mode];
        if (configKeys) {
            currentConfig[configKeys.axisKey] = null;
            currentConfig[configKeys.deviceKey] = null;
            currentConfig[configKeys.rangeKey] = 'full';
        }
        if (scannerState.lastActiveElement?.type === 'axis' && scannerState.lastActiveElement.index === currentConfig[configKeys.axisKey]) {
            scannerState.lastActiveElement = null;
        }
    }

    // Обновление имени устройства
    deviceName = currentConfig.wheelDeviceId || currentConfig.throttleDeviceId || currentConfig.brakeDeviceId ||
        currentConfig.clutchDeviceId || currentConfig.handbrakeAxisDeviceId ||
        (currentConfig.handbrakeButtonsDeviceIds?.find(id => id !== null)) || '';

    // Логика графика ручника
    if (mode === 'handbrake' || mode.startsWith('handbrake-button')) {
        const hasHandbrakeAxis = currentConfig.handbrakeAxis !== null;
        const hasHandbrakeButtons = currentConfig.handbrakeButtons.some(btn => btn !== -1);
        if (!hasHandbrakeAxis && !hasHandbrakeButtons && currentConfig.showHandbrakeGraph) {
            if (DOM.toggleHandbrakeGraphBtn) DOM.toggleHandbrakeGraphBtn.classList.remove('active');
            currentConfig.showHandbrakeGraph = false;
            GraphManager.clear('handbrake');
        }
    }

    if (!mode.startsWith('handbrake-button')) {
        const graphKey = `show${mode.charAt(0).toUpperCase() + mode.slice(1)}Graph`;
        if (currentConfig[graphKey]) { GraphManager.clear(mode); }
    }

    updateBindingsUI();
    updateAllToggleStates();
}

function clearGearAssignment(mode) {
    if (mode.startsWith('gear-button')) {
        const slotIndex = parseInt(mode.split('-')[2]);
        if (currentConfig.gearButtons) {
            currentConfig.gearButtons[slotIndex] = -1;
            currentConfig.gearButtonsDeviceIds[slotIndex] = null;
        }
        updateBindingsUI();
        updateAllToggleStates();
        const hasRemainingGearButtons = currentConfig.gearButtons && currentConfig.gearButtons.some(b => b !== -1);
        if (!hasRemainingGearButtons) updateWidgetLayout();
    }
}

window._onThemeApplied = function(themeKey) {
    var colors = {};
    var custom = window._customThemes && window._customThemes[themeKey];
    if (custom && custom.colors) {
        for (var key in custom.colors) {
            if (custom.colors[key]) colors[key] = custom.colors[key];
        }
    } else if (typeof getCurrentThemeColors === 'function') {
        var allColors = getCurrentThemeColors();
        for (var key in allColors) {
            if (allColors[key]) colors[key] = allColors[key];
        }
    }
    if (Object.keys(colors).length === 0) { return; }
    var msg = JSON.stringify({ action: 'themeColors', colors: colors });
    if (window.chrome?.webview) {
        window.chrome.webview.postMessage(msg);
    }
    if (udpState.socket && udpState.connected) {
        udpState.socket.send(msg);
    }
};


