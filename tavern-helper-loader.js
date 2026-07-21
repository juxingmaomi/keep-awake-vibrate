(async () => {
  'use strict';

  const REPO = 'juxingmaomi/keep-awake-vibrate';
  const VERSION = 'v0.1.14';
  const URL = `https://gcore.jsdelivr.net/gh/${REPO}@${VERSION}/index.js`;
  const STATE_KEY = '__XW_KEEP_AWAKE_VIBRATE_LOADER__';

  const accessibleWindows = [];
  let currentWindow = window;
  for (let index = 0; index < 8; index += 1) {
    if (!accessibleWindows.includes(currentWindow)) accessibleWindows.push(currentWindow);
    try {
      if (!currentWindow.parent || currentWindow.parent === currentWindow || !currentWindow.parent.document) break;
      currentWindow = currentWindow.parent;
    } catch (_) {
      break;
    }
  }
  const getWindowArea = (target) => {
    try {
      const doc = target.document;
      return (target.innerWidth || doc.documentElement.clientWidth || 0)
        * (target.innerHeight || doc.documentElement.clientHeight || 0);
    } catch (_) {
      return 0;
    }
  };
  const hostWindow = accessibleWindows.reduce(
    (best, candidate) => getWindowArea(candidate) >= getWindowArea(best) ? candidate : best,
    window,
  );

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
    state.loadedAt = new Date().toISOString();
    popup('success', `屏幕常亮与生成震动已加载 ${VERSION}`);
  } catch (error) {
    state.error = String(error?.message || error);
    console.error('[屏幕与震动] 入口壳加载失败', error);
    popup('error', `屏幕常亮与生成震动 ${VERSION} 加载失败，请确认该版本已经发布。`);
  }
})();
