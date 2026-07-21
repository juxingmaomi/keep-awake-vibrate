(async () => {
  'use strict';

  const REPO = 'juxingmaomi/keep-awake-vibrate';
  const BRANCH = 'main';
  const CACHE_BUSTER = Date.now();
  const URL = `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/index.js?v=${CACHE_BUSTER}`;
  const STATE_KEY = '__XW_KEEP_AWAKE_VIBRATE_LOADER__';

  const hostWindow = (() => {
    try {
      if (window.parent && window.parent.document) return window.parent;
    } catch (_) {}
    return window;
  })();

  const state = {
    repo: REPO,
    branch: BRANCH,
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
    state.loadedAt = new Date().toISOString();
    popup('success', '屏幕常亮与生成震动已加载最新版');
  } catch (error) {
    state.error = String(error?.message || error);
    console.error('[屏幕与震动] 入口壳加载失败', error);
    popup('error', '最新版加载失败，请检查网络后重载酒馆。');
  }
})();
