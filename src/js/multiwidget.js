// ==========================================
// MultiWidget — управление видимостью элементов HUD
// Чекбоксы НЕ через isVisible(), а напрямую null'ят/восстанавливают бинды.
// Элементы без биндов (gm/gr/bg) — через isVisible() / hideXxx.
// ==========================================
'use strict';

// --- Состояние ---
var _multiWidgetSlots = [];
var _multiWidgetActiveSlot = 0;
var _savedFullBindings = null;   // deep clone конфига при включении MW
var _savedCheckboxBindings = {}; // per-key save для OFF-режима
var _pedalUdpBlock = { throttle: false, brake: false, clutch: false };

// --- Маппинг: shortcode → ключи биндов / hide-ключ / UDP-флаг ---
var MW_ENTRIES = [
    { key: 'wh', label: 'Руль', loc: 'wheel',
      bindKeys: ['wheelAxis', 'wheelDeviceId', 'showWheelUdp'] },
    { key: 'gb', label: 'КПП', loc: 'gearbox',
      bindKeys: ['gearButtons', 'gearButtonsDeviceIds', 'showGearUdp'] },
    { key: 'hb', label: 'Ручник', loc: 'handbrake',
      bindKeys: ['handbrakeAxis', 'handbrakeAxisDeviceId', 'handbrakeButtons', 'handbrakeButtonsDeviceIds', 'showHandbrakeUdp'] },
    { key: 'th', label: 'Газ', loc: 'throttle',
      bindKeys: ['throttleAxis', 'throttleDeviceId'] },
    { key: 'br', label: 'Тормоз', loc: 'brake',
      bindKeys: ['brakeAxis', 'brakeDeviceId'] },
    { key: 'cl', label: 'Сцепление', loc: 'clutch',
      bindKeys: ['clutchAxis', 'clutchDeviceId'] },
    { key: 'gm', label: 'G-meter', loc: 'gmeter',
      bindKeys: null, hideKey: 'hideGmeter' },
    { key: 'gr', label: 'Графики', loc: 'graphs',
      bindKeys: null, hideKey: 'hideGraphs' },
    { key: 'bg', label: 'Фон', loc: 'bg',
      bindKeys: null, hideKey: 'hideBg' }
];

var CHECKED_KEY = 'Wh'; // для совместимости с old slot objects

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
        cb.addEventListener('click', function(e) {
            e.preventDefault();
            onMwCheckboxClick(entry.key);
        });
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
// 2. ЧЕКБОКСЫ — null'ят/восстанавливают бинды
// ==========================================

function onMwCheckboxClick(key) {
    var entry = getMwEntry(key);
    if (!entry) return;
    var cb = getMwCheckbox(key);
    if (!cb) return;

    var newChecked = !cb.checked;
    cb.checked = newChecked;

    if (entry.bindKeys) {
        // Элемент с биндами — null'им или восстанавливаем
        if (newChecked) {
            restoreBinding(key);
        } else {
            saveAndNullBinding(key);
        }
    } else {
        // Элемент без биндов — hideXxx (gm/gr/bg)
        currentConfig[entry.hideKey] = !newChecked;
    }

    // Обновить hide-флаг в текущем слоте (MW mode)
    if (currentConfig.multiWidgetMode && _multiWidgetSlots.length > 0) {
        hideInCurrentSlot(key, !newChecked);
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

// --- Null/restore binding helpers ---

function saveAndNullBinding(key) {
    var entry = getMwEntry(key);
    if (!entry || !entry.bindKeys) return;
    // Всегда сохраняем в _savedCheckboxBindings (на случай если _savedFullBindings нет/isNaN)
    if (!_savedCheckboxBindings[key]) {
        _savedCheckboxBindings[key] = {};
        entry.bindKeys.forEach(function(k) {
            _savedCheckboxBindings[key][k] = JSON.parse(JSON.stringify(currentConfig[k]));
        });
    }
    nullBindingInConfig(key);
}

function restoreBinding(key) {
    var entry = getMwEntry(key);
    if (!entry || !entry.bindKeys) return;
    var source = null;
    if (currentConfig.multiWidgetMode && _savedFullBindings) {
        source = _savedFullBindings;
    } else if (_savedCheckboxBindings[key]) {
        source = _savedCheckboxBindings[key];
    }
    if (source) {
        restoreBindingFromSource(key, source);
        delete _savedCheckboxBindings[key];
    }
}

function nullBindingInConfig(key) {
    var entry = getMwEntry(key);
    if (!entry || !entry.bindKeys) return;
    entry.bindKeys.forEach(function(k) {
        if (k === 'gearButtons' || k === 'handbrakeButtons' || k === 'gearButtonsDeviceIds' || k === 'handbrakeButtonsDeviceIds') {
            currentConfig[k] = Array.isArray(currentConfig[k]) ? currentConfig[k].map(function() { return -1; }) : currentConfig[k];
        } else if (k === 'showWheelUdp' || k === 'showGearUdp' || k === 'showHandbrakeUdp' || k === 'showPedalsInUdp') {
            currentConfig[k] = false;
        } else {
            currentConfig[k] = null;
        }
    });
    // Для педалей с общим UDP
    if (key === 'th' || key === 'br' || key === 'cl') {
        _pedalUdpBlock[key] = true;
    }
}

function restoreBindingFromSource(key, source) {
    var entry = getMwEntry(key);
    if (!entry || !entry.bindKeys || !source) return;
    entry.bindKeys.forEach(function(k) {
        currentConfig[k] = JSON.parse(JSON.stringify(source[k]));
    });
    if (key === 'th' || key === 'br' || key === 'cl') {
        _pedalUdpBlock[key] = false;
    }
}

function copyBindingFromConfigToSource(key, source) {
    var entry = getMwEntry(key);
    if (!entry || !entry.bindKeys) return;
    entry.bindKeys.forEach(function(k) {
        source[k] = JSON.parse(JSON.stringify(currentConfig[k]));
    });
}

// --- Slot mask helpers ---

function slotToHideKeys(slot) {
    if (!slot) return [];
    var hidden = [];
    // slot — объект вида { Wheel: bool, Throttle: bool, ... }
    var mapping = { Wheel: 'wh', Throttle: 'th', Brake: 'br', Clutch: 'cl',
        Handbrake: 'hb', Gear: 'gb', Gmeter: 'gm', Graphs: 'gr', Background: 'bg' };
    for (var prop in mapping) {
        if (slot[prop] === false) hidden.push(mapping[prop]);
    }
    return hidden;
}

function applySlotToConfig(slotIndex) {
    if (!_savedFullBindings) return;
    if (slotIndex < 0 || slotIndex >= _multiWidgetSlots.length) return;

    // Сначала восстанавливаем все бинды из сейва
    restoreAllBindingsFromSave();

    // Затем null'им то, что скрыто в слоте
    var hidden = slotToHideKeys(_multiWidgetSlots[slotIndex]);
    hidden.forEach(function(key) {
        nullBindingInConfig(key);
        var entry = getMwEntry(key);
        if (!entry || entry.bindKeys !== null) {
            // hideXxx для элементов без биндов
            if (entry && entry.hideKey) currentConfig[entry.hideKey] = true;
        }
    });
    // Для элементов, КОТОРЫЕ НЕ в hidden, сбрасываем hideXxx
    MW_ENTRIES.forEach(function(entry) {
        if (entry.hideKey && hidden.indexOf(entry.key) === -1) {
            currentConfig[entry.hideKey] = false;
        }
    });
}

function restoreAllBindingsFromSave() {
    if (!_savedFullBindings) return;
    MW_ENTRIES.forEach(function(entry) {
        if (entry.bindKeys) {
            entry.bindKeys.forEach(function(k) {
                currentConfig[k] = JSON.parse(JSON.stringify(_savedFullBindings[k]));
            });
        }
    });
    _pedalUdpBlock = { throttle: false, brake: false, clutch: false };
}

// --- Slot save ---

function currentConfigToSlot() {
    var slot = {};
    MW_ENTRIES.forEach(function(entry) {
        var checked = true;
        if (entry.bindKeys) {
            // Элемент с биндами — проверяем, не null'нуты ли бинды
            var keyName = entry.key.charAt(0).toUpperCase() + entry.key.slice(1);
            // Маппим shortcode → slot property name
            var propName = { wh:'Wheel', th:'Throttle', br:'Brake', cl:'Clutch',
                hb:'Handbrake', gb:'Gear', gm:'Gmeter', gr:'Graphs', bg:'Background' }[entry.key] || entry.key;
            if (propName === 'Gmeter' || propName === 'Graphs' || propName === 'Background') {
                checked = !currentConfig[entry.hideKey];
            } else {
                // По умолчанию visible если не null'нуты
                checked = !isBindingNulled(entry.key);
            }
        } else {
            checked = !currentConfig[entry.hideKey];
        }
        var propName = { wh:'Wheel', th:'Throttle', br:'Brake', cl:'Clutch',
            hb:'Handbrake', gb:'Gear', gm:'Gmeter', gr:'Graphs', bg:'Background' }[entry.key] || entry.key;
        slot[propName] = checked;
    });
    return slot;
}

function isBindingNulled(key) {
    var entry = getMwEntry(key);
    if (!entry || !entry.bindKeys) return false;
    for (var i = 0; i < entry.bindKeys.length; i++) {
        var k = entry.bindKeys[i];
        var val = currentConfig[k];
        if (k === 'gearButtons' || k === 'handbrakeButtons' || k === 'gearButtonsDeviceIds' || k === 'handbrakeButtonsDeviceIds') {
            if (Array.isArray(val) && val.some(function(v) { return v !== -1 && v !== null; })) return false;
        } else if (k === 'showWheelUdp' || k === 'showGearUdp' || k === 'showHandbrakeUdp') {
            if (val) return false;
        } else {
            if (val !== null && val !== undefined) return false;
        }
    }
    return true;
}

function hideInCurrentSlot(key, hide) {
    if (_multiWidgetSlots.length === 0) return;
    var propName = { wh:'Wheel', th:'Throttle', br:'Brake', cl:'Clutch',
        hb:'Handbrake', gb:'Gear', gm:'Gmeter', gr:'Graphs', bg:'Background' }[key];
    if (!propName) return;
    _multiWidgetSlots[_multiWidgetActiveSlot][propName] = !hide;
}

// ==========================================
// 3. ВКЛАДКИ (слоты)
// ==========================================

function makeDefaultSlot() {
    return { Wheel:true, Throttle:true, Brake:true, Clutch:true,
        Handbrake:true, Gear:true, Gmeter:true, Graphs:true, Background:true };
}

function enableMultiWidget(slots, activeSlot) {
    // Снапшот конфига для восстановления
    _savedFullBindings = JSON.parse(JSON.stringify(currentConfig));
    _pedalUdpBlock = { throttle: false, brake: false, clutch: false };

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

    applySlotToConfig(_multiWidgetActiveSlot);
    renderMultiWidgetTabs();
    updateCopyBtnText();
    syncPanelCheckboxes();
    broadcastMwState();
}

function disableMultiWidget() {
    if (_savedFullBindings) {
        restoreAllBindingsFromSave();
        // hideXxx — сброс
        MW_ENTRIES.forEach(function(entry) {
            if (entry.hideKey) currentConfig[entry.hideKey] = false;
        });
    }

    _multiWidgetSlots = [];
    _multiWidgetActiveSlot = 0;
    _savedFullBindings = null;
    _pedalUdpBlock = { throttle: false, brake: false, clutch: false };

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

    // Сохранить текущий слот
    _multiWidgetSlots[_multiWidgetActiveSlot] = currentConfigToSlot();
    _multiWidgetActiveSlot = slot;

    applySlotToConfig(slot);
    renderMultiWidgetTabs();
    updateCopyBtnText();
    sendMultiWidgetState();
    broadcastMwState();
}

function addMultiWidgetSlot() {
    if (_multiWidgetSlots.length >= 6) return;

    // Новый слот — инвертируем hide-флаги предыдущего
    var prev = _multiWidgetSlots[_multiWidgetSlots.length - 1] || makeDefaultSlot();
    var newSlot = {};
    for (var prop in prev) {
        newSlot[prop] = !prev[prop];
    }
    _multiWidgetSlots.push(newSlot);
    _multiWidgetActiveSlot = _multiWidgetSlots.length - 1;

    applySlotToConfig(_multiWidgetActiveSlot);
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
    applySlotToConfig(_multiWidgetActiveSlot);
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
    applySlotToConfig(_multiWidgetActiveSlot);
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
// 4. ВИДИМОСТЬ — только для gm/gr/bg
// ==========================================

function isVisible(name) {
    if (name === 'gb' && typeof URL_HIDE_GEAR !== 'undefined' && URL_HIDE_GEAR) return false;
    var configKey = null;
    MW_ENTRIES.forEach(function(e) {
        if (e.key === name && e.hideKey) configKey = e.hideKey;
    });
    if (configKey) return !currentConfig[configKey];
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
            var slot = _multiWidgetSlots[_multiWidgetActiveSlot];
            if (slot) {
                var propName = { wh:'Wheel', th:'Throttle', br:'Brake', cl:'Clutch',
                    hb:'Handbrake', gb:'Gear', gm:'Gmeter', gr:'Graphs', bg:'Background' }[entry.key];
                cb.checked = propName ? !!slot[propName] : true;
            }
        } else {
            cb.checked = !currentConfig[entry.hideKey || 'hideNone'];
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
    if (key) onMwCheckboxClick(key);
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
        if (key) onMwCheckboxClick(key);
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
// 6. ИНИЦИАЛИЗАЦИЯ
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
// 7. ЭКСПОРТ
// ==========================================

window.MultiWidget = {
    init: initMultiWidget,
    enableMultiWidget: enableMultiWidget,
    disableMultiWidget: disableMultiWidget,
    isVisible: isVisible,
    syncPanelCheckboxes: syncPanelCheckboxes,
    applyVisibilityOverlay: applyVisibilityOverlay,
    applyVisibilityPreset: applyVisibilityPreset
};

function applyVisibilityOverlay(hideArray) {
    // Совместимость: напрямую null'им бинды
    if (hideArray === null) {
        MW_ENTRIES.forEach(function(entry) { if (entry.bindKeys) restoreBindingFromSource(entry.key, _savedFullBindings || currentConfig); });
        return;
    }
    hideArray.forEach(function(key) {
        nullBindingInConfig(key);
    });
    applyConfig();
}

function applyVisibilityPreset(hideMap) {
    if (!hideMap) return;
    for (var key in hideMap) {
        if (hideMap[key]) nullBindingInConfig(key);
        else restoreBindingFromSource(key, _savedFullBindings || currentConfig);
    }
    applyConfig();
}

function applyConfig() { if (typeof window.applyConfig === 'function') window.applyConfig(); }
