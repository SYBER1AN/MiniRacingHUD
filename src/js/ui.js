// ==========================================
// 1. МАСШТАБИРОВАНИЕ И РАСЧЕТ РАЗМЕРОВ
// ==========================================

/** Применяет масштаб через CSS переменную */
function setVisualScale(scale) {
    document.documentElement.style.setProperty('--scale-factor', scale / window.devicePixelRatio);
}

/** Обновляет текстовое отображение размера виджета */
function updateWidgetSizeDisplay() {
    const sizeEl = document.getElementById('widgetSize');
    if (!sizeEl) return;
    sizeEl.textContent = cachedWidgetSize;
    if (!sizeEl.classList.contains('copy-initialized')) {
        copyToClipboard(sizeEl, cachedWidgetSize);
    }
}

/** Рассчитывает физические размеры виджета в пикселях */
function calculateWidgetSizes() {
    // === 1. БАЗОВЫЕ ПАРАМЕТРЫ ===
    const dpr = window.devicePixelRatio;
    const baseScale = currentConfig.scale || 1.0;
    const scale = baseScale / dpr;

    // === 2. ПРОВЕРКИ ВИДИМОСТИ КОМПОНЕНТОВ ===
    const hasWheelGamepad = currentConfig.wheelAxis !== null;
    const hasWheelUdp = hasUdpWheel();
    let showWheel = isVisible('wh') && (hasWheelUdp || hasWheelGamepad);

    const hasGearButtons = currentConfig.gearButtons && currentConfig.gearButtons.some(b => b !== -1);
    let showGear = isVisible('gb') && (hasUdpGear() || hasGearButtons);

    const wheelHasSource = hasWheelUdp || hasWheelGamepad;
    let showAssembly = (isVisible('wh') && wheelHasSource) || (isVisible('gb') && (hasUdpGear() || hasGearButtons) && !currentConfig.gearIndependent);
    let isGearIndependent = isVisible('gb') && currentConfig.gearIndependent && (hasGearButtons || hasUdpGear());
    let showGmeterIndependent = currentConfig.useUdpTelemetry && currentConfig.showGmeter && udpState.connected && window.MultiWidget.isVisible('gm');

    // === 3. ПОДСЧЁТ ВИДИМЫХ ПЕДАЛЕЙ ===
    var pedalVisName = { throttle:'th', brake:'br', clutch:'cl', handbrake:'hb' };
    let visiblePedals = PEDAL_TYPES.filter(type => {
        if (type === 'handbrake') {
            return isVisible('hb') && (currentConfig.handbrakeAxis !== null
                || currentConfig.handbrakeButtons.some(btn => btn !== -1)
                || (currentConfig.useUdpTelemetry && currentConfig.showHandbrakeUdp && udpState.connected));
        }
        if (hasUdpPedals()) return isVisible(pedalVisName[type]);
        return isVisible(pedalVisName[type]) && currentConfig[`${type}Axis`] !== null;
    }).length;

    // === GRAPHS-ONLY MODE: принудительно скрываем весь виджет ===
    const isGraphsOnly = currentConfig.graphsOnly;
    if (isGraphsOnly) {
        showWheel = false;
        showGear = false;
        showAssembly = false;
        isGearIndependent = false;
        showGmeterIndependent = false;
        visiblePedals = 0;
    }

    // === 4. ПРОВЕРКА АКТИВНЫХ ГРАФИКОВ ===
    const anyGraphActive = isVisible('gr') && Object.entries(AXIS_CONFIG_MAP).some(([key, cfg]) => currentConfig[cfg.graphKey]);

    // === 5. БАЗОВЫЕ РАЗМЕРЫ ИЗ КЭША ===
    const baseWheelSize = DOM.cssBaseValues.wheelSize;
    const basePedalWidth = currentConfig.showPedalLabels
        ? DOM.cssBaseValues.pedalWidth
        : DOM.cssBaseValues.pedalWidthCompact;
    const baseGap = DOM.cssBaseValues.widgetGap;
    const pedalGap = DOM.cssBaseValues.pedalGap;
    const basePadding = DOM.cssBaseValues.widgetPadding;
    const baseGraphBlockWidth = DOM.cssBaseValues.graphWidth;
    const baseHeight = DOM.cssBaseValues.widgetHeight;

    // === 6. РАСЧЁТ ШИРИН КОМПОНЕНТОВ ===
    const wheelWidth = showAssembly ? baseWheelSize * scale : 0;
    const gearOrGmeterIndependent = isGearIndependent || showGmeterIndependent;
    const gearOrGmeterWidth = gearOrGmeterIndependent ? baseWheelSize * scale : 0;
    const pedalsWidth = visiblePedals > 0
        ? (visiblePedals * basePedalWidth * scale) + ((visiblePedals - 1) * pedalGap * scale)
        : 0;
    const graphInWidget = anyGraphActive && !currentConfig.graphIndependent && !currentConfig.graphsOnly;
    const graphWidth = graphInWidget ? baseGraphBlockWidth * scale : 0;
    const graphIndependentActive = anyGraphActive && (currentConfig.graphIndependent || currentConfig.graphsOnly);
    const graphIndependentWidth = graphIndependentActive ? DOM.cssBaseValues.graphWidthIndependent * scale : 0;
    const graphIndependentGap = graphIndependentActive ? (currentConfig.graphsOnly ? 0 : 16) : 0;

    // === 7. РАСЧЁТ ОТСТУПОВ ===
    // Учитываем только те компоненты, что реально в виджете
    const visibleComponents = [
        showAssembly,
        gearOrGmeterIndependent,
        visiblePedals > 0,
        graphInWidget
    ].filter(Boolean).length;
    const gapCount = Math.max(0, visibleComponents - 1);
    const totalGapWidth = gapCount * baseGap * scale;

    // === 8. РАСЧЁТ PADDING ===
    // Правый padding убираем только когда график встроен в виджет
    const totalPadding = graphInWidget
        ? basePadding * scale  // только левый padding
        : 2 * basePadding * scale;  // левый + правый

    // === 9. ИТОГОВЫЕ РАЗМЕРЫ ===
    const widgetHeightCss = baseHeight * scale;
    const widgetWidthCss = wheelWidth + gearOrGmeterWidth + pedalsWidth + graphWidth + totalGapWidth + totalPadding;
    const totalWidthPhysical = (widgetWidthCss + graphIndependentWidth + graphIndependentGap) * dpr;

    // === 10. ВОЗВРАТ РЕЗУЛЬТАТА ===
    return {
        scale,
        widgetHeight: widgetHeightCss,
        widgetWidth: widgetWidthCss,
        totalWidthPhysical,
        pedalsWidth: pedalsWidth,
        widgetHeightPhysical: widgetHeightCss * dpr,
        widgetWidthPhysical: widgetWidthCss * dpr,
        showAssembly,
        visiblePedals,
        anyGraphActive,
        isGearIndependent,
        isDualWheelStyle: gearOrGmeterIndependent,
        hasGearButtons: hasGearButtons || hasUdpGear(),
        showGmeter: showGmeterIndependent
    };
}

/** Применяет ширину и отступы ко всем контейнерам педалей */
function applyPedalLayout(sizes) {
    const pedalContainers = Array.from(document.querySelectorAll('.pedal-container'));
    const basePedalWidth = currentConfig.showPedalLabels
        ? DOM.cssBaseValues.pedalWidth
        : DOM.cssBaseValues.pedalWidthCompact;
    const pixelWidth = basePedalWidth * sizes.scale;
    const gapPx = DOM.cssBaseValues.pedalGap * sizes.scale;

    // Сброс отступов ряда
    if (DOM.pedalsRow) {
        DOM.pedalsRow.style.marginLeft = '0px';
        DOM.pedalsRow.style.marginRight = '0px';
    }

    // Сброс отступов руля
    if (DOM.wheelAssembly) {
        DOM.wheelAssembly.style.marginLeft = '0px';
        DOM.wheelAssembly.style.marginRight = '0px';
    }

    // Ширина и отступы педалей
    pedalContainers.forEach((container, index) => {
        const isVisible = container.classList.contains('visible');

        if (isVisible) {
            container.style.width = `${pixelWidth}px`;
            container.style.flexBasis = `${pixelWidth}px`;
            // Отступ только между видимыми педалями
            const visiblePedals = pedalContainers.filter(c => c.classList.contains('visible'));
            const visibleIndex = visiblePedals.indexOf(container);
            container.style.marginRight = visibleIndex < visiblePedals.length - 1 ? `${gapPx}px` : '0';
        } else {
            container.style.width = '';
            container.style.flexBasis = '';
            container.style.marginRight = '0';
        }
    });
}

/** Обновляет позицию и видимость блока графика */
function updateGraphLayout(sizes) {
    if (!DOM.graphCanvas) return;

    const isIndependent = currentConfig.graphIndependent || currentConfig.graphsOnly;

    if (isIndependent) {
        DOM.graphCanvas.style.width = '0';
        DOM.graphCanvas.style.height = '0';
        DOM.graphCanvas.classList.add('hiding');
        DOM.graphCanvas.classList.remove('active');
        DOM.graphContainer?.classList.toggle('visible', sizes.anyGraphActive);
    } else {
        if (DOM.graphContainer) {
            DOM.graphContainer.style.width = '';
            DOM.graphContainer.style.height = '';
        }

        if (sizes.anyGraphActive) {
            DOM.graphCanvas.style.width = `var(--graph-width)`;
            DOM.graphCanvas.style.height = `${sizes.widgetHeight}px`;
            DOM.graphCanvas.width = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--graph-width')) * window.devicePixelRatio;
            DOM.graphCanvas.height = sizes.widgetHeight * window.devicePixelRatio;
            DOM.graphCanvas.classList.remove('hiding');
            DOM.graphCanvas.classList.add('active');
        } else {
            DOM.graphCanvas.style.width = '0';
            DOM.graphCanvas.style.height = '0';
            DOM.graphCanvas.classList.remove('active');
            DOM.graphCanvas.classList.add('hiding');
        }
    }
}

var _lastWidgetSizes = null;

/** Рассчитывает border-radius по видимым круглым элементам */
function calculateBorderRadius(sizes) {
    if (currentConfig.noCornerRounding) {
        DOM.hudContainerWrapper.style.borderRadius = 'var(--widget-radius)';
        return;
    }

    const widgetWheelRadius = sizes.widgetHeight / 2;

    const wheelVisible = sizes.showAssembly;
    const gearOrGmeterVisible = sizes.showGmeter || sizes.isGearIndependent;
    const pedalsVisible = sizes.visiblePedals > 0;
    const hasGraph = sizes.anyGraphActive;
    const isReverse = currentConfig.layoutReverse;

    // Визуальная последовательность элементов (без графика)
    const sequence = isReverse
        ? [{ visible: gearOrGmeterVisible, round: true }, { visible: pedalsVisible, round: false }, { visible: wheelVisible, round: true }]
        : [{ visible: wheelVisible, round: true }, { visible: pedalsVisible, round: false }, { visible: gearOrGmeterVisible, round: true }];

    const visible = sequence.filter(el => el.visible);

    let leftRound = false;
    let rightRound = false;

    if (visible.length > 0) {
        leftRound = visible[0].round;
        rightRound = !hasGraph && visible[visible.length - 1].round;
    }

    const round = `${widgetWheelRadius}px`;
    const small = 'var(--widget-radius)';
    let tl = small, tr = small, br = small, bl = small;
    if (leftRound) { tl = round; bl = round; }
    if (rightRound) { tr = round; br = round; }
    // С открытой таблицей верхние углы не «пилюльные» — иначе она режется
    if (typeof isTvdActive === 'function' && isTvdActive()) { tl = small; tr = small; }

    DOM.hudContainerWrapper.style.borderRadius = `${tl} ${tr} ${br} ${bl}`;
    return widgetWheelRadius;
}

/** Обновляет размер индикатора передачи и G-meter */
function updateGearDisplaySize(sizes) {
    if (!DOM.gearDisplay) return;
    updateGearScaleFactor();
    const hasGearButtons = currentConfig.gearButtons && currentConfig.gearButtons.some(b => b !== -1);
    const wheelAssigned = currentConfig.wheelAxis !== null || (currentConfig.useUdpTelemetry && currentConfig.showWheelUdp);

    if ((!hasGearButtons && !hasUdpGear() && !wheelAssigned) || (!wheelAssigned && !isVisible('gb'))) {
        DOM.gearDisplay.style.width = '0';
        DOM.gearDisplay.style.minWidth = '0';
        DOM.gearDisplay.style.height = '0';
        DOM.gearDisplay.style.borderWidth = '0';
        if (DOM.gearDisplayIndependent) {
            DOM.gearDisplayIndependent.style.width = '0';
            DOM.gearDisplayIndependent.style.minWidth = '0';
            DOM.gearDisplayIndependent.style.height = '0';
            DOM.gearDisplayIndependent.style.borderWidth = '0';
        }
    }
    else {
        // На-рульный КПП: CSS-переменные (реагирует на --gear-scale-factor)
        const hasGearSource = (hasGearButtons || hasUdpGear()) && isVisible('gb');
        const isGearInd = currentConfig.gearIndependent && wheelAssigned && hasGearSource;
        const gearScale = (hasGearSource && !isGearInd) ? (currentConfig.gearScale || 1.0) : 1.0;
        const gearSizePx = DOM.cssBaseValues.gearDisplaySize * sizes.scale * gearScale;
        const gearFontSize = DOM.cssBaseValues.gearFontSize * sizes.scale * gearScale;
        DOM.gearDisplay.style.width = `${gearSizePx}px`;
        DOM.gearDisplay.style.height = `${gearSizePx}px`;
        DOM.gearDisplay.style.fontSize = `${gearFontSize}px`;
        DOM.gearDisplay.style.borderWidth = `calc(var(--marker-width) / 4)`;
        DOM.gearDisplay.style.flexBasis = 'auto';

        // Отдельный КПП: фиксированный размер руля (НЕ реагирует на ползунок)
        if (DOM.gearDisplayIndependent) {
            const gearSizePx = DOM.cssBaseValues.wheelSize * sizes.scale;
            const gearFontSize = DOM.cssBaseValues.gearFontSize * sizes.scale * 2.5;
            const markerWidth = DOM.cssBaseValues.markerWidth * sizes.scale / 2;

            DOM.gearDisplayIndependent.style.width = `${gearSizePx}px`;
            DOM.gearDisplayIndependent.style.height = `${gearSizePx}px`;
            DOM.gearDisplayIndependent.style.fontSize = `${gearFontSize}px`;
            DOM.gearDisplayIndependent.style.borderWidth = `${markerWidth}px`;
            DOM.gearDisplayIndependent.style.flexBasis = `${gearSizePx}px`;
        }
    }

    // G-meter sizing
    if (DOM.gmeterDisplay) {
        const gmeterSizePx = DOM.cssBaseValues.wheelSize * sizes.scale;
        const markerWidth = DOM.cssBaseValues.markerWidth * sizes.scale / 2;
        DOM.gmeterDisplay.style.borderWidth = `${markerWidth}px`;

        // Cache dimensions for g-meter (avoids forced layout at high freq)
        gmeterCache.width = gmeterSizePx - markerWidth * 2;
        gmeterCache.ballSize = DOM.cssBaseValues?.gmeterBallSize || 0.2;

        // Canvas trail resize
        if (DOM.gmeterTrail) {
            const dpr = window.devicePixelRatio || 1;
            const w = gmeterSizePx;
            const h = gmeterSizePx;
            DOM.gmeterTrail.width = Math.round(w * dpr);
            DOM.gmeterTrail.height = Math.round(h * dpr);
            DOM.gmeterTrail.style.width = `${w}px`;
            DOM.gmeterTrail.style.height = `${h}px`;
        }
    }
}

/** Главная функция обновления геометрии виджета */
function updateWidgetDimensions() {
    updateCssBaseValuesCache();
    const sizes = calculateWidgetSizes();
    _lastWidgetSizes = sizes;

    // Кэшируем размер для отображения и копирования
    cachedWidgetSize = `${Math.round(sizes.totalWidthPhysical)}×${Math.round(sizes.widgetHeightPhysical)}`;

    // Применяем размеры контейнера
    DOM.hudContainer.style.height = `${sizes.widgetHeight}px`;
    DOM.hudContainer.style.width = `${sizes.widgetWidth}px`;

    // Высота main-wrapper под максимальный масштаб (только когда панель настроек видна)
    if (window.innerHeight > 770) {
        const maxScale = parseFloat(document.getElementById('scaleSlider')?.max) || 3.0;
        const maxWidgetHeight = DOM.cssBaseValues.widgetHeight * maxScale / window.devicePixelRatio + 20;
        const mw = document.querySelector('.main-wrapper');
        if (mw) mw.style.height = `${maxWidgetHeight}px`;
    }

    const basePadding = getCssBaseValue('widget-padding');
    const scaledPadding = basePadding * sizes.scale;
    const graphInWidget = sizes.anyGraphActive && !currentConfig.graphIndependent && !currentConfig.graphsOnly;
    if (graphInWidget && !currentConfig.layoutReverse) {
        // Когда график встроен в виджет и в обычном порядке: убираем правый padding (график справа)
        DOM.hudContainer.style.padding = `${scaledPadding}px 0 ${scaledPadding}px ${scaledPadding}px`;
    } else {
        // Когда графика нет, он отдельный или порядок обратный: обычный padding со всех сторон
        DOM.hudContainer.style.padding = `${scaledPadding}px`;
    }

    // База для выезжающей таблицы TVD: высота и верхний отступ без неё
    DOM.hudContainer.dataset.baseHeight = `${sizes.widgetHeight}`;
    DOM.hudContainer.dataset.basePadTop = `${scaledPadding}`;
    applyTvdOffset();

    // Педали
    if (DOM.pedalsRow) {
        DOM.pedalsRow.style.display = sizes.visiblePedals > 0 ? 'flex' : 'none';
    }

    // Руль
    if (DOM.wheelAssembly) {
        if (sizes.showAssembly) {
            DOM.wheelAssembly.style.width = `var(--wheel-size)`;
            DOM.wheelAssembly.style.height = `var(--wheel-size)`;
        } else {
            DOM.wheelAssembly.style.width = '0';
            DOM.wheelAssembly.style.height = '0';
        }
    }

    // Параметры свечения
    window.glowParams = { blur: getCssBaseValue('glow-blur') * sizes.scale };
    if (sizes.anyGraphActive) {
        GraphManager.debouncedRender();
    }
    applyPedalLayout(sizes);
    updateGraphLayout(sizes);
    calculateBorderRadius(sizes);
    updateGearDisplaySize(sizes);
    setTimeout(updateWidgetSizeDisplay, 50);
}

/** Обновляет общее расположение элементов (порядок, видимость) */
function updateWidgetLayout() {
    if (DOM.pedalsRow) {
        DOM.pedalsRow.classList.toggle('layout-reverse', currentConfig.layoutReverse);
    }
    updateGearPosition();
    updateWidgetOrder();
    updateWidgetDimensions();
}

/** Устанавливает order для элементов в зависимости от layoutReverse */
function updateWidgetOrder() {
    const reverse = currentConfig.layoutReverse;

    if (reverse) {
        if (DOM.gearDisplayIndependent) DOM.gearDisplayIndependent.style.order = '0';
        if (DOM.gmeterDisplay) DOM.gmeterDisplay.style.order = '0';
        if (DOM.pedalsRow) DOM.pedalsRow.style.order = '1';
        if (DOM.wheelAssembly) DOM.wheelAssembly.style.order = '3';
        if (DOM.graphBlock) DOM.graphBlock.style.order = '99';
    } else {
        if (DOM.wheelAssembly) DOM.wheelAssembly.style.order = '0';
        if (DOM.pedalsRow) DOM.pedalsRow.style.order = '1';
        if (DOM.gearDisplayIndependent) DOM.gearDisplayIndependent.style.order = '';
        if (DOM.gmeterDisplay) DOM.gmeterDisplay.style.order = '';
        if (DOM.graphBlock) DOM.graphBlock.style.order = '99';
    }
}

// ==========================================
// 2. G-METER TRAIL
// ==========================================
function catmullRom(p0, p1, p2, p3, t, out) {
    const t2 = t * t;
    const t3 = t2 * t;
    out.x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    out.y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
}

function gmeterPoint(lat, lon, cx, cy, maxOffset, maxG, out) {
    let clampedLat = Math.max(-maxG, Math.min(maxG, lat));
    let clampedLon = Math.max(-maxG, Math.min(maxG, lon));
    const magnitude = Math.sqrt(clampedLat ** 2 + clampedLon ** 2);
    if (magnitude > maxG) {
        clampedLat *= maxG / magnitude;
        clampedLon *= maxG / magnitude;
    }
    out.x = cx + (clampedLat / maxG) * maxOffset;
    out.y = cy + (clampedLon / maxG) * maxOffset;
}

function renderGmeterTrail() {
    if (!DOM.gmeterTrail || !DOM.gmeterDisplay) return;
    if (!currentConfig.showGmeter || !udpState.connected || !isVisible('gm')) return;
    if (!currentConfig.showGmeterTrail || gmeterTrail.count < 4) return;

    const canvas = DOM.gmeterTrail;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = gmeterCache.width;
    const h = gmeterCache.width;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    const ballSize = gmeterCache.ballSize;
    const ballW = w * ballSize;
    const maxOffset = (w - ballW) / 2;
    const cx = w / 2;
    const cy = h / 2;
    const maxG = 2;

    const color = COLOR_CACHE.cssVars.gmeterTrail || '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;

    const steps = 8;
    const drawCount = gmeterTrail.count;
    const _pt = { x: 0, y: 0 };
    const _pts = [
        { x: 0, y: 0 }, { x: 0, y: 0 },
        { x: 0, y: 0 }, { x: 0, y: 0 }
    ];
    const gLat = gmeterTrail.lat;
    const gLon = gmeterTrail.lon;
    const maxIdx = gmeterTrail.count;
    const startIdx = Math.max(0, maxIdx - drawCount);

    const trailIdx = (i) => (GMETER_TRAIL_SIZE - gmeterTrail.count + gmeterTrail.idx + i) % GMETER_TRAIL_SIZE;

    for (let j = startIdx; j < maxIdx - 3; j++) {
        gmeterPoint(gLat[trailIdx(j)], gLon[trailIdx(j)], cx, cy, maxOffset, maxG, _pts[0]);
        gmeterPoint(gLat[trailIdx(j + 1)], gLon[trailIdx(j + 1)], cx, cy, maxOffset, maxG, _pts[1]);
        gmeterPoint(gLat[trailIdx(j + 2)], gLon[trailIdx(j + 2)], cx, cy, maxOffset, maxG, _pts[2]);
        gmeterPoint(gLat[trailIdx(j + 3)], gLon[trailIdx(j + 3)], cx, cy, maxOffset, maxG, _pts[3]);

        const t = (j - startIdx) / (maxIdx - startIdx - 3);
        ctx.globalAlpha = t * t * t;

        ctx.beginPath();
        catmullRom(_pts[0], _pts[1], _pts[2], _pts[3], 0, _pt);
        ctx.moveTo(_pt.x, _pt.y);
        for (let s = 1; s <= steps; s++) {
            catmullRom(_pts[0], _pts[1], _pts[2], _pts[3], s / steps, _pt);
            ctx.lineTo(_pt.x, _pt.y);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
}

// ==========================================
// 3. МЕНЕДЖЕР ГРАФИКОВ
// ==========================================
const GraphManager = {
    renderTimeout: null,
    needsRender: false,

    /** Рендер графика на указанный канвас */
    renderToCanvas(canvas, targetWidth, targetHeight, timeWindow = 0, dataWindow = HISTORY_SIZE) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        const currentDpr = window.devicePixelRatio;
        ctx.scale(currentDpr, currentDpr);

        const w = targetWidth;
        const h = targetHeight;

        const graphBg = COLOR_CACHE.cssVars.widgetBg || '#0c1a1f';
        const bgOpacity = isVisible('bg') ? (currentConfig.widgetBgOpacity ?? 1.0) : 0;
        const graphGrid = applyAlpha(COLOR_CACHE.cssVars.graphGrid || '#142a39', bgOpacity);
        const graphText = applyAlpha(COLOR_CACHE.cssVars.graphText || '#ffffff', bgOpacity);
        const scale = currentConfig.scale || 1.0;

        ctx.clearRect(0, 0, w, h);

        if (timeWindow > 0) {
            // Фон канваса + сетка + текст — только для независимого графика
            ctx.fillStyle = applyAlpha(graphBg, bgOpacity);
            ctx.fillRect(0, 0, w, h);

            const segments = timeWindow;
            ctx.strokeStyle = graphGrid;
            ctx.lineWidth = 0.5 * scale;
            ctx.beginPath();
            for (let y = h / 2; y < h; y += h / 2) {
                ctx.moveTo(0, y); ctx.lineTo(w, y);
            }
            for (let x = w / segments; x < w; x += w / segments) {
                ctx.moveTo(x, 0); ctx.lineTo(x, h);
            }
            ctx.stroke();

            ctx.fillStyle = graphText;
            ctx.font = `${6 * scale}px monospace`;
            ctx.textBaseline = 'bottom';
            for (let i = 0; i <= segments; i++) {
                ctx.fillText(`${(segments - i)}s`, i * w / segments + 4 * scale, h - 4 * scale);
            }
        }

        const graphColors = {
            wheel: COLOR_CACHE.cssVars.wheelMarker,
            handbrake: COLOR_CACHE.cssVars.pedalHandbrake,
            clutch: COLOR_CACHE.cssVars.pedalClutch,
            brake: COLOR_CACHE.cssVars.pedalBrake,
            throttle: COLOR_CACHE.cssVars.pedalThrottle
        };

        ['wheel', 'clutch', 'brake', 'throttle', 'handbrake'].forEach((key) => {
            const configKey = `show${key.charAt(0).toUpperCase() + key.slice(1)}Graph`;
            if (!currentConfig[configKey]) return;

            const data = pedalHistory[key] || Array(HISTORY_SIZE).fill(0);
            const idx = pedalHistory.index;
            const endIdx = (idx + HISTORY_SIZE) % HISTORY_SIZE;
            const startIdx = (endIdx - dataWindow + HISTORY_SIZE) % HISTORY_SIZE;

            ctx.strokeStyle = graphColors[key];
            ctx.lineWidth = 1.0 * scale;
            ctx.beginPath();
            let count = 0;
            let i = startIdx;
            while (count < dataWindow) {
                const x = count * w / (dataWindow - 1);
                const y = h - (data[i] / 100) * h;
                if (count === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                i = (i + 1) % HISTORY_SIZE;
                count++;
            }
            ctx.stroke();
        });
    },

    /** Отрисовка графика на Canvas */
    render() {
        getCssBaseValueCached();

        this.needsRender = false;
        const isIndependent = currentConfig.graphIndependent || currentConfig.graphsOnly;
        const canvas = isIndependent ? DOM.graphCanvasIndependent : DOM.graphCanvas;
        if (!canvas) return;

        const scale = currentConfig.scale || 1.0;

        if (isIndependent) {
            const container = DOM.graphContainer;
            const rect = container?.getBoundingClientRect();
            const targetWidth = rect?.width || DOM.cssBaseValues.graphWidthIndependent;
            const targetHeight = rect?.height || DOM.cssBaseValues.widgetHeight;
            canvas.style.width = `${targetWidth}px`;
            canvas.style.height = `${targetHeight}px`;
            const dpr = window.devicePixelRatio;
            if (Math.abs(canvas.width - targetWidth * dpr) > 1 || Math.abs(canvas.height - targetHeight * dpr) > 1) {
                canvas.width = targetWidth * dpr;
                canvas.height = targetHeight * dpr;
            }
            this.renderToCanvas(canvas, targetWidth, targetHeight, 3, HISTORY_SIZE);
        } else {
            const baseGraphWidth = DOM.cssBaseValues.graphWidth / window.devicePixelRatio;
            const targetWidth = baseGraphWidth * scale;
            const targetHeight = parseFloat(DOM.hudContainer.style.height) || canvas.offsetHeight;

            canvas.style.width = `${targetWidth}px`;
            canvas.style.height = `${targetHeight}px`;

            const dpr = window.devicePixelRatio;
            if (Math.abs(canvas.width - targetWidth * dpr) > 1 || Math.abs(canvas.height - targetHeight * dpr) > 1) {
                canvas.width = targetWidth * dpr;
                canvas.height = targetHeight * dpr;
            }
            this.renderToCanvas(canvas, targetWidth, targetHeight, false, 180);
        }
    },

    /** Запрос на перерисовку с debounce */
    requestRender() {
        if (this.renderTimeout) return;
        this.renderTimeout = setTimeout(() => {
            this.renderTimeout = null;
            if (this.needsRender) this.render();
        }, 100);
    },

    /** Переключение видимости графика для конкретной оси */
    toggle(btn, configKey) {
        if (btn.classList.contains('inactive')) return;
        const isActive = btn.classList.toggle('active');
        currentConfig[configKey] = isActive;

        if (!isActive) {
            const historyKey = configKey.replace('show', '').replace('Graph', '').toLowerCase();
            this.clear(historyKey);
        }
        this.updateVisibility();
        updateAllToggleStates();
        updateWidgetLayout();
        this.requestRender();
    },

    /** Обновление состояния кнопок графиков (активна/неактивна) */
    updateButtonsState() {
        Object.entries(AXIS_CONFIG_MAP).forEach(([type, cfg]) => {
            const btn = document.getElementById(cfg.graphBtn.replace('Btn', ''));
            if (!btn) return;

            const hasAxis = currentConfig[cfg.axisKey] !== null;
            const hasBtns = type === 'handbrake' && (currentConfig.handbrakeButtons?.some(b => b !== -1));

            btn.classList.toggle('inactive', !(hasAxis || hasBtns));

            if (hasAxis || hasBtns) {
                btn.classList.toggle('active', currentConfig[cfg.graphKey]);
            } else if (currentConfig[cfg.graphKey]) {
                btn.classList.remove('active');
                currentConfig[cfg.graphKey] = false;
                this.clear(type);
            }
        });
        this.updateVisibility();
    },

    /** Управление классами видимости Canvas */
    updateVisibility() {
        if (!DOM.graphCanvas) return;
        const anyActive = isVisible('gr') && (currentConfig.showWheelGraph || currentConfig.showThrottleGraph ||
            currentConfig.showBrakeGraph || currentConfig.showClutchGraph ||
            currentConfig.showHandbrakeGraph);

        const isIndependent = currentConfig.graphIndependent || currentConfig.graphsOnly;

        DOM.graphCanvas.classList.toggle('active', anyActive && !isIndependent);
        DOM.graphCanvas.classList.toggle('hiding', !anyActive || isIndependent);

        if (DOM.graphContainer) {
            DOM.graphContainer.classList.toggle('visible', anyActive && isIndependent);
        }
    },

    /** Очистка истории данных для оси */
    clear(type) {
        if (pedalHistory[type]) pedalHistory[type].fill(0);
    },

    /** Debounced вызов рендера */
    debouncedRender() {
        this.requestRender();
    },

    /** Очистка всех таймеров графика */
    cleanup() {
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
            this.renderTimeout = null;
        }
        this.needsRender = false;
    }
};

/** Преобразует hex-цвет (#RGB, #RGBA, #RRGGBB, #RRGGBBAA) в rgba со своим alpha */
function applyAlpha(hex, alpha) {
    if (!hex) return 'transparent';
    let r = 0, g = 0, b = 0;
    const clean = hex.replace('#', '');
    if (clean.length >= 6) {
        r = parseInt(clean.substring(0, 2), 16);
        g = parseInt(clean.substring(2, 4), 16);
        b = parseInt(clean.substring(4, 6), 16);
    } else if (clean.length >= 3) {
        r = parseInt(clean[0] + clean[0], 16);
        g = parseInt(clean[1] + clean[1], 16);
        b = parseInt(clean[2] + clean[2], 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ==========================================
// 4. МЕНЕДЖЕР ЦВЕТОВ (редактор)
// ==========================================
function lighten(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xFF) + Math.round(255 * percent / 100));
    const g = Math.min(255, ((num >> 8) & 0xFF) + Math.round(255 * percent / 100));
    const b = Math.min(255, (num & 0xFF) + Math.round(255 * percent / 100));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
function darken(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, ((num >> 16) & 0xFF) - Math.round(255 * percent / 100));
    const g = Math.max(0, ((num >> 8) & 0xFF) - Math.round(255 * percent / 100));
    const b = Math.max(0, (num & 0xFF) - Math.round(255 * percent / 100));
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

const CUSTOM_COLOR_MAP = {
    accent: '--accent',
    bindCont: '--bind-cont',
    pageBg: '--page-bg',
    panelBg: '--panel-bg',
    sectionBg: '--section-bg',
    elementBg: '--element-bg',
    panelCont: '--panel-cont',
    elementCont: '--element-cont',
    helpBg: '--help-bg',
    helpCont: '--help-cont',
    helpHeading: '--help-heading',
    disabledBg: '--disabled-bg',
    disabledCont: '--disabled-cont',
    border: '--border',
    lastActive: '--last-active',
    scrollbarTrack: '--scrollbar-track',
    toggleOff: '--toggle-off',
    toggleOn: '--toggle-on',
    dangerBg: '--danger-bg',
    dangerCont: '--danger-cont',
    codeBg: '--code-bg',
    codeCont: '--code-cont',
};

function getDefaultCssColors() {
    const root = document.documentElement;
    const saved = {};
    for (const [key, cssVar] of Object.entries(CUSTOM_COLOR_MAP))
        saved[key] = root.style.getPropertyValue(cssVar);
    for (const cssVar of Object.values(CUSTOM_COLOR_MAP))
        root.style.removeProperty(cssVar);
    const result = {};
    const style = getComputedStyle(root);
    for (const [key, cssVar] of Object.entries(CUSTOM_COLOR_MAP))
        result[key] = style.getPropertyValue(cssVar).trim() || null;
    for (const [key, cssVar] of Object.entries(CUSTOM_COLOR_MAP))
        if (saved[key]) root.style.setProperty(cssVar, saved[key]);
    return result;
}

const THEME_COLOR_MAP = {
    widgetBg: '--widget-bg',
    wheelRim: '--wheel-rim',
    wheelSpoke: '--wheel-spoke',
    wheelMarker: '--wheel-marker',
    gmeterMiddle: '--gmeter-middle',
    gmeterInner: '--gmeter-inner',
    gmeterOuter: '--gmeter-outer',
    gmeterBall: '--gmeter-ball',
    gmeterCrosshairDashed: '--gmeter-crosshair-dashed',
    gmeterRingsDashed: '--gmeter-rings-dashed',
    gmeterTrail: '--gmeter-trail',
    gmeterBorder: '--gmeter-border',
    gearBg: '--gear-bg',
    gearText: '--gear-text',
    gearNBg: '--gear-n-bg',
    gearNText: '--gear-n-text',
    gearRBg: '--gear-r-bg',
    gearRText: '--gear-r-text',
    pedalBg: '--pedal-bg',
    pedalHandbrake: '--pedal-handbrake',
    pedalClutch: '--pedal-clutch',
    pedalBrake: '--pedal-brake',
    pedalThrottle: '--pedal-throttle',
    pedalText: '--pedal-text',
    graphGrid: '--graph-grid',
    graphText: '--graph-text',
};

function getCurrentThemeColors() {
    const result = {};
    const root = document.documentElement;
    const style = getComputedStyle(root);
    for (const [key, cssVar] of Object.entries(THEME_COLOR_MAP))
        result[key] = style.getPropertyValue(cssVar).trim() || null;
    return result;
}

function updateWidgetBg() {
    if (!DOM.hudContainer) return;
    const bgOpacity = currentConfig.widgetBgOpacity ?? 1.0;
    const bgVisible = isVisible('bg') && bgOpacity > 0;
    DOM.hudContainer.style.background = bgVisible
        ? applyAlpha(getComputedStyle(document.documentElement).getPropertyValue('--widget-bg').trim(), bgOpacity)
        : 'transparent';
}

const ColorManager = {
    apply(colors) {
        const root = document.documentElement;
        const allKeys = { ...CUSTOM_COLOR_MAP, ...THEME_COLOR_MAP };
        Object.entries(allKeys).forEach(([key, cssVar]) => {
            if (key in colors) {
                if (colors[key]) {
                    root.style.setProperty(cssVar, '#' + colors[key].replace('#', ''));
                } else {
                    root.style.removeProperty(cssVar);
                }
                if (CSS_COLOR_KEYS[key]) {
                    COLOR_CACHE.cssVars[key] = colors[key]
                        ? '#' + colors[key].replace('#', '')
                        : getComputedStyle(root).getPropertyValue(cssVar).trim() || '';
                }
            }
        });
        if ('widgetBg' in colors) updateWidgetBg();
    }
};

// ==========================================
// 5. МЕНЕДЖЕР ТЕМ
// ==========================================
function clearAllInlineColors() {
    const root = document.documentElement;
    for (const v of Object.values(THEME_COLOR_MAP)) root.style.removeProperty(v);
}

const ThemeManager = {
    /** Применение темы */
    apply(themeKey) {
        if (themeKey === 'Light') themeKey = 'Pastel';
        var customTheme = window._customThemes && window._customThemes[themeKey];
        if (customTheme) {
            currentConfig.theme = themeKey;
            ColorManager.apply(customTheme.colors || {});
        } else if (themeKey !== 'Default' && !THEME_NAMES[themeKey]) {
            // кастомная тема недоступна локально — не меняем data-theme, цвета придут через themeColors
            return;
        } else {
            var fallback = THEME_NAMES[themeKey] ? themeKey : 'Default';
            document.documentElement.setAttribute('data-theme', fallback);
            currentConfig.theme = themeKey;
            clearAllInlineColors();
            invalidateCssCache();
            this.cacheColors();
        }
        this.applyColors();
        this.updateSelectUI();
        if (typeof sendConfigUpdate === 'function') sendConfigUpdate();
        updateWidgetLayout();
        if (typeof window._onThemeApplied === 'function' && window.isMiniRacingHUD) {
            window._onThemeApplied(themeKey);
        }
    },

    /** КэшированиеComputed стилей цветов */
    cacheColors() {
        const root = document.documentElement;
        const theme = root.getAttribute('data-theme') || 'Default';
        if (COLOR_CACHE.currentTheme === theme) return;

        COLOR_CACHE.currentTheme = theme;
        COLOR_CACHE.cssVars = {};

        Object.entries(CSS_COLOR_KEYS).forEach(([key, varName]) => {
            COLOR_CACHE.cssVars[key] = getComputedStyle(root).getPropertyValue(varName).trim() || '';
        });
    },

    /** Применение цветов к элементам DOM */
    applyColors() {
        // Педали
        PEDAL_TYPES.forEach(type => {
            const fillEl = document.getElementById(`fill-${type}`);
            if (fillEl) fillEl.style.backgroundColor = '';
            const container = document.getElementById(type);
            if (container) {
                const percent = lastValues[type] || 0;
                container.style.boxShadow = percent >= 100 ?
                    `0 0 6px 0 var(--pedal-${type})` : 'none';
            }
        });

        // Руль
        if (DOM.wheel) {
            const rim = DOM.wheel.querySelector('.wheel-rim');
            const mark = DOM.wheel.querySelector('.mark');
            const spokeHor = DOM.wheel.querySelector('.spoke-hor');
            const spokeVer = DOM.wheel.querySelector('.spoke-ver');

            if (rim) rim.style.border = '';
            if (mark) mark.style.background = '';
            if (spokeHor) spokeHor.style.background = '';
            if (spokeVer) spokeVer.style.background = '';
        }

        // Виджет
        if (DOM.hudContainer) {
            const bgOpacity = currentConfig.widgetBgOpacity ?? 1.0;
            const bgVisible = isVisible('bg') && bgOpacity > 0;
            DOM.hudContainer.style.background = bgVisible
                ? applyAlpha(getComputedStyle(document.documentElement).getPropertyValue('--widget-bg').trim(), bgOpacity)
                : 'transparent';
            DOM.hudContainer.classList.toggle('labels-hidden', !currentConfig.showPedalLabels);
        }

        // Подложка педалей
        document.querySelectorAll('.pedal-bg').forEach(el => {
            el.style.background = '';
        });

        // Скругления при отключённом фоне
        const noBg = (currentConfig.widgetBgOpacity ?? 1.0) === 0 || !isVisible('bg');
        if (DOM.hudContainerWrapper) {
            DOM.hudContainerWrapper.classList.toggle('no-bg', noBg);
        }
        if (DOM.graphContainer) {
            DOM.graphContainer.style.background = 'transparent';
            DOM.graphContainer.classList.toggle('no-bg', noBg);
        }

        // График
        if (isVisible('gr') && (currentConfig.showWheelGraph || currentConfig.showThrottleGraph ||
            currentConfig.showBrakeGraph || currentConfig.showClutchGraph ||
            currentConfig.showHandbrakeGraph)) {
            GraphManager.render();
        }
    },

    /** Построение выпадающего списка тем */
    buildSelect() {
        const optionsContainer = document.getElementById('themeOptions');
        const themeSelect = document.getElementById('themeSelect');
        const trigger = themeSelect?.querySelector('.custom-select-trigger');

        if (!optionsContainer || !trigger) return;

        optionsContainer.innerHTML = '';
        Object.entries(THEME_NAMES).forEach(([key, name]) => {
            const option = document.createElement('div');
            option.className = 'custom-option';
            option.dataset.value = key;
            option.textContent = t('theme.widget.' + key);
            if (key === (currentConfig.theme || 'Default')) option.classList.add('selected');

            option.addEventListener('click', (e) => {
                e.stopPropagation();
                optionsContainer.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                trigger.textContent = t('theme.widget.' + key);
                this.apply(key);
                themeSelect.classList.remove('active');
            });
            optionsContainer.appendChild(option);
        });

        // Разделитель + «Редактировать» — только в C#-режиме
        if (window.chrome?.webview) {
            const sep = document.createElement('div');
            sep.className = 'custom-option preset-separator';
            sep.innerHTML = '<svg class="option-icon" viewBox="0 0 24 24"><path d="m19 0h-14a5.006 5.006 0 0 0 -5 5v5a7.009 7.009 0 0 0 7 7h2v4a3 3 0 0 0 6 0v-4h2a7.009 7.009 0 0 0 7-7v-5a5.006 5.006 0 0 0 -5-5zm-17 5a3 3 0 0 1 3-3h5v1a1 1 0 0 0 2 0v-1h2v3a1 1 0 0 0 2 0v-3h2v5a1 1 0 0 0 2 0v-4.816a3 3 0 0 1 2 2.816v5h-20zm15 10h-3a1 1 0 0 0 -1 1v5a1 1 0 0 1 -2 0v-5a1 1 0 0 0 -1-1h-3a5 5 0 0 1 -4.576-3h19.152a5 5 0 0 1 -4.576 3z"/></svg> <span data-i18n="theme.manage.edit">' + t('theme.manage.edit') + '</span>';
            sep.addEventListener('click', (e) => {
                e.stopPropagation();
                themeSelect.classList.remove('active');
                window.chrome.webview.postMessage(JSON.stringify({ action: 'openThemeEditor' }));
            });
            optionsContainer.appendChild(sep);
        }

        const currentTheme = currentConfig.theme || 'Default';
        trigger.textContent = THEME_NAMES.hasOwnProperty(currentTheme) ? t('theme.widget.' + currentTheme) : currentTheme;

        setTimeout(() => {
            var sel = document.getElementById('themeSelect');
            if (!sel || sel._themeInit) return;
            sel._themeInit = true;
            initCustomSelect('themeSelect', (option) => {
                this.apply(option.dataset.value);
            });
        }, 0);
    },

    /** Синхронизация UI селекта с текущей темой */
    updateSelectUI() {
        const theme = currentConfig.theme || 'Default';
        const themeSelect = document.getElementById('themeSelect');
        const trigger = themeSelect?.querySelector('.custom-select-trigger');
        const optionsContainer = document.getElementById('themeOptions');

        if (!trigger || !optionsContainer) return;

        trigger.textContent = THEME_NAMES.hasOwnProperty(theme) ? t('theme.widget.' + theme) : theme;
        optionsContainer.querySelectorAll('.custom-option').forEach(opt => {
            opt.classList.toggle('selected', opt.dataset.value === theme);
        });
    }
};

// ==========================================
// 5. ОБНОВЛЕНИЕ UI НАСТРОЕК
// ==========================================

/** Селектор языка */
function buildLanguageSelect() {
    const optionsContainer = document.getElementById('languageOptions');
    const select = document.getElementById('languageSelect');
    const trigger = select?.querySelector('.custom-select-trigger');
    if (!optionsContainer || !trigger) return;

    optionsContainer.innerHTML = '';
    Object.entries(LANGUAGE_NAMES).forEach(([key, name]) => {
        const option = document.createElement('div');
        option.className = 'custom-option';
        option.dataset.value = key;
        option.textContent = t('lang.' + key);
        if (key === (currentConfig.language || 'ru')) option.classList.add('selected');

        option.addEventListener('click', (e) => {
            e.stopPropagation();
            optionsContainer.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            trigger.textContent = name;
            currentConfig.language = key; // Обновляем конфиг
            updatePedalConfig(); // Применяем изменения
            if (typeof sendConfigUpdate === 'function') sendConfigUpdate();
            select.classList.remove('active');
        });
        optionsContainer.appendChild(option);
    });

    // Установка текущего значения
    const currentLang = currentConfig.language || 'ru';
    trigger.textContent = t('lang.' + currentLang);
}

/** Селектор языка интерфейса */
function buildInterfaceLanguageSelect() {
    const optionsContainer = document.getElementById('interfaceLanguageOptions');
    const select = document.getElementById('interfaceLanguageSelect');
    const trigger = select?.querySelector('.custom-select-trigger');
    if (!optionsContainer || !trigger) return;

    optionsContainer.innerHTML = '';
    const langs = [
        { value: 'ru', name: t('lang.ru') },
        { value: 'en', name: t('lang.en') }
    ];
    langs.forEach(({ value, name }) => {
        const option = document.createElement('div');
        option.className = 'custom-option';
        option.dataset.value = value;
        option.textContent = name;
        if (value === (currentConfig.interfaceLanguage || 'ru')) option.classList.add('selected');

        option.addEventListener('click', (e) => {
            e.stopPropagation();
            optionsContainer.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            trigger.textContent = name;
            setInterfaceLocale(value);
            select.classList.remove('active');
        });
        optionsContainer.appendChild(option);
    });

    const currentLang = currentConfig.interfaceLanguage || 'ru';
    trigger.textContent = t('lang.' + currentLang);
}

/** Обновление видимости индикатора КПП и G-meter */
function updateGearPosition() {
    const wheelAssigned = currentConfig.wheelAxis !== null || (currentConfig.useUdpTelemetry && currentConfig.showWheelUdp);
    const hasGearButtons = currentConfig.gearButtons && currentConfig.gearButtons.some(b => b !== -1);
    const hasGear = hasGearButtons || hasUdpGear();
    const isIndependent = currentConfig.gearIndependent && wheelAssigned && hasGear;
    const showGmeter = currentConfig.useUdpTelemetry && currentConfig.showGmeter && udpState.connected && isVisible('gm');

    // Скрываем только если нет НИЧЕГО: ни КПП, ни руля
    const hideGear = (!hasGear && !wheelAssigned) || (!isVisible('gb') && !wheelAssigned);

	// На-рульный gear: виден всегда (не зависит от independent)
	if (DOM.gearDisplay) {
		DOM.gearDisplay.classList.toggle('hidden-gear-independent', hideGear);
		DOM.gearDisplay.classList.toggle('on-wheel-active', hasGear && !isIndependent && !hideGear);
	}

	// Отдельный gear: виден когда есть gear И independent
	if (DOM.gearDisplayIndependent) {
		DOM.gearDisplayIndependent.classList.toggle('hidden-gear-independent', hideGear || !isIndependent);
	}

	// Сброс кэша рендера — при переключении режима КПП перерендерить актуальной передачей
	_lastRenderedGear = null;

    // G-meter: виден только когда showGmeter
    if (DOM.gmeterDisplay) {
        const isHidden = !showGmeter;
        DOM.gmeterDisplay.classList.toggle('hidden-independent', isHidden);
        if (isHidden) {
            if (DOM.gmeterTrail) {
                const ctx = DOM.gmeterTrail.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, DOM.gmeterTrail.width, DOM.gmeterTrail.height);
            }
            if (DOM.gmeterBall) {
                DOM.gmeterBall.style.transform = 'translate(-50%, -50%)';
            }
        }
    }
}

/** Обновление текста педалей и их видимости */
function updatePedalConfig() {
    const lang = currentConfig.language || 'ru';
    const labels = LANGUAGES[lang];
    if (!labels) return;

    const pedalLabels = {
        'handbrake': labels.handbrake,
        'clutch': labels.clutch,
        'brake': labels.brake,
        'throttle': labels.throttle
    };

    const isActive = currentConfig.showPedalLabels;
    if (DOM.hudContainer) {
        DOM.hudContainer.classList.toggle('labels-hidden', !isActive);
    }

    Object.entries(pedalLabels).forEach(([id, text]) => {
        const pedalEl = DOM[id];
        if (pedalEl) {
            const labelEl = pedalEl.querySelector('.label');
            if (labelEl) labelEl.textContent = text;
        }
    });

    // Переключаем класс на <html> для переключения базовой ширины педалей
    document.documentElement.classList.toggle('pedals-no-labels', !isActive);

    // Сбрасываем кэш, чтобы при следующем getCssBaseValue прочитались актуальные значения
    invalidateCssCache();
    updateWidgetLayout();
}

/** Сброс выбранного автомобиля при ручном изменении градусов */
function clearCarSelection() {
    currentConfig.selectedCar = '';
    const carSelect = document.getElementById('carSelect');
    if (!carSelect) return;
    const trigger = carSelect.querySelector('.custom-select-trigger');
    if (trigger) { trigger.textContent = t('car.placeholder'); trigger.title = ''; trigger.classList.add('placeholder'); }
    carSelect.querySelectorAll('.custom-option').forEach(opt => opt.classList.remove('selected'));
}

/** Обновление ползунка и инпута угла поворота */
function updateSteeringAngle() {
    let value = parseInt(DOM.steeringAngleInput.value) || 540;
    value = Math.round(value / 10) * 10;
    value = Math.max(180, Math.min(2700, value));

    DOM.steeringAngleInput.value = value + '°';
    DOM.steeringSlider.value = value;
    currentConfig.steeringAngle = value;
    updateAnglePreset();
    clearCarSelection();
    if (typeof sendConfigUpdate === 'function') sendConfigUpdate();
}

/** Построение селектора пресетов */
function buildPresetSelect(presetNames) {
    const optionsContainer = document.getElementById('presetOptions');
    const select = document.getElementById('presetSelect');
    const trigger = select?.querySelector('.custom-select-trigger');
    if (!optionsContainer || !trigger) return;

    optionsContainer.innerHTML = '';

    window._presetNames = presetNames || [];

    // Пресеты — из переданного списка или из localStorage
    const presets = presetNames || ConfigManager.listSync();
    presets.forEach(name => {
        const opt = document.createElement('div');
        opt.className = 'custom-option';
        opt.dataset.value = name;
        opt.style.position = 'relative';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = name;
        nameSpan.style.overflow = 'hidden';
        nameSpan.style.textOverflow = 'ellipsis';
        nameSpan.style.whiteSpace = 'nowrap';
        nameSpan.style.display = 'block';
        nameSpan.style.marginRight = '16px';
        opt.appendChild(nameSpan);

        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'preset-delete-btn';
        deleteBtn.textContent = '✕';
        deleteBtn.title = t('modal.delete');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            select.classList.remove('active');
            showNotification('deletePreset', {
                message: t('modal.deleteConfirm', name),
                onConfirm: () => {
                    const wasCurrent = ConfigManager.getCurrent() === name;
                    const presetNames = window._presetNames || [];
                    const idx = presetNames.indexOf(name);

                    ConfigManager.deleteSync(name);

                    if (wasCurrent) {
                        if (window.chrome?.webview) {
                            window._deletePresetName = name;
                        } else {
                            const adj = idx > 0 ? presetNames[idx - 1]
                                : presetNames.length > 1 ? presetNames[idx + 1]
                                : null;
                            if (adj) {
                                ConfigManager.setCurrent(adj);
                                const trig = document.getElementById('presetSelect')?.querySelector('.custom-select-trigger');
                                if (trig) trig.textContent = adj;
                                if (typeof loadPresetByName === 'function') loadPresetByName(adj, true);
                            } else {
                                ConfigManager.setCurrent('');
                                const trig = document.getElementById('presetSelect')?.querySelector('.custom-select-trigger');
                                if (trig) trig.textContent = '';
                            }
                        }
                    }

                    if (window.chrome?.webview) {
                        window.chrome.webview.postMessage(JSON.stringify({ action: 'deleteConfig', filename: name }));
                    } else {
                        buildPresetSelect();
                    }
            }});
        });
        opt.appendChild(deleteBtn);

        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            optionsContainer.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            trigger.textContent = name;
            select.classList.remove('active');
            loadPresetByName(name);
        });
        optionsContainer.appendChild(opt);
    });

    // Разделитель
    const sep = document.createElement('div');
    sep.className = 'custom-option preset-separator';
    sep.innerHTML = '<svg class="option-icon" viewBox="0 0 24 24"><path d="M12,10a4,4,0,1,0,4,4A4,4,0,0,0,12,10Zm0,6a2,2,0,1,1,2-2A2,2,0,0,1,12,16Z"/><path d="M22.536,4.122,19.878,1.464A4.966,4.966,0,0,0,16.343,0H5A5.006,5.006,0,0,0,0,5V19a5.006,5.006,0,0,0,5,5H19a5.006,5.006,0,0,0,5-5V7.657A4.966,4.966,0,0,0,22.536,4.122ZM17,2.08V3a3,3,0,0,1-3,3H10A3,3,0,0,1,7,3V2h9.343A2.953,2.953,0,0,1,17,2.08ZM22,19a3,3,0,0,1-3,3H5a3,3,0,0,1-3-3V5A3,3,0,0,1,5,2V3a5.006,5.006,0,0,0,5,5h4a4.991,4.991,0,0,0,4.962-4.624l2.16,2.16A3.02,3.02,0,0,1,22,7.657Z"/></svg> ' + t('status.savedAs');
    sep.addEventListener('click', (e) => {
        e.stopPropagation();
        select.classList.remove('active');
        showNotification('newPreset', {
            onOk: () => {
                const input = document.getElementById('newPresetName');
                const name = input?.value.trim();
                if (!name) return;

                const configObj = buildConfigObject();
                const configCode = serializeConfig(configObj);
                if (window.chrome?.webview) {
                    const content = `const DEVICES = {\ndefault: ${JSON.stringify(configObj, null, 2).trim()}\n};`;
                    window.chrome.webview.postMessage(JSON.stringify({ action: 'savePreset', content, filename: name }));
                    ConfigManager.saveSync(name, configObj);
                } else {
                    ConfigManager.saveSync(name, configObj);
                    downloadConfig(configCode, 'presets/' + name + '.js');
                }
                ConfigManager.setCurrent(name);
                window._linkedPreset = name;
                markSaved();
                showStatusMessage(t('status.presetSaved', name));
                buildPresetSelect();
                if (window.chrome?.webview) {
                    requestPresetList();
                    window.chrome.webview.postMessage(JSON.stringify({ action: 'updateGamePreset', presetName: name }));
                }
                const trigger = document.getElementById('presetSelect')?.querySelector('.custom-select-trigger');
                if (trigger) trigger.textContent = name;
            }
        });
    });
    optionsContainer.appendChild(sep);

    // Установка текущего значения
    const current = ConfigManager.getCurrent();
    if (current) {
        trigger.textContent = current;
        optionsContainer.querySelectorAll('.custom-option').forEach(opt => {
            if (opt.dataset.value === current) opt.classList.add('selected');
        });
    } else {
        trigger.textContent = '';
    }

    // Callback для колесика мыши (initSelectWheelScroll)
    select.onSelectChange = (option) => {
        const name = option.dataset.value;
        if (name) {
            loadPresetByName(name);
        }
    };

    // Открытие/закрытие дропдауна (только один раз)
    if (!select.dataset.presetInit) {
        select.dataset.presetInit = 'true';
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.custom-select').forEach(s => {
                if (s !== select) s.classList.remove('active');
            });
            select.classList.toggle('active');
        });
    }
}

/** Подсветка активной пресет-кнопки угла */
function updateAnglePreset() {
    const currentAngle = parseInt(DOM.steeringSlider.value);
    document.querySelectorAll('.angle-preset').forEach(btn => {
        const presetAngle = parseInt(btn.dataset.angle);
        btn.classList.toggle('active', currentAngle === presetAngle);
    });
}

/** Обновление всех привязок осей и кнопок в интерфейсе настроек */
function updateBindingsUI() {
    // 1. Оси
    const axisModes = ['wheel', 'throttle', 'brake', 'clutch', 'handbrake'];
    axisModes.forEach(mode => {
        const cfg = AXIS_CONFIG_MAP[mode];
        const valueEl = document.getElementById(`${mode}AxisValue`);
        const axisValue = currentConfig[cfg.axisKey];

        if (!valueEl) return;

        if (axisValue !== null) {
            valueEl.textContent = '';
            var lbl = document.createElement('span');
            lbl.textContent = t('status.axis', axisValue);
            valueEl.appendChild(lbl);
            var btn = document.createElement('button');
            btn.className = 'clear-axis';
            btn.dataset.mode = mode;
            btn.textContent = '×';
            valueEl.appendChild(btn);
        } else {
            valueEl.textContent = '-';
        }

        const invertBtn = DOM[cfg.invertKey + 'Btn'];
        if (invertBtn) invertBtn.classList.toggle('active', currentConfig[cfg.invertKey]);

        const rangeSelect = document.getElementById(`${mode}RangeSelect`);
        if (rangeSelect) {
            const trigger = rangeSelect.querySelector('.custom-select-trigger');
            const selectedOpt = rangeSelect.querySelector(`.custom-option[data-value="${currentConfig[cfg.rangeKey]}"]`);
            if (trigger && selectedOpt) {
                rangeSelect.querySelectorAll('.custom-option').forEach(opt =>
                    opt.classList.toggle('selected', opt === selectedOpt));
                trigger.textContent = selectedOpt.textContent;
            }
        }
    });

    // 2. Кнопки ручника
    const hbButtons = currentConfig.handbrakeButtons || [-1, -1, -1, -1, -1];
    const hbKeyboardKeys = currentConfig.handbrakeKeyboardKeys || [null, null, null, null, null];
    DOM.handbrakeBtnSlots.forEach((slot, idx) => {
        const btnIndex = hbButtons[idx];
        const kbKey = hbKeyboardKeys[idx];
        if (btnIndex !== -1) {
            slot.textContent = '';
            var lbl = document.createElement('span');
            lbl.textContent = btnIndex;
            slot.appendChild(lbl);
            var btn = document.createElement('button');
            btn.className = 'clear-axis';
            btn.dataset.mode = 'handbrake-button-' + idx;
            btn.textContent = '\u00d7';
            slot.appendChild(btn);
        } else if (kbKey) {
            slot.textContent = '';
            var lbl = document.createElement('span');
            lbl.textContent = getKeyDisplayName(kbKey);
            if (!udpState.connected && !window._wsConnected) {
                lbl.style.opacity = '0.5';
                slot.title = t('tooltip.handbrakeKeyboardUnavailable');
            }
            slot.appendChild(lbl);
            var btn = document.createElement('button');
            btn.className = 'clear-axis';
            btn.dataset.mode = 'handbrake-button-' + idx;
            btn.textContent = '\u00d7';
            slot.appendChild(btn);
        } else {
            slot.textContent = '-';
        }
    });

    // 3. Кнопки передач
    const gearButtons = currentConfig.gearButtons || [-1, -1, -1, -1, -1, -1, -1, -1];
    DOM.gearBtnSlots.forEach((slot, idx) => {
        const btnIndex = gearButtons[idx];
        const gearLabel = slot.dataset.gear;
        if (btnIndex !== -1) {
            slot.classList.add('assigned');
            slot.textContent = '';
            var lbl = document.createElement('span');
            lbl.textContent = gearLabel;
            slot.appendChild(lbl);
            var btn = document.createElement('button');
            btn.className = 'clear-axis';
            btn.dataset.mode = 'gear-button-' + idx;
            btn.textContent = '×';
            slot.appendChild(btn);
        } else {
            slot.classList.remove('assigned');
            slot.textContent = gearLabel;
        }
    });

    GraphManager.updateButtonsState();
}

/** Обновление информации о подключенном устройстве */
function updateDeviceInfo() {
    if (!DOM.deviceInfo) return;
    const deviceInfoEl = DOM.deviceInfo;

    if (deviceName) {
        const cleanName = deviceName.replace(/\s*\(Vendor:\s*[0-9a-f]+\s+Product:\s*[0-9a-f]+\)\s*$/i, '').trim();
        if (scannerState.lastActiveElement) {
            const element = scannerState.lastActiveElement;
            const suffix = element.type === 'axis' ? ` • ${t('status.axis', element.index)}` :
                element.type === 'keyboard' ? ` • ${getKeyDisplayName(element.key)}` :
                ` • ${t('status.button', element.index)}`;
            const fullText = t('status.lastDevice', cleanName + suffix);
            deviceInfoEl.textContent = fullText;
            deviceInfoEl.title = fullText;
        } else {
            const fullText = t('status.lastDevice', cleanName);
            deviceInfoEl.textContent = fullText;
            deviceInfoEl.title = fullText;
        }
    } else {
        deviceInfoEl.textContent = '';
        deviceInfoEl.title = '';
    }
}

let _statusTimer = null;

function showStatusMessage(text) {
    if (!DOM.notificationStatus) return;
    clearTimeout(_statusTimer);
    DOM.statusMessageText.textContent = text;
    DOM.notificationStatus.classList.add('show');
    _statusTimer = setTimeout(function () {
        DOM.notificationStatus.classList.remove('show');
    }, 2000);
}



/** Показ уведомления */
function showNotification(key, options) {
    document.querySelectorAll('.notification-modal').forEach(m => m.classList.remove('show'));

    if (key === 'emptyConfig') {
        const keyHandler = (e) => {
            if (e.key === 'Enter' || e.key === 'Escape') { DOM.notificationEmpty.classList.remove('show'); document.removeEventListener('keydown', keyHandler); }
        };
        DOM.emptyOkBtn.onclick = (e) => { e.stopPropagation(); DOM.notificationEmpty.classList.remove('show'); document.removeEventListener('keydown', keyHandler); };
        document.addEventListener('keydown', keyHandler);
        DOM.notificationEmpty.classList.add('show');
        DOM.emptyOkBtn.focus();
        return;
    }

    if (key === 'unsaved') {
        DOM.unsavedOkBtn.onclick = null;
        DOM.unsavedCancelBtn.onclick = null;
        DOM.notificationUnsaved.onclick = null;

        const close = () => DOM.notificationUnsaved.classList.remove('show');
        const cleanup = () => {
            DOM.unsavedOkBtn.onclick = null;
            DOM.unsavedCancelBtn.onclick = null;
            DOM.notificationUnsaved.onclick = null;
            document.removeEventListener('keydown', keyHandler);
        };
        const keyHandler = (e) => {
            if (e.key === 'Enter') { DOM.unsavedOkBtn.click(); }
            if (e.key === 'Escape') { DOM.unsavedCancelBtn.click(); }
        };

        DOM.unsavedOkBtn.onclick = (e) => { e.stopPropagation(); close(); cleanup(); options?.onOk?.(); };
        DOM.unsavedCancelBtn.onclick = () => { close(); cleanup(); options?.onCancel?.(); };
        DOM.notificationUnsaved.onclick = (e) => { if (e.target === DOM.notificationUnsaved) { close(); cleanup(); options?.onOverlayClick?.(); } };
        document.addEventListener('keydown', keyHandler);

        DOM.notificationUnsaved.classList.add('show');
        DOM.unsavedOkBtn.focus();
        return;
    }

    if (key === 'newPreset') {
        DOM.newPresetOkBtn.onclick = null;
        DOM.newPresetCancelBtn.onclick = null;
        DOM.notificationNewPreset.onclick = null;

        const keydownHandler = (e) => {
            if (e.key === 'Enter') { DOM.newPresetOkBtn.click(); }
            if (e.key === 'Escape') { DOM.newPresetCancelBtn.click(); }
        };
        const close = () => DOM.notificationNewPreset.classList.remove('show');
        const cleanup = () => {
            DOM.newPresetOkBtn.onclick = null;
            DOM.newPresetCancelBtn.onclick = null;
            DOM.notificationNewPreset.onclick = null;
            document.removeEventListener('keydown', keydownHandler);
        };

        DOM.newPresetOkBtn.onclick = (e) => { e.stopPropagation(); close(); cleanup(); options?.onOk?.(); };
        DOM.newPresetCancelBtn.onclick = () => { close(); cleanup(); options?.onCancel?.(); };
        DOM.notificationNewPreset.onclick = (e) => { if (e.target === DOM.notificationNewPreset) { close(); cleanup(); options?.onOverlayClick?.(); } };
        document.addEventListener('keydown', keydownHandler);

        DOM.notificationNewPreset.classList.add('show');
        setTimeout(() => document.getElementById('newPresetName')?.focus(), 100);
        return;
    }

    if (key === 'deletePreset') {
        DOM.deletePresetOkBtn.onclick = null;
        DOM.deletePresetCancelBtn.onclick = null;
        DOM.notificationDeletePreset.onclick = null;

        DOM.deletePresetMessage.textContent = options?.message || '';
        DOM.deletePresetTitle.textContent = options?.title || t('modal.deletePreset');

        const close = () => DOM.notificationDeletePreset.classList.remove('show');
        const cleanup = () => {
            DOM.deletePresetOkBtn.onclick = null;
            DOM.deletePresetCancelBtn.onclick = null;
            DOM.notificationDeletePreset.onclick = null;
            document.removeEventListener('keydown', keyHandler);
        };
        const keyHandler = (e) => {
            if (e.key === 'Enter') { DOM.deletePresetOkBtn.click(); }
            if (e.key === 'Escape') { DOM.deletePresetCancelBtn.click(); }
        };

        DOM.deletePresetOkBtn.onclick = (e) => { e.stopPropagation(); close(); cleanup(); options?.onConfirm?.(); };
        DOM.deletePresetCancelBtn.onclick = () => { close(); cleanup(); options?.onCancel?.(); };
        DOM.notificationDeletePreset.onclick = (e) => { if (e.target === DOM.notificationDeletePreset) { close(); cleanup(); options?.onOverlayClick?.(); } };
        document.addEventListener('keydown', keyHandler);

        DOM.notificationDeletePreset.classList.add('show');
        DOM.deletePresetOkBtn.focus();
        return;
    }
}

/** Обновление порядка педалей (ручник справа/слева) */
function updatePedalOrder() {
    const pedalsRow = DOM.pedalsRow;
    if (!pedalsRow) return;
    const handbrake = document.getElementById('handbrake');
    if (!handbrake) return;

    if (currentConfig.handbrakeOnRight) {
        pedalsRow.appendChild(handbrake);
    } else {
        pedalsRow.insertBefore(handbrake, pedalsRow.firstChild);
    }
    updateWidgetLayout();
}

/** Полное обновление UI из конфига */
function updateUIFromConfig() {
    updateBindingsUI();
    updatePedalConfig();
    updateAnglePreset();
    updateGearPosition();
    buildLanguageSelect();
    buildInterfaceLanguageSelect();

    if (DOM.scaleValue && DOM.scaleSlider) {
        DOM.scaleValue.value = Math.round((currentConfig.scale || 1.0) * 100) + '%';
        DOM.scaleSlider.value = (currentConfig.scale || 1.0).toFixed(2);
    }

    if (DOM.tvdResultsSlider && DOM.tvdResultsValue) {
        var tvdSec = currentConfig.tvdResultsSeconds ?? 60;
        DOM.tvdResultsValue.value = String(tvdSec);
        DOM.tvdResultsSlider.value = tvdSec;
    }

    updateAllToggleStates();
}

/** Синхронизация одного переключателя с конфигом */
function syncToggleState(toggleEl, isActive) {
    if (!toggleEl) return;
    toggleEl.classList.toggle('active', isActive);
}

/** Единая синхронизация тогглера: disabled с сохранением active для восстановления */
function updateToggleState(toggle, isDisabled, configKey, effects) {
    if (!toggle) return;

    const wasDisabled = toggle.classList.contains('disabled');

    // disabled-класс ДО колбэков — Proxy маскирует currentConfig в false
    toggle.disabled = isDisabled;
    toggle.classList.toggle('disabled', isDisabled);

    const configVal = configKey ? getRawConfig(configKey) : false;

    if (isDisabled && !wasDisabled) {
        toggle.dataset.savedActive = toggle.classList.contains('active') ? '1' : '';
        if (effects?.onDisable) effects.onDisable();
    }
    if (!isDisabled && wasDisabled && (toggle.dataset.savedActive === '1' || configVal)) {
        toggle.dataset.savedActive = '';
        if (effects?.onEnable) effects.onEnable();
    }
    toggle.classList.toggle('active', isDisabled
        ? toggle.dataset.savedActive === '1' || configVal
        : configVal);

    if (effects?.onUpdate) effects.onUpdate(isDisabled);
}

/** Обновляет состояние ВСЕХ тогглеров (active/disabled) на основе currentConfig */
function updateAllToggleStates() {
    // --- Простые тогглеры (без disabled) ---
    syncToggleState(DOM.toggleBg, currentConfig.showBg);
    syncToggleState(DOM.toggleLayoutOrderBtn, currentConfig.layoutReverse);
    syncToggleState(DOM.toggleHandbrakeRightBtn, currentConfig.handbrakeOnRight);
    syncToggleState(DOM.toggleNoCornerRounding, currentConfig.noCornerRounding);
    syncToggleState(DOM.toggleTvdResults, currentConfig.showTvdResults);

    // 0. Pedal Labels: disabled если нет ни одной педали
    const hasAnyPedal = currentConfig.throttleAxis !== null || currentConfig.brakeAxis !== null || currentConfig.clutchAxis !== null
        || currentConfig.handbrakeAxis !== null
        || (currentConfig.handbrakeButtons && currentConfig.handbrakeButtons.some(b => b !== -1))
        || (currentConfig.useUdpTelemetry && udpState.connected && udpState.cSharpEnabled && currentConfig.showPedalsInUdp)
        || (currentConfig.useUdpTelemetry && udpState.connected && udpState.cSharpEnabled && currentConfig.showHandbrakeUdp);
    updateToggleState(DOM.togglePedalLabelsBtn, !hasAnyPedal, 'showPedalLabels');

    // Графики (без disabled, только inactive в GraphManager)
    syncToggleState(DOM.toggleWheelGraphBtn, currentConfig.showWheelGraph);
    syncToggleState(DOM.toggleThrottleGraphBtn, currentConfig.showThrottleGraph);
    syncToggleState(DOM.toggleBrakeGraphBtn, currentConfig.showBrakeGraph);
    syncToggleState(DOM.toggleClutchGraphBtn, currentConfig.showClutchGraph);
    syncToggleState(DOM.toggleHandbrakeGraphBtn, currentConfig.showHandbrakeGraph);

    // --- Условные тогглеры (могут быть disabled) ---

    // 1. UDP master: disabled когда WS отключён или C# выключил телеметрию
    updateToggleState(DOM.toggleUdpTelemetryBtn,
        !udpState.connected || !udpState.cSharpEnabled, 'useUdpTelemetry');

    // 2. Gear Independent: disabled если руль не назначен ИЛИ КПП не используется
    const wheelAssigned = currentConfig.wheelAxis !== null || (currentConfig.useUdpTelemetry && currentConfig.showWheelUdp);
    const hasGearButtons = currentConfig.gearButtons && currentConfig.gearButtons.some(b => b !== -1);
    const hasGear = hasGearButtons || hasUdpGear();
    updateToggleState(DOM.toggleGearIndependent, !wheelAssigned || !hasGear, 'gearIndependent', {
        onDisable: updateWidgetLayout, onEnable: updateWidgetLayout
    });

    // 2b. Gear Sync: disabled если нет источника КПП
    updateToggleState(DOM.toggleGearSync, !hasGear, 'gearSyncWithWheel');

    // 3. Graph Independent + Graphs Only: disabled если ни один график не активен
    const anyGraphActive = currentConfig.showWheelGraph || currentConfig.showThrottleGraph ||
        currentConfig.showBrakeGraph || currentConfig.showClutchGraph ||
        currentConfig.showHandbrakeGraph;
    const mainWrapper = DOM.hudContainerWrapper?.parentElement;

    updateToggleState(DOM.toggleGraphIndependent, !anyGraphActive, 'graphIndependent', {
        onDisable() {
            DOM.graphContainer?.classList.remove('visible');
            mainWrapper?.classList.remove('graph-independent');
            GraphManager.updateVisibility();
            updateWidgetLayout();
        },
        onEnable() {
            mainWrapper?.classList.add('graph-independent');
            GraphManager.updateVisibility();
            GraphManager.debouncedRender();
            updateWidgetLayout();
        },
        onUpdate(disabled) {
            mainWrapper?.classList.toggle('graph-independent', !disabled && currentConfig.graphIndependent && isVisible('gr'));
        }
    });

    // 3b. Graphs Only
    updateToggleState(DOM.toggleGraphsOnlyBtn, !anyGraphActive, 'graphsOnly', {
        onDisable() {
            mainWrapper?.classList.remove('graphs-only');
            GraphManager.updateVisibility();
            updateWidgetLayout();
        },
        onEnable() {
            mainWrapper?.classList.add('graphs-only');
            GraphManager.updateVisibility();
            GraphManager.debouncedRender();
            updateWidgetLayout();
        },
        onUpdate(disabled) {
            mainWrapper?.classList.toggle('graphs-only', !disabled && currentConfig.graphsOnly && isVisible('gr'));
        }
    });

    // 4. G-meter: disabled если UDP/WS/C# неактивны, включён «Только графики» или выбрана грузовая игра
    const udpInactive = !currentConfig.useUdpTelemetry || !udpState.connected || !udpState.cSharpEnabled;
    const isTruck = window._selectedGame === 'Euro Truck Simulator 2' || window._selectedGame === 'American Truck Simulator';
    const gmeterDisabled = udpInactive || currentConfig.graphsOnly || isTruck;
    if (gmeterDisabled) currentConfig.showGmeter = false;
    updateToggleState(DOM.toggleGmeter, gmeterDisabled, 'showGmeter', {
        onDisable: updateWidgetLayout, onEnable: updateWidgetLayout
    });

    // 4b. G-meter trail: disabled если G-meter выключен или недоступен
    updateToggleState(DOM.toggleGmeterTrail,
        gmeterDisabled || !currentConfig.showGmeter, 'showGmeterTrail', {
        onDisable() {
            if (DOM.gmeterTrail) {
                const ctx = DOM.gmeterTrail.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, DOM.gmeterTrail.width, DOM.gmeterTrail.height);
            }
        }
    });

    // 5. UDP sub-toggles: disabled если UDP/WS/C# неактивны
    const udpSubToggles = [
        { btn: DOM.togglePedalsUdpBtn, key: 'showPedalsInUdp' },
        { btn: DOM.toggleGearUdpBtn, key: 'showGearUdp' },
        { btn: DOM.toggleUdpSmoothingBtn, key: 'udpSmoothing' }
    ];
    udpSubToggles.forEach(({ btn, key }) => {
        updateToggleState(btn, udpInactive, key);
    });

    // 5b. Handbrake UDP: дополнительно disabled если ручника нет в телеметрии игры
    const handbrakeUdpDisabled = udpInactive || !udpState.handbrakeInTelemetry;
    updateToggleState(DOM.toggleHandbrakeUdpBtn, handbrakeUdpDisabled, 'showHandbrakeUdp');
    DOM.toggleHandbrakeUdpBtn.title = handbrakeUdpDisabled
        ? t('udp.handbrakeDisabled')
        : t('udp.handbrakeEnabled');

    // 5c. Wheel UDP: дополнительно disabled если руля нет в телеметрии игры
    const wheelUdpDisabled = udpInactive || !udpState.steeringInTelemetry;
    updateToggleState(DOM.toggleWheelUdpBtn, wheelUdpDisabled, 'showWheelUdp');
    DOM.toggleWheelUdpBtn.title = wheelUdpDisabled
        ? t('udp.wheelDisabled')
        : t('udp.wheelEnabled');

    // Синхронизировать видимость MW-чекбоксов (скрыть без источника данных)
    if (typeof window.MultiWidget !== 'undefined') window.MultiWidget.syncPanelCheckboxes();
}


// ==========================================
// 7. ИТОГ СУ TVD (данные приходят из C# по WS)
// ==========================================
var _tvdResult = null;
var _tvdReceivedAt = 0;
var TVD_DEMO = new URLSearchParams(location.search).get('tvddemo') === '1';
var _tvdDemoResult = null;

function tvdDemoResult() {
    if (_tvdDemoResult) return _tvdDemoResult;
    var names = ['Gosha382', 'Ural_74', 'seWenöff', 'Sergey_R', 'Kolya', 'RioSsa93', 'Vitaliy', 'MaxDrift', 'Andrey'];
    var meMs = 150000 + Math.floor(Math.random() * 25000);
    var rows = names.map(function(name) {
        return { driver: name, ms: 148000 + Math.floor(Math.random() * 30000), me: false };
    });
    rows.push({ driver: '', ms: meMs, me: true });
    rows.sort(function(a, b) { return a.ms - b.ms; });
    var pos = 1;
    rows.forEach(function(x, i) {
        x.p = i + 1;
        x.skip = false;
        if (x.me) pos = i + 1;
    });
    rows.forEach(function(x) {
        x.diff_ms = x.me ? null : meMs - x.ms;
    });
    _tvdDemoResult = {
        n: 2, track: 'Fourkéta Kourva', my_ms: meMs, official: true, loading: false, dnf: false,
        pos: pos, of: rows.length, gap_best_ms: meMs - rows[0].ms, rows: rows,
        best: { driver: rows[0].driver, ms: rows[0].ms }
    };
    return _tvdDemoResult;
}

function _tvdEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function(c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
}

function _tvd2(n) {
    return String(n).padStart(2, '0');
}

function tvdFormatTime(ms) {
    if (ms == null || isNaN(ms)) return '—';
    if (ms >= 5999000) return t('tvd.dnf');
    var h = Math.floor(ms / 3600000);
    var m = Math.floor(ms / 60000) % 60;
    var s = Math.floor(ms / 1000) % 60;
    var x = String(ms % 1000).padStart(3, '0');
    return h
        ? h + ':' + _tvd2(m) + ':' + _tvd2(s) + '.' + x
        : m + ':' + _tvd2(s) + '.' + x;
}

function tvdFormatDiff(ms) {
    if (ms == null) return '';
    return (ms < 0 ? '−' : '+') + (Math.abs(ms) / 1000).toFixed(2);
}

function currentTvdResult() {
    if (TVD_DEMO) return (_tvdResult && _tvdResult.n != null) ? _tvdResult : tvdDemoResult();
    return _tvdResult;
}

function isTvdActive() {
    if (typeof currentConfig === 'undefined' || !currentConfig) return false;
    var r = currentTvdResult();
    if (!r || r.n == null) return false;
    if (TVD_DEMO) return !!currentConfig.showTvdResults;
    if (!currentConfig.showTvdResults) return false;
    if (typeof isVisible === 'function' && !isVisible('tr')) return false;
    var seconds = Number(currentConfig.tvdResultsSeconds) || 60;
    return (performance.now() - _tvdReceivedAt) < seconds * 1000;
}

function initTvdDemoToggle() {
    var btn = document.createElement('button');
    btn.id = 'tvdDemoToggle';
    btn.className = 'btn' + (currentConfig.showTvdResults ? ' btn-primary' : '');
    btn.type = 'button';
    btn.textContent = t('toggle.tvdResults');
    btn.title = t('tooltip.tvdResults');
    btn.addEventListener('click', function() {
        currentConfig.showTvdResults = !currentConfig.showTvdResults;
        btn.classList.toggle('btn-primary', !!currentConfig.showTvdResults);
        updateAllToggleStates();
        if (typeof window.MultiWidget !== 'undefined') window.MultiWidget.syncPanelCheckboxes();
        updateTvdResults();
        if (typeof sendConfigUpdate === 'function') sendConfigUpdate();
    });
    document.body.appendChild(btn);
}

/** Высота таблицы уходит вверх: виджет растёт, компоненты остаются внизу */
function applyTvdOffset() {
    var el = DOM.tvdResults;
    var container = DOM.hudContainer;
    if (!el || !container) return;
    var baseHeight = parseFloat(container.dataset.baseHeight || '0');
    if (!baseHeight) return;
    var basePadTop = parseFloat(container.dataset.basePadTop || '0');
    var offset = isTvdActive() ? Math.ceil(el.getBoundingClientRect().height) : 0;
    container.style.height = (baseHeight + offset) + 'px';
    container.style.paddingTop = (basePadTop + offset) + 'px';
}

function onTvdInfo(result) {
    if (result && typeof result === 'object') {
        _tvdResult = result;
        _tvdReceivedAt = performance.now();
    }
    updateTvdResults();
}

function updateTvdResults() {
    var el = DOM.tvdResults;
    if (!el) return;

    var active = isTvdActive();
    el.classList.toggle('on', active);
    if (active) renderTvdResult(currentTvdResult());
    applyTvdOffset();
    if (_lastWidgetSizes) calculateBorderRadius(_lastWidgetSizes);
}

function renderTvdResult(r) {
    var title = t('tvd.finish');
    if (r.n) title += ' · ' + t('tvd.stage') + r.n;
    if (r.track) title += ' · ' + r.track;
    DOM.tvdResultsTitle.textContent = title;
    DOM.tvdResultsState.textContent = r.loading ? t('tvd.syncing') : (r.official ? '' : t('tvd.unofficial'));

    if (r.dnf) {
        DOM.tvdResultsPos.textContent = '';
        DOM.tvdResultsTime.textContent = t('tvd.dnf');
        DOM.tvdResultsOf.textContent = '';
        DOM.tvdResultsRows.innerHTML = '<div class="tvd-note">' + _tvdEsc(t('tvd.dnfNote')) + '</div>';
        return;
    }

    DOM.tvdResultsPos.textContent = r.pos ? 'P' + r.pos : '';
    DOM.tvdResultsTime.textContent = tvdFormatTime(r.my_ms);

    var of = r.of || 1;
    if (of <= 1) {
        DOM.tvdResultsOf.textContent = t('tvd.noRivals');
    } else if (r.pos === 1) {
        DOM.tvdResultsOf.textContent = t('tvd.bestStage');
    } else {
        DOM.tvdResultsOf.textContent = t('tvd.of', of)
            + (r.gap_best_ms != null ? ' · ' + tvdFormatDiff(r.gap_best_ms) : '');
    }

    var rows = Array.isArray(r.rows) ? r.rows : [];
    if (of <= 1 || !rows.length) {
        DOM.tvdResultsRows.innerHTML = '<div class="tvd-note">' + _tvdEsc(t('tvd.noRivals')) + '</div>';
        return;
    }

    var html = '';
    rows.forEach(function(x) {
        if (x.skip && x.p > 1) html += '<div class="tvd-skip">···</div>';
        var diff = x.diff_ms == null ? '' : tvdFormatDiff(x.diff_ms);
        var dcls = x.diff_ms == null ? '' : (x.diff_ms <= 0 ? ' fast' : ' slow');
        html += '<div class="tvd-row' + (x.me ? ' me' : '') + '">'
            + '<span class="tvd-p">' + (x.p || '') + '</span>'
            + '<span class="tvd-n">' + _tvdEsc(x.me ? t('tvd.you') : (x.driver || '')) + '</span>'
            + '<span class="tvd-t">' + tvdFormatTime(x.ms) + '</span>'
            + '<span class="tvd-d' + dcls + '">' + diff + '</span>'
            + '</div>';
    });
    DOM.tvdResultsRows.innerHTML = html;
}

setInterval(updateTvdResults, 1000);
window.addEventListener('resize', updateTvdResults);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateTvdResults);
if (TVD_DEMO) initTvdDemoToggle();
