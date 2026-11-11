// ==========================================
// MultiWidget — управление видимостью элементов HUD
// _hideBindingMask — временная маска для рендера (не трогает бинды).
// Элементы без биндов (gm/gr/bg) — через isVisible() / hideXxx.
// ==========================================
'use strict';

// --- Состояние ---
var _multiWidgetSlots = [];
var _multiWidgetActiveSlot = 0;
var _hideBindingMask = {};
window._hideBindingMask = _hideBindingMask;

// --- Маппинг ---
var MW_ENTRIES = [
    { key: 'wh', label: 'Руль', loc: 'wheel' },
    { key: 'gb', label: 'КПП', loc: 'gearbox' },
    { key: 'hb', label: 'Ручник', loc: 'handbrake' },
    { key: 'th', label: 'Газ', loc: 'throttle' },
    { key: 'br', label: 'Тормоз', loc: 'brake' },
    { key: 'cl', label: 'Сцепление', loc: 'clutch' },
    { key: 'gm', label: 'G-meter', loc: 'gmeter', hideKey: 'hideGmeter' },
    { key: 'gr', label: 'Графики', loc: 'graphs', hideKey: 'hideGraphs' },
    { key: 'tr', label: 'Итог СУ', loc: 'tvdResults', hideKey: 'hideTvdResults' },
    { key: 'bg', label: 'Фон', loc: 'bg', hideKey: 'hideBg' }
];

var SLOT_PROPS = { wh:'Wheel', th:'Throttle', br:'Brake', cl:'Clutch',
    hb:'Handbrake', gb:'Gear', gm:'Gmeter', gr:'Graphs', tr:'TvdResults', bg:'Background' };

// ==========================================
// 1. ПАНЕЛЬ
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
        label.appendChild(cb);
        var span = document.createElement('span');
        span.setAttribute('data-i18n', 'mw.' + entry.loc);
        span.textContent = ' ' + t('mw.' + entry.loc);
        label.appendChild(span);
        cbsContainer.appendChild(label);
    });

    inner.appendChild(cbsContainer);

    var copyBtn = document.createElement('button');
    copyBtn.id = 'mwCopyUrl';
    copyBtn.className = 'btn';
    copyBtn.title = t('multiwidget.copyUrl');
    copyBtn.textContent = t('multiwidget.copyUrl');
    wrapper.appendChild(copyBtn);

    cbsContainer.addEventListener('mousedown', onMwMouseDown);
    cbsContainer.addEventListener('mousemove', onMwMouseMove);
    cbsContainer.addEventListener('mouseup', onMwMouseUp);
    cbsContainer.addEventListener('click', function(e) { e.preventDefault(); });
    copyBtn.addEventListener('click', copyWidgetUrl);
    updateCopyBtnText();
}

// ==========================================
// 2. ЧЕКБОКСЫ — пишут маску
// ==========================================

function onMwCheckboxClick(key, forceChecked) {
    var entry = getMwEntry(key);
    if (!entry) return;
    var cb = getMwCheckbox(key);
    if (!cb) return;

    var newChecked = forceChecked !== undefined ? forceChecked : !cb.checked;
    cb.checked = newChecked;

    if (entry.hideKey) {
        // gm/gr/bg
        currentConfig[entry.hideKey] = !newChecked;
    } else {
        // Элемент с биндами — маска
        _hideBindingMask[key] = !newChecked;
    }

    if (currentConfig.multiWidgetMode && _multiWidgetSlots.length > 0) {
        var prop = SLOT_PROPS[key];
        if (prop) _multiWidgetSlots[_multiWidgetActiveSlot][prop] = newChecked;
    }

    applyConfig();
    syncPanelCheckboxes();
    broadcastMwState();
}

function getMwEntry(key) {
    for (var i = 0; i < MW_ENTRIES.length; i++) {
        if (MW_ENTRIES[i].key === key) return MW_ENTRIES[i];
    }
    return null;
}

function getMwCheckbox(key) {
    return document.querySelector('#mwCheckboxes input[data-mw="' + key + '"]');
}

// ==========================================
// 3. ВКЛАДКИ (слоты)
// ==========================================

function makeDefaultSlot() {
    return { Wheel:true, Throttle:true, Brake:true, Clutch:true,
        Handbrake:true, Gear:true, Gmeter:true, Graphs:true, TvdResults:true, Background:true };
}

function applySlotMask(slotIndex) {
    _hideBindingMask = {};
    if (slotIndex < 0 || slotIndex >= _multiWidgetSlots.length) return;
    var slot = _multiWidgetSlots[slotIndex];
    for (var key in SLOT_PROPS) {
        var prop = SLOT_PROPS[key];
        if (slot[prop] === false) _hideBindingMask[key] = true;
    }
    window._hideBindingMask = _hideBindingMask;
}

function enableMultiWidget(slots, activeSlot) {
    if (typeof URL_MW_PARAM !== 'undefined' && URL_MW_PARAM !== null) {
        if (currentConfig.multiWidgetSlots && currentConfig.multiWidgetSlots.length > 0) {
            _multiWidgetSlots = JSON.parse(JSON.stringify(currentConfig.multiWidgetSlots));
        } else {
            _multiWidgetSlots = slots && slots.length > 0 ? JSON.parse(JSON.stringify(slots)) : null;
        }
        _multiWidgetActiveSlot = activeSlot || 0;
        if (!_multiWidgetSlots || _multiWidgetSlots.length === 0) {
            _multiWidgetSlots = [makeDefaultSlot()];
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
        _multiWidgetSlots = slots && slots.length > 0 ? JSON.parse(JSON.stringify(slots)) : null;
        _multiWidgetActiveSlot = activeSlot || 0;
        if (!_multiWidgetSlots || _multiWidgetSlots.length === 0) {
            _multiWidgetSlots = [makeDefaultSlot()];
        }
    }
    if (_multiWidgetActiveSlot >= _multiWidgetSlots.length) _multiWidgetActiveSlot = 0;

    applySlotMask(_multiWidgetActiveSlot);

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

    applyConfig();
    renderMultiWidgetTabs();
    updateCopyBtnText();
    syncPanelCheckboxes();
    broadcastMwState();
}

function disableMultiWidget() {
    _hideBindingMask = {};
    window._hideBindingMask = _hideBindingMask;
    MW_ENTRIES.forEach(function(entry) {
        if (entry.hideKey) currentConfig[entry.hideKey] = false;
    });

    _multiWidgetSlots = [];
    _multiWidgetActiveSlot = 0;

    var tabs = document.getElementById('multiWidgetTabs');
    if (tabs) tabs.classList.remove('visible');

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

    _multiWidgetSlots[_multiWidgetActiveSlot] = slotToObject();
    _multiWidgetActiveSlot = slot;
    applySlotMask(slot);
    renderMultiWidgetTabs();
    updateCopyBtnText();
    sendMultiWidgetState();
    broadcastMwState();
}

function slotToObject() {
    var obj = {};
    for (var key in SLOT_PROPS) {
        var prop = SLOT_PROPS[key];
        obj[prop] = !(_hideBindingMask[key] || false);
    }
    return obj;
}

function addMultiWidgetSlot() {
    if (_multiWidgetSlots.length >= 6) return;
    var prev = _multiWidgetSlots[_multiWidgetSlots.length - 1] || makeDefaultSlot();
    var newSlot = {};
    for (var prop in prev) {
        newSlot[prop] = !prev[prop];
    }
    _multiWidgetSlots.push(newSlot);
    _multiWidgetActiveSlot = _multiWidgetSlots.length - 1;
    applySlotMask(_multiWidgetActiveSlot);
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
    applySlotMask(_multiWidgetActiveSlot);
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
    applySlotMask(_multiWidgetActiveSlot);
    renderMultiWidgetTabs();
    updateCopyBtnText();
    sendMultiWidgetState();
    broadcastMwState();
}

function sendMultiWidgetState() {
    currentConfig.multiWidgetSlots = JSON.parse(JSON.stringify(_multiWidgetSlots));
    currentConfig.multiWidgetActiveSlot = _multiWidgetActiveSlot;
}

// ==========================================
// 4. ВИДИМОСТЬ — фильтр для рендера
// ==========================================

function isVisible(name) {
    // URL-параметр ?nogears
    if (name === 'gb' && typeof URL_HIDE_GEAR !== 'undefined' && URL_HIDE_GEAR) return false;
    // Маска (чекбоксы / MW)
    if (_hideBindingMask && _hideBindingMask[name]) return false;
    // hideXxx для gm/gr/bg
    var entry = getMwEntry(name);
    if (entry && entry.hideKey && currentConfig[entry.hideKey]) return false;
    // HIDE_CONFIG_MAP для остальных (OFF-режим)
    var configKey = HIDE_CONFIG_MAP[name];
    if (configKey && currentConfig[configKey]) return false;
    return true;
}

// ==========================================
// 5. ПАНЕЛЬ: синхронизация
// ==========================================

function onMwToggleChange(e) {
    if (e.currentTarget.classList.contains('active')) {
        disableMultiWidget();
    } else {
        enableMultiWidget(currentConfig.multiWidgetSlots || [], currentConfig.multiWidgetActiveSlot || 0);
    }
}

function syncPanelCheckboxes() {
    var sources = mwGetAvailableSources();
    MW_ENTRIES.forEach(function(entry) {
        var cb = getMwCheckbox(entry.key);
        if (!cb) return;
        var label = cb.closest('.mw-cb');
        if (label) {
            label.style.display = sources[entry.key] ? '' : 'none';
        }
        if (currentConfig.multiWidgetMode && _multiWidgetSlots.length > 0) {
            var prop = SLOT_PROPS[entry.key];
            // undefined — старый слот без этого свойства, считаем видимым (как applySlotMask)
            cb.checked = prop ? _multiWidgetSlots[_multiWidgetActiveSlot][prop] !== false : true;
        } else {
            cb.checked = isVisible(entry.key);
        }
    });
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
            currentConfig.handbrakeButtons.some(function(b) { return b !== -1; }) ||
            currentConfig.handbrakeKeyboardKeys?.some(function(k) { return k !== null; }) ||
            (currentConfig.useUdpTelemetry && currentConfig.showHandbrakeUdp && udpState.connected),
        gb: gearFromUdp || currentConfig.gearButtons.some(function(b) { return b !== -1; }),
        gm: isUdpReady && currentConfig.showGmeter,
        gr: currentConfig.showWheelGraph || currentConfig.showThrottleGraph ||
            currentConfig.showBrakeGraph || currentConfig.showClutchGraph ||
            currentConfig.showHandbrakeGraph,
        tr: !!currentConfig.showTvdResults,
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
        var slotNum = (_multiWidgetActiveSlot || 0) + 1;
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
// 6. ДРАГ-ТУГГЛИНГ
// ==========================================

var _mwDragActive = false;
var _mwDragTarget = false;
var _mwLastDragCb = null;

function onMwMouseDown(e) {
    var cb = findMwCheckbox(e.target);
    if (!cb) return;
    _mwDragActive = true;
    _mwDragTarget = !cb.checked;
    _mwLastDragCb = null;
    cb.checked = _mwDragTarget;
    var key = cb.dataset.mw;
    if (key) onMwCheckboxClick(key, _mwDragTarget);
    e.preventDefault();
}

function onMwMouseMove(e) {
    if (!_mwDragActive) return;
    if (e.buttons !== 1) { endMwDrag(); return; }
    var cb = findMwCheckbox(e.target);
    if (cb && cb !== _mwLastDragCb) {
        _mwLastDragCb = cb;
        cb.checked = _mwDragTarget;
        var key = cb.dataset.mw;
        if (key) onMwCheckboxClick(key, _mwDragTarget);
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
// 7. ИНИЦИАЛИЗАЦИЯ
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
// 8. ЭКСПОРТ + backwards compat
// ==========================================

window.MultiWidget = {
    init: initMultiWidget,
    enableMultiWidget: enableMultiWidget,
    disableMultiWidget: disableMultiWidget,
    isVisible: isVisible,
    syncPanelCheckboxes: syncPanelCheckboxes,
    applyVisibilityOverlay: function(hideArray) {
        _hideBindingMask = {};
        if (hideArray) hideArray.forEach(function(k) { _hideBindingMask[k] = true; });
        window._hideBindingMask = _hideBindingMask;
        applyConfig();
    },
    applyVisibilityPreset: function(hideMap) {
        _hideBindingMask = {};
        if (hideMap) for (var k in hideMap) { if (hideMap[k]) _hideBindingMask[k] = true; }
        window._hideBindingMask = _hideBindingMask;
        applyConfig();
    }
};

function applyConfig() { if (typeof window.applyConfig === 'function') window.applyConfig(); }
