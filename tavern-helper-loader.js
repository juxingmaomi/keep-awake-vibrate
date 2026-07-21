(async () => {
  'use strict';

  const REPO = 'juxingmaomi/keep-awake-vibrate';
  const VERSION = 'v0.1.11';
  const URL = `https://gcore.jsdelivr.net/gh/${REPO}@${VERSION}/index.js`;
  const STATE_KEY = '__XW_KEEP_AWAKE_VIBRATE_LOADER__';
  const CORE_KEY = '__xw_keep_awake_vibrate__';
  const BUTTON_NAME = '屏幕与震动';

  const hostWindow = (() => {
    try {
      if (window.parent && window.parent.document) return window.parent;
    } catch (_) {}
    return window;
  })();

  const state = {
    repo: REPO,
    loadedTag: VERSION,
    url: URL,
    requestedAt: new Date().toISOString(),
  };
  hostWindow[STATE_KEY] = state;

  function popup(type, message) {
    const toastr = hostWindow.toastr || window.toastr;
    if (toastr && typeof toastr[type] === 'function') {
      toastr[type](message, '屏幕与震动');
      return;
    }
    if (type === 'error') alert(message);
    else console.log(`[屏幕与震动] ${message}`);
  }

  try {
    await import(URL);
    const core = hostWindow[CORE_KEY];
    if (!core || typeof core.togglePanel !== 'function') {
      throw new Error('核心脚本没有提供面板接口');
    }
    const buttonHandler = () => {
      state.lastButtonClickAt = new Date().toISOString();
      hostWindow[CORE_KEY]?.togglePanel?.();
    };
    if (typeof window.getButtonEvent === 'function' && typeof window.eventOn === 'function') {
      window.eventOn(window.getButtonEvent(BUTTON_NAME), buttonHandler);
      state.buttonRegistered = 'eventOn';
    } else if (typeof window.eventOnButton === 'function') {
      window.eventOnButton(BUTTON_NAME, buttonHandler);
      state.buttonRegistered = 'eventOnButton';
    } else {
      throw new Error('当前入口壳没有获得 TavernHelper 按钮事件接口');
    }
    state.loadedAt = new Date().toISOString();
    popup('success', `屏幕常亮与生成震动已加载 ${VERSION}`);
  } catch (error) {
    state.error = String(error?.message || error);
    console.error('[屏幕与震动] 入口壳加载失败', error);
    popup('error', `屏幕常亮与生成震动 ${VERSION} 加载失败，请确认该版本已经发布。`);
  }
})();
