// ==========================================
// MultiWidget — управление видимостью элементов HUD
// Все настройки хранятся в пресете (currentConfig).
// ==========================================
'use strict';

// --- Состояние ---
var _multiWidgetSlots = [];
var _multiWidgetActiveSlot = 0;
var _savedOffModeHide = null;
window._hideOverlay = window._hideOverlay || null;
window._urlOverlayExplicit = window._urlOverlayExplicit || false;

// --- Драг-тугглинг ---
var _mwDragActive = false;
var _mwDragTarget = false;
var _mwLastDragCb = null;

// --- Маппинг shortcode → configKey / label ---
var MW_ENTRIES = [
    { key: 'wh', config: 'hideWheel',     label: 'Руль', loc: 'wheel' },
    { key: 'gb', config: 'hideGear',      label: 'КПП', loc: 'gearbox' },
    { key: 'hb', config: 'hideHandbrake', label: 'Ручник', loc: 'handbrake' },
    { key: 'cl', config: 'hideClutch',    label: 'Сцепление', loc: 'clutch' },
    { key: 'br', config: 'hideBrake',     label: 'Тормоз', loc: 'brake' },
    { key: 'th', config: 'hideThrottle',  label: 'Газ', loc: 'throttle' },
    { key: 'gm', config: 'hideGmeter',    label: 'G-meter', loc: 'gmeter' },
    { key: 'gr', config: 'hideGraphs',    label: 'Графики', loc: 'graphs' },
    { key: 'bg', config: 'hideBg',        label: 'Фон', loc: 'bg' }
];

// ==========================================
// 1. ПАНЕЛЬ: рендер и обработчики
// ==========================================

function buildMwPanel() {
    var panel = document.getElementById('mwPanel');
    if (!panel) return;

    var inner = panel.querySelector('.mw-panel-inner');
    if (!inner) return;

    var wrapper = document.createElement('div');
    wrapper.className = 'mw-row';
    panel.parentNode.insertBefore(wrapper, panel);
    wrapper.appendChild(panel);

    // --- Панель чекбоксов ---
    var cbsContainer = document.createElement('div');
    cbsContainer.id = 'mwCheckboxes';
    cbsContainer.className = 'mw-checkboxes';

    MW_ENTRIES.forEach(function(entry) {
        var label = document.createElement('label');
        label.className = 'mw-cb';

        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.dataset.mw = entry.key;
        cb.checked = true;
        cb.addEventListener('click', function(e) {
            e.preventDefault();
        });

        label.appendChild(cb);
        var span = document.createElement('span');
        span.setAttribute('data-i18n', 'mw.' + entry.loc);
        span.textContent = ' ' + t('mw.' + entry.loc);
        label.appendChild(span);
        cbsContainer.appendChild(label);
    });

    inner.appendChild(cbsContainer);

    // --- Кнопка копирования ---
    var copyBtn = document.createElement('button');
    copyBtn.id = 'mwCopyUrl';
    copyBtn.className = 'btn';
    copyBtn.title = t('multiwidget.copyUrl');
    copyBtn.textContent = t('multiwidget.copyUrl');
    wrapper.appendChild(copyBtn);

    // --- Обработчики ---
    cbsContainer.addEventListener('mousedown', onMwMouseDown);
    cbsContainer.addEventListener('mousemove', onMwMouseMove);
    cbsContainer.addEventListener('mouseup', onMwMouseUp);
    cbsContainer.addEventListener('click', function(e) { e.preventDefault(); });
    copyBtn.addEventListener('click', copyWidgetUrl);

    updateCopyBtnText();
}

function onMwToggleChange(e) {
    if (e.currentTarget.classList.contains('active')) {
        disableMultiWidget();
    } else {
        enableMultiWidget(currentConfig.multiWidgetSlots || [], currentConfig.multiWidgetActiveSlot || 0);
    }
}

function onVisibilityChanged() {
    if (currentConfig.multiWidgetMode) {
        // ON-режим: обновить оверлей из чекбоксов
        var hidden = [];
        MW_ENTRIES.forEach(function(entry) {
            var cb = getMwCheckbox(entry.key);
            if (cb && !cb.checked) hidden.push(entry.key);
        });
        applyVisibilityOverlay(hidden.length > 0 ? hidden : null);
    } else {
        // OFF-режим: обновить currentConfig.hideXxx из чекбоксов
        MW_ENTRIES.forEach(function(entry) {
            var cb = getMwCheckbox(entry.key);
            if (cb) currentConfig[entry.config] = !cb.checked;
        });
        applyConfig();
    }
    // broadcast to OBS clients
    broadcastMwState();
}

function getMwCheckbox(key) {
    return document.querySelector('#mwCheckboxes input[data-mw="' + key + '"]');
}

function syncPanelCheckboxes() {
    var sources = mwGetAvailableSources();

    MW_ENTRIES.forEach(function(entry) {
        var cb = getMwCheckbox(entry.key);
        if (!cb) return;

        // Скрыть чекбокс если нет источника данных
        var label = cb.closest('.mw-cb');
        if (label) {
            label.style.display = sources[entry.key] ? '' : 'none';
        }

        if (currentConfig.multiWidgetMode) {
            var overlay = window._hideOverlay || [];
            cb.checked = overlay.indexOf(entry.key) === -1;
        } else {
            cb.checked = !currentConfig[entry.config];
        }
    });
    // Синхронизировать тогглер
    var toggleBtn = document.getElementById('mwToggle');
    if (toggleBtn) toggleBtn.classList.toggle('active', !!currentConfig.multiWidgetMode);
}

function mwGetAvailableSources() {
    var isUdpReady = currentConfig.useUdpTelemetry && udpState.connected;
    var pedalsFromUdp = isUdpReady && currentConfig.showPedalsInUdp;
    var gearFromUdp = isUdpReady && currentConfig.showGearUdp;
    var wheelFromUdp = isUdpReady && currentConfig.showWheelUdp;

    return {
        wh: wheelFromUdp || currentConfig.wheelAxis !== null,
        th: pedalsFromUdp || currentConfig.throttleAxis !== null,
        br: pedalsFromUdp || currentConfig.brakeAxis !== null,
        cl: pedalsFromUdp || currentConfig.clutchAxis !== null,
        hb: currentConfig.handbrakeAxis !== null ||
            currentConfig.handbrakeButtons.some(function(b) { return b !== -1; }),
        gb: gearFromUdp || currentConfig.gearButtons.some(function(b) { return b !== -1; }),
        gm: isUdpReady && currentConfig.showGmeter,
        gr: currentConfig.showWheelGraph || currentConfig.showThrottleGraph ||
            currentConfig.showBrakeGraph || currentConfig.showClutchGraph ||
            currentConfig.showHandbrakeGraph,
        bg: true
    };
}

function broadcastMwState() {
    if (typeof sendConfigUpdate === 'function') sendConfigUpdate();
}

function copyWidgetUrl() {
    var presetName = ConfigManager.getCurrent() || 'Default';
    var baseUrl = window.location.origin + window.location.pathname;
    var url = baseUrl + '?preset=' + presetName;
    var wsport = new URLSearchParams(window.location.search).get('wsport');
    if (wsport && wsport !== '20888') url += '&wsport=' + wsport;
    if (currentConfig.multiWidgetMode) {
        var slotNum = (currentConfig.multiWidgetActiveSlot ?? _multiWidgetActiveSlot ?? 0) + 1;
        url += '&mw=' + slotNum;
    }
    try {
        navigator.clipboard.writeText(url);
        showStatusMessage(t('multiwidget.urlCopied'));
    } catch (e) {
        console.warn('Clipboard error:', e);
    }
}

function updateCopyBtnText() {
    var btn = document.getElementById('mwCopyUrl');
    if (!btn) return;
    if (currentConfig.multiWidgetMode) {
        var slotNum = (_multiWidgetActiveSlot || 0) + 1;
        btn.textContent = t('multiwidget.copySlot', slotNum);
        btn.style.width = '202px';
    } else {
        btn.textContent = t('multiwidget.copyUrl');
        btn.style.width = '155px';
    }
}

// ==========================================
// 2. ДРАГ-ТУГГЛИНГ
// ==========================================

function onMwMouseDown(e) {
    var cb = findMwCheckbox(e.target);
    if (!cb) return;
    _mwDragActive = true;
    _mwDragTarget = !cb.checked;
    _mwLastDragCb = null;
    cb.checked = _mwDragTarget;
    onVisibilityChanged();
    e.preventDefault();
}

function onMwMouseMove(e) {
    if (!_mwDragActive) return;
    if (e.buttons !== 1) { endMwDrag(); return; }
    var cb = findMwCheckbox(e.target);
    if (cb && cb !== _mwLastDragCb) {
        _mwLastDragCb = cb;
        cb.checked = _mwDragTarget;
        onVisibilityChanged();
    }
}

function onMwMouseUp() {
    if (_mwDragActive) endMwDrag();
}

function endMwDrag() {
    _mwDragActive = false;
    _mwLastDragCb = null;
}

function findMwCheckbox(el) {
    while (el && el !== document.getElementById('mwCheckboxes')) {
        if (el.tagName === 'LABEL' && el.classList.contains('mw-cb')) {
            return el.querySelector('input[type="checkbox"]');
        }
        el = el.parentElement;
    }
    return null;
}

// ==========================================
// 3. УПРАВЛЕНИЕ ВКЛАДКАМИ (слоты)
// ==========================================

function enableMultiWidget(slots, activeSlot) {
    // Сохранить hideXxx OFF-режима для восстановления при выключении
    _savedOffModeHide = MW_ENTRIES.map(function(e) { return currentConfig[e.config]; });

    if (typeof URL_MW_PARAM !== 'undefined' && URL_MW_PARAM !== null) {
        // Слоты — из currentConfig (сохраняем данные пресета), иначе из аргументов
        if (currentConfig.multiWidgetSlots && currentConfig.multiWidgetSlots.length > 0) {
            _multiWidgetSlots = JSON.parse(JSON.stringify(currentConfig.multiWidgetSlots));
        } else {
            _multiWidgetSlots = (slots && slots.length > 0) ? JSON.parse(JSON.stringify(slots)) : null;
        }
        _multiWidgetActiveSlot = activeSlot || 0;
        if (!_multiWidgetSlots || _multiWidgetSlots.length === 0) {
            _multiWidgetSlots = [{
                Wheel: true, Throttle: true, Brake: true, Clutch: true,
                Handbrake: true, Gear: true, Gmeter: true, Graphs: true, Background: true
            }];
        }
        var mwSlot = URL_MW_PARAM - 1;
        if (mwSlot >= 0 && mwSlot < _multiWidgetSlots.length) {
            _multiWidgetActiveSlot = mwSlot;
        } else {
            _multiWidgetActiveSlot = 0;
        }
    } else if (currentConfig.multiWidgetSlots && currentConfig.multiWidgetSlots.length > 0) {
        _multiWidgetSlots = JSON.parse(JSON.stringify(currentConfig.multiWidgetSlots));
        _multiWidgetActiveSlot = currentConfig.multiWidgetActiveSlot || 0;
    } else {
        _multiWidgetSlots = (slots && slots.length > 0) ? slots : null;
        _multiWidgetActiveSlot = activeSlot || 0;
        if (!_multiWidgetSlots || _multiWidgetSlots.length === 0) {
            _multiWidgetSlots = [{
                Wheel: true, Throttle: true, Brake: true, Clutch: true,
                Handbrake: true, Gear: true, Gmeter: true, Graphs: true, Background: true
            }];
        }
    }

    if (_multiWidgetActiveSlot >= _multiWidgetSlots.length) _multiWidgetActiveSlot = 0;

    currentConfig.multiWidgetMode = true;
    currentConfig.multiWidgetSlots = JSON.parse(JSON.stringify(_multiWidgetSlots));
    currentConfig.multiWidgetActiveSlot = _multiWidgetActiveSlot;

    var tabs = document.getElementById('multiWidgetTabs');
    if (tabs) {
        tabs.style.display = '';
        tabs.classList.remove('visible');
        void tabs.offsetHeight;
        tabs.classList.add('visible');
    }

    applySlotToOverlay(_multiWidgetActiveSlot);
    renderMultiWidgetTabs();
    updateCopyBtnText();
    syncPanelCheckboxes();
    broadcastMwState();
}

function disableMultiWidget() {
    _multiWidgetSlots = [];
    _multiWidgetActiveSlot = 0;

    // Восстановить hideXxx OFF-режима
    if (_savedOffModeHide) {
        MW_ENTRIES.forEach(function(entry, i) {
            currentConfig[entry.config] = _savedOffModeHide[i];
        });
        _savedOffModeHide = null;
    }

    var tabs = document.getElementById('multiWidgetTabs');
    if (tabs) tabs.classList.remove('visible');

    window._hideOverlay = null;
    window._urlOverlayExplicit = false;
    currentConfig.multiWidgetMode = false;
    applyConfig();
    syncPanelCheckboxes();
    broadcastMwState();
    updateCopyBtnText();
}

function renderMultiWidgetTabs() {
    var container = document.getElementById('mwTabContainer');
    if (!container) return;
    container.innerHTML = '';

    for (var i = 0; i < _multiWidgetSlots.length; i++) {
        var btn = document.createElement('button');
        btn.className = 'mw-tab' + (i === _multiWidgetActiveSlot ? ' active' : '');
        btn.textContent = (i + 1).toString();
        btn.dataset.slot = i;
        btn.addEventListener('click', onMwTabClick);

        var removeBtn = document.createElement('span');
        removeBtn.className = 'mw-tab-remove';
        removeBtn.textContent = '\u00d7';
        removeBtn.addEventListener('click', function(idx) {
            return function(e) {
                e.stopPropagation();
                removeMultiWidgetSlotAt(idx);
            };
        }(i));
        btn.appendChild(removeBtn);

        container.appendChild(btn);
    }
}

function onMwTabClick(e) {
    var slot = parseInt(e.currentTarget.dataset.slot, 10);
    if (isNaN(slot) || slot === _multiWidgetActiveSlot) return;

    _multiWidgetSlots[_multiWidgetActiveSlot] = overlayToSlot();
    _multiWidgetActiveSlot = slot;
    applySlotToOverlay(slot);
    renderMultiWidgetTabs();
    updateCopyBtnText();
    sendMultiWidgetState();
    broadcastMwState();
}

function addMultiWidgetSlot() {
    if (_multiWidgetSlots.length >= 6) return;

    _multiWidgetSlots.push({
        Wheel: true, Throttle: true, Brake: true, Clutch: true,
        Handbrake: true, Gear: true, Gmeter: true, Graphs: true, Background: true
    });
    _multiWidgetActiveSlot = _multiWidgetSlots.length - 1;
    applySlotToOverlay(_multiWidgetActiveSlot);
    renderMultiWidgetTabs();
    updateCopyBtnText();
    sendMultiWidgetState();
    broadcastMwState();
}

function removeMultiWidgetSlot() {
    if (_multiWidgetSlots.length <= 1) return;

    _multiWidgetSlots.splice(_multiWidgetActiveSlot, 1);
    if (_multiWidgetActiveSlot >= _multiWidgetSlots.length)
        _multiWidgetActiveSlot = _multiWidgetSlots.length - 1;

    applySlotToOverlay(_multiWidgetActiveSlot);
    renderMultiWidgetTabs();
    updateCopyBtnText();
    sendMultiWidgetState();
    broadcastMwState();
}

function removeMultiWidgetSlotAt(index) {
    if (_multiWidgetSlots.length <= 1) return;

    _multiWidgetSlots.splice(index, 1);
    if (index < _multiWidgetActiveSlot) {
        _multiWidgetActiveSlot--;
    } else if (index === _multiWidgetActiveSlot) {
        if (_multiWidgetActiveSlot >= _multiWidgetSlots.length)
            _multiWidgetActiveSlot = _multiWidgetSlots.length - 1;
    }

    applySlotToOverlay(_multiWidgetActiveSlot);
    renderMultiWidgetTabs();
    updateCopyBtnText();
    sendMultiWidgetState();
    broadcastMwState();
}

function slotToHideArray(slot) {
    if (!slot) return null;
    var hidden = [];
    if (!slot.Wheel) hidden.push('wh');
    if (!slot.Throttle) hidden.push('th');
    if (!slot.Brake) hidden.push('br');
    if (!slot.Clutch) hidden.push('cl');
    if (!slot.Handbrake) hidden.push('hb');
    if (!slot.Gear) hidden.push('gb');
    if (!slot.Gmeter) hidden.push('gm');
    if (!slot.Graphs) hidden.push('gr');
    if (!slot.Background) hidden.push('bg');
    return hidden.length > 0 ? hidden : null;
}

function overlayToSlot() {
    var overlay = window._hideOverlay || [];
    return {
        Wheel: !overlay.includes('wh'),
        Throttle: !overlay.includes('th'),
        Brake: !overlay.includes('br'),
        Clutch: !overlay.includes('cl'),
        Handbrake: !overlay.includes('hb'),
        Gear: !overlay.includes('gb'),
        Gmeter: !overlay.includes('gm'),
        Graphs: !overlay.includes('gr'),
        Background: !overlay.includes('bg')
    };
}

function applySlotToOverlay(index) {
    if (index < 0 || index >= _multiWidgetSlots.length) {
        window._hideOverlay = null;
        applyConfig();
        return;
    }
    var hideArray = slotToHideArray(_multiWidgetSlots[index]);
    applyVisibilityOverlay(hideArray);
}

function sendMultiWidgetState() {
    currentConfig.multiWidgetSlots = JSON.parse(JSON.stringify(_multiWidgetSlots));
    currentConfig.multiWidgetActiveSlot = _multiWidgetActiveSlot;
}

// ==========================================
// 4. ВИДИМОСТЬ
// ==========================================

function isVisible(name) {
    if (!window._urlOverlayExplicit && typeof URL_HIDE_PARAM !== 'undefined' && URL_HIDE_PARAM !== null) {
        var h = URL_HIDE_PARAM === '' ? [] : URL_HIDE_PARAM.split(',');
        if (h.includes(name)) return false;
    }
    if (window._urlOverlayExplicit) {
        if (window._hideOverlay === null) return true;
        return !window._hideOverlay.includes(name);
    }
    var configKey = HIDE_CONFIG_MAP[name];
    if (configKey && currentConfig[configKey]) return false;
    return true;
}



function syncOverlayToSlot() {
    if (_multiWidgetSlots.length > 0 && _multiWidgetActiveSlot < _multiWidgetSlots.length) {
        _multiWidgetSlots[_multiWidgetActiveSlot] = overlayToSlot();
        currentConfig.multiWidgetSlots = JSON.parse(JSON.stringify(_multiWidgetSlots));
    }
}

function applyVisibilityOverlay(hideArray) {
    window._urlOverlayExplicit = true;
    if (hideArray === null) {
        window._hideOverlay = null;
        syncOverlayToSlot();
        applyConfig();
        syncPanelCheckboxes();
        return;
    }

    var keys = hideArray.length > 0 ? hideArray.map(function(s) { return String(s).toLowerCase().trim(); }) : null;
    window._hideOverlay = keys;

    syncOverlayToSlot();
    applyConfig();
    syncPanelCheckboxes();
}

function applyVisibilityPreset(hideMap) {
    window._hideOverlay = null;
    window._urlOverlayExplicit = false;
    for (var key in HIDE_CONFIG_MAP) {
        currentConfig[HIDE_CONFIG_MAP[key]] = false;
    }
    if (hideMap) {
        for (var key in hideMap) {
            var configKey = HIDE_CONFIG_MAP[key];
            if (configKey) currentConfig[configKey] = true;
        }
    }
    applyConfig();
    syncPanelCheckboxes();
}

// ==========================================
// 5. ИНИЦИАЛИЗАЦИЯ
// ==========================================

function initMultiWidget() {
    buildMwPanel();

    var toggleBtn = document.getElementById('mwToggle');
    if (toggleBtn) toggleBtn.addEventListener('click', onMwToggleChange);

    var removeBtn = document.getElementById('mwRemoveSlot');
    var addBtn = document.getElementById('mwAddSlot');
    if (removeBtn) removeBtn.addEventListener('click', removeMultiWidgetSlot);
    if (addBtn) addBtn.addEventListener('click', addMultiWidgetSlot);

    syncPanelCheckboxes();

    if (typeof URL_MW_PARAM !== 'undefined' && URL_MW_PARAM !== null) {
        enableMultiWidget(currentConfig.multiWidgetSlots || [], currentConfig.multiWidgetActiveSlot || 0);
    } else if (currentConfig.multiWidgetMode && currentConfig.multiWidgetSlots && currentConfig.multiWidgetSlots.length > 0) {
        enableMultiWidget(currentConfig.multiWidgetSlots, currentConfig.multiWidgetActiveSlot);
    }
}

// ==========================================
// 6. ЭКСПОРТ
// ==========================================

window.MultiWidget = {
    init: initMultiWidget,
    enableMultiWidget: enableMultiWidget,
    disableMultiWidget: disableMultiWidget,
    isVisible: isVisible,
    applyVisibilityOverlay: applyVisibilityOverlay,
    applyVisibilityPreset: applyVisibilityPreset,
    syncPanelCheckboxes: syncPanelCheckboxes
};
