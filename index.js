(() => {
  'use strict';

  const INSTANCE_KEY = '__xw_keep_awake_vibrate__';
  const SCRIPT_VERSION = 'v0.1.4';
  const STORAGE_KEY = 'xw_keep_awake_vibrate_settings_v1';
  const ROOT_ID = 'xw-kav-root';
  const STYLE_ID = 'xw-kav-style';

  const hostWindow = (() => {
    try {
      if (window.parent && window.parent.document) return window.parent;
    } catch (_) {}
    return window;
  })();
  const hostDocument = hostWindow.document;

  if (hostWindow[INSTANCE_KEY]?.stop) hostWindow[INSTANCE_KEY].stop();

  const defaults = {
    keepAwake: false,
    vibrateOnComplete: true,
    vibrationMs: 250,
    panelOpen: false,
    fabX: null,
    fabY: null,
  };

  let settings = loadSettings();
  let wakeLock = null;
  let generationActive = false;
  let disposed = false;
  const cleanups = [];

  function loadSettings() {
    try {
      return { ...defaults, ...JSON.parse(hostWindow.localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch (_) {
      return { ...defaults };
    }
  }

  function saveSettings() {
    hostWindow.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function getApi(name) {
    for (const source of [window, hostWindow, hostWindow.parent, hostWindow.top]) {
      try {
        if (source && source[name] != null) return source[name];
      } catch (_) {}
    }
    return null;
  }

  function addListener(target, type, listener, options) {
    target.addEventListener(type, listener, options);
    cleanups.push(() => target.removeEventListener(type, listener, options));
  }

  function toast(message, type = 'info') {
    const toastr = getApi('toastr');
    if (toastr?.[type]) {
      toastr[type](message, '屏幕与震动');
      return;
    }
    console.log(`[屏幕与震动] ${message}`);
  }

  function setStatus(text, tone = '') {
    const node = hostDocument.querySelector(`#${ROOT_ID} .xw-kav-status`);
    if (!node) return;
    node.textContent = text;
    node.dataset.tone = tone;
    const fab = hostDocument.querySelector(`#${ROOT_ID} .xw-kav-fab`);
    if (fab) fab.dataset.awake = tone === 'ok' ? 'on' : 'off';
  }

  async function releaseWakeLock() {
    const lock = wakeLock;
    wakeLock = null;
    if (lock) {
      try {
        await lock.release();
      } catch (_) {}
    }
    if (!settings.keepAwake) setStatus('常亮已关闭');
  }

  async function requestWakeLock(showError = false) {
    if (disposed || !settings.keepAwake) return false;
    if (hostDocument.visibilityState !== 'visible') {
      setStatus('页面回到前台后恢复常亮', 'wait');
      return false;
    }

    const wakeLockApi = hostWindow.navigator?.wakeLock || window.navigator?.wakeLock;
    if (!wakeLockApi?.request) {
      setStatus('当前浏览器不支持屏幕常亮', 'error');
      if (showError) toast('浏览器不支持 Wake Lock；iPhone/iPad 请使用“添加到主屏幕”后再试。', 'warning');
      return false;
    }

    try {
      if (wakeLock && !wakeLock.released) {
        setStatus('屏幕常亮中', 'ok');
        return true;
      }
      wakeLock = await wakeLockApi.request('screen');
      wakeLock.addEventListener('release', () => {
        wakeLock = null;
        if (settings.keepAwake && hostDocument.visibilityState === 'visible') {
          setStatus('常亮被系统暂停，点击重试', 'wait');
        }
      }, { once: true });
      setStatus('屏幕常亮中', 'ok');
      return true;
    } catch (error) {
      setStatus('常亮请求失败，点击重试', 'error');
      if (showError) toast(`无法开启常亮：${error?.message || '浏览器拒绝了请求'}`, 'warning');
      return false;
    }
  }

  function vibrate(pattern, showError = false) {
    const vibrator = hostWindow.navigator?.vibrate || window.navigator?.vibrate;
    if (typeof vibrator !== 'function') {
      if (showError) toast('当前浏览器或设备不支持网页震动。', 'warning');
      return false;
    }
    try {
      const ok = vibrator.call(hostWindow.navigator, pattern);
      if (showError && ok === false) toast('浏览器未允许震动，请检查系统设置。', 'warning');
      return ok !== false;
    } catch (error) {
      if (showError) toast(`震动失败：${error?.message || '未知错误'}`, 'warning');
      return false;
    }
  }

  function render() {
    hostDocument.getElementById(ROOT_ID)?.remove();
    if (!hostDocument.getElementById(STYLE_ID)) {
      const style = hostDocument.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        #${ROOT_ID} { position: fixed; inset: 0; z-index: 100000; pointer-events: none; font-family: inherit; color: var(--SmartThemeBodyColor, #eee); }
        #${ROOT_ID} * { box-sizing: border-box; letter-spacing: 0; }
        #${ROOT_ID} .xw-kav-fab { position: fixed; width: 34px; height: 34px; padding: 0; border: 1px solid rgba(185, 192, 199, .5); border-radius: 50%; background: rgba(38, 35, 31, .82); color: transparent; box-shadow: 0 4px 14px rgba(0, 0, 0, .35); cursor: pointer; font-size: 0; opacity: .82; pointer-events: auto; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; transition: opacity .12s ease, box-shadow .12s ease, transform .12s ease; }
        #${ROOT_ID} .xw-kav-fab::after { content: ''; position: absolute; left: 50%; top: 50%; width: 16px; height: 16px; border-radius: 50%; background: #e24d55; box-shadow: 0 0 8px rgba(226, 77, 85, .62); transform: translate(-50%, -50%); transition: background .12s ease, box-shadow .12s ease; }
        #${ROOT_ID} .xw-kav-fab[data-awake='on'] { opacity: .98; box-shadow: 0 0 12px rgba(61, 220, 132, .32), 0 4px 14px rgba(0, 0, 0, .35); }
        #${ROOT_ID} .xw-kav-fab[data-awake='on']::after { background: #3ddc84; box-shadow: 0 0 9px rgba(61, 220, 132, .72); }
        #${ROOT_ID} .xw-kav-fab:active { cursor: pointer; }
        #${ROOT_ID} .xw-kav-panel { position: fixed; right: 14px; bottom: calc(88px + env(safe-area-inset-bottom)); width: min(340px, calc(100vw - 28px)); padding: 14px; border: 1px solid var(--SmartThemeBorderColor, #666); border-radius: 8px; background: var(--SmartThemeBlurTintColor, rgba(30,30,34,.97)); box-shadow: 0 10px 28px rgba(0,0,0,.38); backdrop-filter: blur(10px); pointer-events: auto; }
        #${ROOT_ID} .xw-kav-panel[hidden] { display: none; }
        #${ROOT_ID} .xw-kav-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        #${ROOT_ID} .xw-kav-title { margin: 0; font-size: 16px; line-height: 1.3; }
        #${ROOT_ID} .xw-kav-close { width: 34px; height: 34px; border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 22px; }
        #${ROOT_ID} .xw-kav-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; min-height: 48px; border-top: 1px solid color-mix(in srgb, currentColor 16%, transparent); }
        #${ROOT_ID} .xw-kav-label { font-size: 14px; font-weight: 600; }
        #${ROOT_ID} .xw-kav-help { display: block; margin-top: 2px; font-size: 12px; font-weight: 400; opacity: .72; line-height: 1.35; }
        #${ROOT_ID} input[type='checkbox'] { width: 20px; height: 20px; accent-color: #32b67a; cursor: pointer; }
        #${ROOT_ID} input[type='number'] { width: 78px; min-height: 34px; padding: 5px 8px; border: 1px solid var(--SmartThemeBorderColor, #666); border-radius: 6px; background: var(--SmartThemeBlurTintColor, #222); color: inherit; }
        #${ROOT_ID} .xw-kav-status { min-height: 34px; margin: 10px 0; padding: 8px 10px; border-radius: 6px; background: rgba(127,127,127,.16); font-size: 12px; line-height: 1.45; }
        #${ROOT_ID} .xw-kav-status[data-tone='ok'] { color: #63d69b; }
        #${ROOT_ID} .xw-kav-status[data-tone='wait'] { color: #f0c56a; }
        #${ROOT_ID} .xw-kav-status[data-tone='error'] { color: #ff8585; }
        #${ROOT_ID} .xw-kav-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        #${ROOT_ID} .xw-kav-action { min-height: 38px; border: 1px solid var(--SmartThemeBorderColor, #666); border-radius: 6px; background: rgba(127,127,127,.16); color: inherit; cursor: pointer; font: inherit; font-size: 13px; }
        @media (max-width: 520px) { #${ROOT_ID} .xw-kav-panel { right: 10px; bottom: calc(82px + env(safe-area-inset-bottom)); width: calc(100vw - 20px); } }
      `;
      hostDocument.head.appendChild(style);
    }

    const root = hostDocument.createElement('div');
    root.id = ROOT_ID;
    root.innerHTML = `
      <section class="xw-kav-panel" ${settings.panelOpen ? '' : 'hidden'} aria-label="屏幕与震动设置">
        <div class="xw-kav-head">
          <h2 class="xw-kav-title">屏幕与震动 <small style="font-size:11px;opacity:.62">${SCRIPT_VERSION}</small></h2>
          <button class="xw-kav-close" type="button" title="关闭面板" aria-label="关闭面板">&times;</button>
        </div>
        <label class="xw-kav-row">
          <span class="xw-kav-label">保持屏幕常亮<span class="xw-kav-help">酒馆页面在前台时阻止自动熄屏</span></span>
          <input data-setting="keepAwake" type="checkbox" ${settings.keepAwake ? 'checked' : ''}>
        </label>
        <label class="xw-kav-row">
          <span class="xw-kav-label">生成完毕震动<span class="xw-kav-help">正常生成结束时提醒，手动停止不提醒</span></span>
          <input data-setting="vibrateOnComplete" type="checkbox" ${settings.vibrateOnComplete ? 'checked' : ''}>
        </label>
        <label class="xw-kav-row">
          <span class="xw-kav-label">震动时长<span class="xw-kav-help">100 至 1000 毫秒</span></span>
          <input data-setting="vibrationMs" type="number" min="100" max="1000" step="50" value="${settings.vibrationMs}">
        </label>
        <div class="xw-kav-status">正在检测设备能力...</div>
        <div class="xw-kav-actions">
          <button class="xw-kav-action xw-kav-retry" type="button">重试常亮</button>
          <button class="xw-kav-action xw-kav-test" type="button">测试震动</button>
        </div>
      </section>
      <button class="xw-kav-fab" type="button" title="屏幕与震动设置" aria-label="打开屏幕与震动设置"></button>
    `;
    hostDocument.body.appendChild(root);

    const panel = root.querySelector('.xw-kav-panel');
    const fab = root.querySelector('.xw-kav-fab');
    let suppressFabClickUntil = 0;

    const setPanelOpen = (open) => {
      settings.panelOpen = open;
      panel.hidden = !open;
      saveSettings();
    };

    const placeFab = (x, y, persist = false) => {
      const margin = 6;
      const size = 34;
      const maxX = Math.max(margin, hostWindow.innerWidth - size - margin);
      const maxY = Math.max(margin, hostWindow.innerHeight - size - margin);
      const nextX = Math.min(maxX, Math.max(margin, Number(x)));
      const nextY = Math.min(maxY, Math.max(margin, Number(y)));
      fab.style.left = `${nextX}px`;
      fab.style.top = `${nextY}px`;
      if (persist) {
        settings.fabX = nextX;
        settings.fabY = nextY;
        saveSettings();
      }
    };

    const initialX = Number.isFinite(Number(settings.fabX)) && settings.fabX !== null
      ? Number(settings.fabX)
      : hostWindow.innerWidth - 52;
    const initialY = Number.isFinite(Number(settings.fabY)) && settings.fabY !== null
      ? Number(settings.fabY)
      : hostWindow.innerHeight - 126;
    placeFab(initialX, initialY, false);

    const onResize = () => placeFab(
      Number.parseFloat(fab.style.left) || initialX,
      Number.parseFloat(fab.style.top) || initialY,
      true,
    );
    addListener(hostWindow, 'resize', onResize);

    fab.addEventListener('pointerdown', (event) => {
      if (event.button != null && event.button !== 0) return;
      const rect = fab.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const originX = rect.left;
      const originY = rect.top;
      let moved = false;
      try { fab.setPointerCapture?.(event.pointerId); } catch (_) {}

      const onMove = (moveEvent) => {
        if (moveEvent.pointerId !== event.pointerId) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
        if (moved) {
          moveEvent.preventDefault();
          placeFab(originX + dx, originY + dy, false);
        }
      };
      const cleanupPointer = () => {
        hostWindow.removeEventListener('pointermove', onMove);
        hostWindow.removeEventListener('pointerup', onEnd);
        hostWindow.removeEventListener('pointercancel', onCancel);
      };
      const onEnd = (endEvent) => {
        if (endEvent.pointerId !== event.pointerId) return;
        cleanupPointer();
        suppressFabClickUntil = Date.now() + 420;
        if (moved) {
          placeFab(Number.parseFloat(fab.style.left), Number.parseFloat(fab.style.top), true);
        } else {
          setPanelOpen(panel.hidden);
        }
      };
      const onCancel = (cancelEvent) => {
        if (cancelEvent.pointerId !== event.pointerId) return;
        cleanupPointer();
      };
      hostWindow.addEventListener('pointermove', onMove, { passive: false });
      hostWindow.addEventListener('pointerup', onEnd, { passive: false });
      hostWindow.addEventListener('pointercancel', onCancel, { passive: true });
    });

    fab.addEventListener('click', () => {
      if (Date.now() >= suppressFabClickUntil) setPanelOpen(panel.hidden);
    });
    root.querySelector('.xw-kav-close').addEventListener('click', () => setPanelOpen(false));
    root.querySelector('.xw-kav-retry').addEventListener('click', () => requestWakeLock(true));
    root.querySelector('.xw-kav-test').addEventListener('click', () => vibrate([120, 70, 180], true));

    root.querySelectorAll('[data-setting]').forEach((input) => {
      input.addEventListener('change', async () => {
        const key = input.dataset.setting;
        if (input.type === 'checkbox') settings[key] = input.checked;
        else settings[key] = Math.max(100, Math.min(1000, Number(input.value) || defaults.vibrationMs));
        input.value = settings[key];
        saveSettings();
        if (key === 'keepAwake') {
          if (settings.keepAwake) await requestWakeLock(true);
          else await releaseWakeLock();
        }
      });
    });

    if (!settings.keepAwake) setStatus('常亮已关闭');
    else requestWakeLock(false);
  }

  function bindTavernEvents() {
    const eventOn = getApi('eventOn');
    const tavernEvents = getApi('tavern_events');
    if (typeof eventOn !== 'function' || !tavernEvents) {
      toast('未找到酒馆助手事件接口，生成完毕震动暂不可用。', 'warning');
      return;
    }

    const subscriptions = [
      eventOn(tavernEvents.GENERATION_STARTED, () => { generationActive = true; }),
      eventOn(tavernEvents.GENERATION_STOPPED, () => { generationActive = false; }),
      eventOn(tavernEvents.GENERATION_ENDED, () => {
        if (!generationActive) return;
        generationActive = false;
        if (settings.vibrateOnComplete) vibrate(Number(settings.vibrationMs) || defaults.vibrationMs);
      }),
    ];
    for (const unsubscribe of subscriptions) {
      if (typeof unsubscribe === 'function') cleanups.push(unsubscribe);
    }
  }

  function stop() {
    if (disposed) return;
    disposed = true;
    releaseWakeLock();
    for (const cleanup of cleanups.splice(0).reverse()) {
      try { cleanup(); } catch (_) {}
    }
    hostDocument.getElementById(ROOT_ID)?.remove();
    hostDocument.getElementById(STYLE_ID)?.remove();
    if (hostWindow[INSTANCE_KEY]?.stop === stop) delete hostWindow[INSTANCE_KEY];
  }

  hostWindow[INSTANCE_KEY] = { stop };
  addListener(hostDocument, 'visibilitychange', () => {
    if (settings.keepAwake && hostDocument.visibilityState === 'visible') requestWakeLock(false);
  });
  addListener(window, 'pagehide', stop, { once: true });

  render();
  bindTavernEvents();
})();
