// == TavernHelper Script ==
// name: 屏幕常亮与生成震动
// author: Codex
// version: v0.2.4
// description: 在酒馆前台保持屏幕常亮，并在正常生成结束后震动提醒。
(function () {
  'use strict';

  const SCRIPT_NAME = '屏幕常亮与生成震动';
  const SCRIPT_VERSION = 'v0.2.4';
  const BUTTON_NAME = '屏幕与震动';
  const INSTANCE_KEY = '__xw_keep_awake_vibrate_v2__';
  const LEGACY_INSTANCE_KEY = '__xw_keep_awake_vibrate__';
  const STORAGE_KEY = 'xw_keep_awake_vibrate_settings_v2';
  const STYLE_ID = 'xw-kav-v2-style';
  const WIDGET_ID = 'xw-kav-v2-widget';
  const FLOATING_BUTTON_ID = 'xw-kav-v2-floating-button';
  const PANEL_HOST_ID = 'xw-kav-v2-panel-host';
  const OVERLAY_ID = 'xw-kav-v2-overlay';

  const DEFAULT_SETTINGS = {
    keepAwake: false,
    vibrateOnComplete: true,
    vibrationMs: 250,
    buttonPosition: null,
  };

  const runtime = {
    instanceId: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    wakeLock: null,
    generationActive: false,
    stopping: false,
    observer: null,
    repairTimers: [],
    cleanups: [],
  };

  function getAccessibleWindows() {
    const windows = [];
    let current = window;
    for (let index = 0; index < 8; index += 1) {
      if (!windows.includes(current)) windows.push(current);
      try {
        if (!current.parent || current.parent === current || !current.parent.document) break;
        current = current.parent;
      } catch (_) {
        break;
      }
    }
    return windows;
  }

  function getHostWindow() {
    try {
      if (window.top && window.top.document) return window.top;
    } catch (_) {}
    const windows = getAccessibleWindows();
    return windows.reduce((best, candidate) => {
      try {
        const bestArea = (best.innerWidth || 0) * (best.innerHeight || 0);
        const candidateArea = (candidate.innerWidth || 0) * (candidate.innerHeight || 0);
        return candidateArea >= bestArea ? candidate : best;
      } catch (_) {
        return best;
      }
    }, window);
  }

  function getHostDocument() {
    return getHostWindow().document || document;
  }

  function addCleanup(cleanup) {
    if (typeof cleanup === 'function') runtime.cleanups.push(cleanup);
  }

  function addListener(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    addCleanup(() => target.removeEventListener(type, listener, options));
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(getHostWindow().localStorage.getItem(STORAGE_KEY) || '{}');
      return { ...DEFAULT_SETTINGS, ...saved };
    } catch (_) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  let settings = loadSettings();

  function saveSettings() {
    try {
      getHostWindow().localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] 保存设置失败`, error);
    }
  }

  function notify(type, message) {
    const windows = getAccessibleWindows().slice().reverse();
    for (const target of windows) {
      try {
        if (target.toastr && typeof target.toastr[type] === 'function') {
          target.toastr[type](message, SCRIPT_NAME);
          return;
        }
      } catch (_) {}
    }
    console.log(`[${SCRIPT_NAME}] ${message}`);
  }

  function injectStyle() {
    const doc = getHostDocument();
    const root = ensureWidget().shadowRoot;
    if (root.querySelector(`#${STYLE_ID}`)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :host { all: initial; }
      *, *::before, *::after { box-sizing: border-box; letter-spacing: 0; }
      #${FLOATING_BUTTON_ID} {
        position: fixed; right: 12px; top: calc(env(safe-area-inset-top, 0px) + 76px);
        z-index: 2147483647; display: inline-grid; place-items: center;
        width: 40px; height: 40px; min-width: 40px; padding: 0;
        border: 1px solid rgba(255,255,255,.72); border-radius: 8px;
        color: #fff; box-shadow: 0 3px 12px rgba(0,0,0,.34);
        cursor: pointer; touch-action: none; user-select: none; -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent; pointer-events: auto;
      }
      #${FLOATING_BUTTON_ID}[data-active='true'] { background: #238b57; }
      #${FLOATING_BUTTON_ID}[data-active='false'] { background: #b64040; }
      #${FLOATING_BUTTON_ID} span { font-size: 18px; line-height: 1; pointer-events: none; }
      #${OVERLAY_ID} {
        width: 100%; max-height: inherit; display: block; overflow-y: auto; padding: 14px;
        border: 1px solid var(--SmartThemeBorderColor, #666); border-radius: 8px;
        background: var(--SmartThemeBlurTintColor, rgba(30,30,34,.98));
        color: var(--SmartThemeBodyColor, #eee); box-shadow: 0 10px 28px rgba(0,0,0,.42);
        backdrop-filter: blur(10px); font-family: Arial, "Microsoft YaHei", sans-serif; pointer-events: auto;
      }
      #${OVERLAY_ID} .xw-kav-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
      #${OVERLAY_ID} .xw-kav-title { margin: 0; font-size: 16px; line-height: 1.3; }
      #${OVERLAY_ID} .xw-kav-version { margin-left: 5px; font-size: 11px; font-weight: 400; opacity: .62; }
      #${OVERLAY_ID} .xw-kav-close { display: inline-grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 22px; }
      #${OVERLAY_ID} .xw-kav-row { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 12px; min-height: 50px; border-top: 1px solid color-mix(in srgb, currentColor 16%, transparent); }
      #${OVERLAY_ID} .xw-kav-label { font-size: 14px; font-weight: 600; }
      #${OVERLAY_ID} .xw-kav-help { display: block; margin-top: 2px; font-size: 12px; font-weight: 400; line-height: 1.35; opacity: .72; }
      #${OVERLAY_ID} input[type='checkbox'] { width: 21px; height: 21px; accent-color: #32b67a; cursor: pointer; }
      #${OVERLAY_ID} input[type='number'] { width: 82px; min-height: 34px; padding: 5px 8px; border: 1px solid var(--SmartThemeBorderColor, #666); border-radius: 6px; background: rgba(0,0,0,.22); color: inherit; }
      #${OVERLAY_ID} .xw-kav-status { min-height: 34px; margin: 10px 0; padding: 8px 10px; border-radius: 6px; background: rgba(127,127,127,.16); font-size: 12px; line-height: 1.45; }
      #${OVERLAY_ID} .xw-kav-status[data-tone='ok'] { color: #63d69b; }
      #${OVERLAY_ID} .xw-kav-status[data-tone='wait'] { color: #f0c56a; }
      #${OVERLAY_ID} .xw-kav-status[data-tone='error'] { color: #ff8585; }
      #${OVERLAY_ID} .xw-kav-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      #${OVERLAY_ID} .xw-kav-action { min-height: 38px; border: 1px solid var(--SmartThemeBorderColor, #666); border-radius: 6px; background: rgba(127,127,127,.16); color: inherit; cursor: pointer; font: inherit; font-size: 13px; }
      @media (max-width: 700px) {
        #${FLOATING_BUTTON_ID} { right: 10px; top: calc(env(safe-area-inset-top, 0px) + 62px); width: 38px; height: 38px; min-width: 38px; }
      }
    `;
    root.appendChild(style);
  }

  function ensureWidget() {
    const doc = getHostDocument();
    let widget = doc.getElementById(WIDGET_ID);
    if (!widget) {
      widget = doc.createElement('div');
      widget.id = WIDGET_ID;
      doc.body.appendChild(widget);
    }
    widget.style.cssText = 'all:initial!important;position:fixed!important;left:0!important;top:0!important;width:0!important;height:0!important;margin:0!important;padding:0!important;border:0!important;z-index:2147483647!important;pointer-events:none!important;';
    if (!widget.shadowRoot) widget.attachShadow({ mode: 'open' });
    widget.dataset.version = SCRIPT_VERSION;
    widget.dataset.instanceId = runtime.instanceId;
    return widget;
  }

  function getUiRoot() {
    const widget = getHostDocument().getElementById(WIDGET_ID);
    return widget?.shadowRoot || null;
  }

  function findUiElement(id) {
    return getUiRoot()?.querySelector(`#${id}`) || null;
  }

  function findPanelHost() {
    return getHostDocument().getElementById(PANEL_HOST_ID);
  }

  function findPanel() {
    return findPanelHost()?.querySelector('[data-xw-kav-panel-container]')?.shadowRoot?.querySelector(`#${OVERLAY_ID}`) || null;
  }

  function updateFloatingButtonState() {
    const button = findUiElement(FLOATING_BUTTON_ID);
    if (!button) return;
    button.dataset.active = settings.keepAwake ? 'true' : 'false';
    button.title = settings.keepAwake ? '屏幕常亮已开启，点击打开设置' : '屏幕常亮已关闭，点击打开设置';
    button.setAttribute('aria-label', button.title);
  }

  function clampButtonToViewport(button, left, top) {
    const host = getHostWindow();
    const doc = getHostDocument();
    const width = host.innerWidth || doc.documentElement.clientWidth || 800;
    const height = host.innerHeight || doc.documentElement.clientHeight || 600;
    return {
      left: Math.min(Math.max(8, left), Math.max(8, width - button.offsetWidth - 8)),
      top: Math.min(Math.max(8, top), Math.max(8, height - button.offsetHeight - 8)),
    };
  }

  function applySavedButtonPosition(button) {
    if (!settings.buttonPosition) return;
    const position = clampButtonToViewport(button, Number(settings.buttonPosition.left) || 8, Number(settings.buttonPosition.top) || 8);
    button.style.left = `${position.left}px`;
    button.style.top = `${position.top}px`;
    button.style.right = 'auto';
    button.style.bottom = 'auto';
  }

  function bindFloatingButtonDrag(button) {
    if (button.dataset.dragBound === 'true') return;
    button.dataset.dragBound = 'true';
    let active = false;
    let pointerId = null;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let suppressClickUntil = 0;

    const begin = (clientX, clientY, id) => {
      const rect = button.getBoundingClientRect();
      active = true;
      pointerId = id;
      moved = false;
      startX = clientX;
      startY = clientY;
      startLeft = rect.left;
      startTop = rect.top;
      button.style.left = `${rect.left}px`;
      button.style.top = `${rect.top}px`;
      button.style.right = 'auto';
      button.style.bottom = 'auto';
    };

    const move = (clientX, clientY) => {
      if (!active) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if (!moved && Math.hypot(dx, dy) < 12) return;
      moved = true;
      const position = clampButtonToViewport(button, startLeft + dx, startTop + dy);
      button.style.left = `${position.left}px`;
      button.style.top = `${position.top}px`;
    };

    const finish = () => {
      if (!active) return false;
      active = false;
      pointerId = null;
      if (moved) {
        const rect = button.getBoundingClientRect();
        settings.buttonPosition = { left: rect.left, top: rect.top };
        saveSettings();
        suppressClickUntil = Date.now() + 350;
      }
      return moved;
    };

    if (getHostWindow().PointerEvent) {
      button.addEventListener('pointerdown', (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        begin(event.clientX, event.clientY, event.pointerId);
        try { button.setPointerCapture(event.pointerId); } catch (_) {}
      });
      button.addEventListener('pointermove', (event) => {
        if (!active || event.pointerId !== pointerId) return;
        move(event.clientX, event.clientY);
      });
      const finishPointer = (event) => {
        if (!active || event.pointerId !== pointerId) return;
        finish();
        try { button.releasePointerCapture(event.pointerId); } catch (_) {}
      };
      button.addEventListener('pointerup', finishPointer);
      button.addEventListener('pointercancel', finishPointer);
    } else {
      button.addEventListener('touchstart', (event) => {
        const touch = event.changedTouches?.[0];
        if (!touch) return;
        begin(touch.clientX, touch.clientY, touch.identifier);
        event.preventDefault();
      }, { passive: false });
      button.addEventListener('touchmove', (event) => {
        const touch = Array.from(event.changedTouches || []).find((item) => item.identifier === pointerId);
        if (!touch) return;
        move(touch.clientX, touch.clientY);
        event.preventDefault();
      }, { passive: false });
      button.addEventListener('touchend', (event) => {
        if (!active) return;
        const wasMoved = finish();
        event.preventDefault();
        if (!wasMoved) openPanel();
      }, { passive: false });
      button.addEventListener('touchcancel', finish, { passive: true });
    }

    button.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || active) return;
      begin(event.clientX, event.clientY, 'mouse');
      const doc = getHostDocument();
      const onMove = (moveEvent) => move(moveEvent.clientX, moveEvent.clientY);
      const onUp = () => {
        finish();
        doc.removeEventListener('mousemove', onMove);
        doc.removeEventListener('mouseup', onUp);
      };
      doc.addEventListener('mousemove', onMove);
      doc.addEventListener('mouseup', onUp);
    });

    button.addEventListener('click', (event) => {
      if (Date.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      openPanel();
    });
  }

  function ensureFloatingButton() {
    const doc = getHostDocument();
    const widget = ensureWidget();
    const root = widget.shadowRoot;
    let button = findUiElement(FLOATING_BUTTON_ID);
    if (!button) {
      button = doc.createElement('button');
      button.id = FLOATING_BUTTON_ID;
      button.type = 'button';
      button.innerHTML = '<span aria-hidden="true">☀</span>';
      root.appendChild(button);
    } else if (button.parentNode !== root) {
      root.appendChild(button);
    }
    button.dataset.version = SCRIPT_VERSION;
    updateFloatingButtonState();
    applySavedButtonPosition(button);
    bindFloatingButtonDrag(button);
    button.style.display = '';
    return button;
  }

  function setPanelStatus(text, tone = '') {
    const status = findPanel()?.querySelector('.xw-kav-status');
    if (!status) return;
    status.textContent = text;
    status.dataset.tone = tone;
  }

  async function releaseWakeLock() {
    const lock = runtime.wakeLock;
    runtime.wakeLock = null;
    if (lock) {
      try { await lock.release(); } catch (_) {}
    }
    if (!settings.keepAwake) setPanelStatus('常亮已关闭');
  }

  async function requestWakeLock(showError = false) {
    if (runtime.stopping || !settings.keepAwake) return false;
    const host = getHostWindow();
    const doc = getHostDocument();
    if (doc.visibilityState !== 'visible') {
      setPanelStatus('页面回到前台后恢复常亮', 'wait');
      return false;
    }
    const wakeLockApi = host.navigator?.wakeLock || window.navigator?.wakeLock;
    if (!wakeLockApi?.request) {
      setPanelStatus('当前浏览器不支持屏幕常亮', 'error');
      if (showError) notify('warning', '当前浏览器不支持网页屏幕常亮。');
      return false;
    }
    try {
      if (runtime.wakeLock && !runtime.wakeLock.released) {
        setPanelStatus('屏幕常亮中', 'ok');
        return true;
      }
      runtime.wakeLock = await wakeLockApi.request('screen');
      runtime.wakeLock.addEventListener('release', () => {
        runtime.wakeLock = null;
        if (settings.keepAwake && doc.visibilityState === 'visible') {
          setPanelStatus('常亮被系统暂停，点击重试', 'wait');
        }
      }, { once: true });
      setPanelStatus('屏幕常亮中', 'ok');
      return true;
    } catch (error) {
      setPanelStatus('常亮请求失败，点击重试', 'error');
      if (showError) notify('warning', `无法开启常亮：${error?.message || '浏览器拒绝了请求'}`);
      return false;
    }
  }

  function vibrate(pattern, showError = false) {
    const navigators = [getHostWindow().navigator, window.navigator];
    for (const navigatorObject of navigators) {
      if (typeof navigatorObject?.vibrate !== 'function') continue;
      try {
        const result = navigatorObject.vibrate(pattern);
        if (showError && result === false) notify('warning', '浏览器没有允许震动。');
        return result !== false;
      } catch (_) {}
    }
    if (showError) notify('warning', '当前浏览器或设备不支持网页震动。');
    return false;
  }

  function closePanel() {
    const panelHost = findPanelHost();
    if (panelHost) {
      try { panelHost.close(); } catch (_) {}
      panelHost.remove();
    }
    ensureFloatingButton().style.display = '';
  }

  function openPanel() {
    const doc = getHostDocument();
    if (!doc.body) return;
    injectStyle();
    const existing = findPanelHost();
    if (existing) {
      findPanel()?.focus();
      return;
    }
    const mobile = getHostWindow().matchMedia?.('(max-width: 700px)').matches;
    const visibleWidth = getHostWindow().visualViewport?.width
      || doc.documentElement.clientWidth
      || getHostWindow().innerWidth
      || 360;
    const mobilePanelWidth = Math.max(240, Math.floor(visibleWidth) - 16);
    const panelHost = doc.createElement('dialog');
    panelHost.id = PANEL_HOST_ID;
    panelHost.style.cssText = mobile
      ? `all:initial!important;display:block!important;position:fixed!important;inset:auto 8px calc(env(safe-area-inset-bottom, 0px) + 126px) auto!important;width:${mobilePanelWidth}px!important;min-width:0!important;max-width:${mobilePanelWidth}px!important;height:auto!important;min-height:0!important;max-height:min(520px, calc(100dvh - 150px))!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;overflow:visible!important;visibility:visible!important;opacity:1!important;clip:auto!important;clip-path:none!important;z-index:2147483647!important;pointer-events:auto!important;transform:none!important;`
      : 'all:initial!important;display:block!important;position:fixed!important;inset:auto 14px calc(env(safe-area-inset-bottom, 0px) + 72px) auto!important;width:min(340px, calc(100vw - 24px))!important;min-width:0!important;max-width:340px!important;height:auto!important;min-height:0!important;max-height:min(520px, calc(100vh - 96px))!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;overflow:visible!important;visibility:visible!important;opacity:1!important;clip:auto!important;clip-path:none!important;z-index:2147483647!important;pointer-events:auto!important;transform:none!important;';
    const panelContainer = doc.createElement('div');
    panelContainer.dataset.xwKavPanelContainer = 'true';
    panelContainer.style.cssText = 'all:initial!important;display:block!important;width:100%!important;height:auto!important;margin:0!important;padding:0!important;border:0!important;overflow:visible!important;';
    panelHost.appendChild(panelContainer);
    const panelRoot = panelContainer.attachShadow({ mode: 'open' });
    const panelStyle = doc.createElement('style');
    panelStyle.textContent = getUiRoot()?.querySelector(`#${STYLE_ID}`)?.textContent || '';
    panelRoot.appendChild(panelStyle);
    const panel = doc.createElement('section');
    panel.id = OVERLAY_ID;
    panel.className = 'xw-kav-panel';
    panel.tabIndex = -1;
    panel.setAttribute('aria-label', '屏幕与震动设置');
    panel.innerHTML = `
        <div class="xw-kav-head">
          <h2 class="xw-kav-title">屏幕与震动<span class="xw-kav-version">${SCRIPT_VERSION}</span></h2>
          <button class="xw-kav-close" type="button" aria-label="关闭面板">&times;</button>
        </div>
        <label class="xw-kav-row">
          <span class="xw-kav-label">保持屏幕常亮<span class="xw-kav-help">酒馆在前台时阻止自动熄屏</span></span>
          <input data-setting="keepAwake" type="checkbox" ${settings.keepAwake ? 'checked' : ''}>
        </label>
        <label class="xw-kav-row">
          <span class="xw-kav-label">生成完毕震动<span class="xw-kav-help">正常生成结束提醒，手动停止不提醒</span></span>
          <input data-setting="vibrateOnComplete" type="checkbox" ${settings.vibrateOnComplete ? 'checked' : ''}>
        </label>
        <label class="xw-kav-row">
          <span class="xw-kav-label">震动时长<span class="xw-kav-help">100 至 1000 毫秒</span></span>
          <input data-setting="vibrationMs" type="number" min="100" max="1000" step="50" value="${settings.vibrationMs}">
        </label>
        <div class="xw-kav-status">正在检测设备能力...</div>
        <div class="xw-kav-actions">
          <button class="xw-kav-action" data-action="retry-wake-lock" type="button">重试常亮</button>
          <button class="xw-kav-action" data-action="test-vibration" type="button">测试震动</button>
        </div>
    `;
    panelRoot.appendChild(panel);
    panel.addEventListener('click', (event) => {
      if (event.target.closest('.xw-kav-close')) {
        closePanel();
        return;
      }
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'retry-wake-lock') requestWakeLock(true);
      if (action === 'test-vibration') vibrate([120, 70, 180], true);
    });
    panel.querySelectorAll('[data-setting]').forEach((input) => {
      input.addEventListener('change', async () => {
        const key = input.dataset.setting;
        if (input.type === 'checkbox') settings[key] = input.checked;
        else settings[key] = Math.max(100, Math.min(1000, Number(input.value) || DEFAULT_SETTINGS.vibrationMs));
        input.value = settings[key];
        saveSettings();
        updateFloatingButtonState();
        if (key === 'keepAwake') {
          if (settings.keepAwake) await requestWakeLock(true);
          else await releaseWakeLock();
        }
      });
    });
    doc.body.appendChild(panelHost);
    try {
      panelHost.showModal();
    } catch (error) {
      panelHost.setAttribute('open', '');
      console.warn(`[${SCRIPT_NAME}] showModal 不可用，已使用普通顶层面板`, error);
    }
    panel.focus();
    if (settings.keepAwake) requestWakeLock(false);
    else setPanelStatus('常亮已关闭');
  }

  function bindTavernHelperButton() {
    const handler = () => openPanel();
    try {
      if (typeof window.getButtonEvent === 'function' && typeof window.eventOn === 'function') {
        const subscription = window.eventOn(window.getButtonEvent(BUTTON_NAME), handler);
        if (typeof subscription?.stop === 'function') addCleanup(() => subscription.stop());
        return true;
      }
      if (typeof window.eventOnButton === 'function') {
        window.eventOnButton(BUTTON_NAME, handler);
        return true;
      }
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] 注册酒馆助手按钮失败，使用浮动按钮`, error);
    }
    return false;
  }

  function bindGenerationEvents() {
    if (typeof window.eventOn !== 'function' || !window.tavern_events) return false;
    try {
      const events = window.tavern_events;
      const subscriptions = [
        window.eventOn(events.GENERATION_STARTED, () => { runtime.generationActive = true; }),
        window.eventOn(events.GENERATION_STOPPED, () => { runtime.generationActive = false; }),
        window.eventOn(events.GENERATION_ENDED, () => {
          if (!runtime.generationActive) return;
          runtime.generationActive = false;
          if (settings.vibrateOnComplete) vibrate(Number(settings.vibrationMs) || DEFAULT_SETTINGS.vibrationMs);
        }),
      ];
      subscriptions.forEach((subscription) => {
        if (typeof subscription?.stop === 'function') addCleanup(() => subscription.stop());
      });
      return true;
    } catch (error) {
      console.warn(`[${SCRIPT_NAME}] 注册生成事件失败`, error);
      return false;
    }
  }

  function installFloatingButtonGuard() {
    const doc = getHostDocument();
    const Observer = getHostWindow().MutationObserver;
    if (!doc.body || !Observer) return;
    runtime.observer?.disconnect();
    runtime.observer = new Observer(() => {
      if (runtime.stopping || findUiElement(FLOATING_BUTTON_ID)) return;
      ensureFloatingButton();
    });
    runtime.observer.observe(doc.body, { childList: true, subtree: true });
    addCleanup(() => runtime.observer?.disconnect());
    [300, 900, 1800, 3500].forEach((delay) => {
      const timer = getHostWindow().setTimeout(() => {
        if (!runtime.stopping) ensureFloatingButton();
      }, delay);
      runtime.repairTimers.push(timer);
    });
    addCleanup(() => runtime.repairTimers.splice(0).forEach((timer) => getHostWindow().clearTimeout(timer)));
  }

  function stopInstance() {
    if (runtime.stopping) return;
    runtime.stopping = true;
    releaseWakeLock();
    runtime.cleanups.splice(0).reverse().forEach((cleanup) => {
      try { cleanup(); } catch (_) {}
    });
    const doc = getHostDocument();
    doc.getElementById(WIDGET_ID)?.remove();
    doc.getElementById(PANEL_HOST_ID)?.remove();
    for (const target of getAccessibleWindows()) {
      try {
        if (target[INSTANCE_KEY]?.instanceId === runtime.instanceId) delete target[INSTANCE_KEY];
        if (target[LEGACY_INSTANCE_KEY]?.instanceId === runtime.instanceId) delete target[LEGACY_INSTANCE_KEY];
      } catch (_) {}
    }
  }

  function claimGlobalInstance() {
    for (const target of getAccessibleWindows()) {
      try {
        const previous = target[INSTANCE_KEY] || target[LEGACY_INSTANCE_KEY];
        if (previous?.stop && previous.instanceId !== runtime.instanceId) previous.stop();
      } catch (_) {}
    }
    const publicInstance = {
      instanceId: runtime.instanceId,
      version: SCRIPT_VERSION,
      stop: stopInstance,
      openPanel,
      togglePanel: openPanel,
    };
    for (const target of getAccessibleWindows()) {
      try {
        target[INSTANCE_KEY] = publicInstance;
        target[LEGACY_INSTANCE_KEY] = publicInstance;
      } catch (_) {}
    }
  }

  function register() {
    const doc = getHostDocument();
    if (!doc.head || !doc.body) {
      getHostWindow().setTimeout(register, 120);
      return;
    }
    claimGlobalInstance();
    injectStyle();
    ensureFloatingButton();
    installFloatingButtonGuard();
    const helperButtonRegistered = bindTavernHelperButton();
    const generationEventsRegistered = bindGenerationEvents();
    addListener(doc, 'visibilitychange', () => {
      if (settings.keepAwake && doc.visibilityState === 'visible') requestWakeLock(false);
    });
    if (settings.keepAwake) requestWakeLock(false);
    console.info(`[${SCRIPT_NAME}] ${SCRIPT_VERSION} 初始化完成`, { helperButtonRegistered, generationEventsRegistered });
  }

  addListener(window, 'pagehide', stopInstance, { once: true });
  addListener(window, 'unload', stopInstance, { once: true });
  const initialDocument = getHostDocument();
  if (initialDocument.readyState === 'loading') {
    initialDocument.addEventListener('DOMContentLoaded', register, { once: true });
  } else {
    register();
  }
})();
