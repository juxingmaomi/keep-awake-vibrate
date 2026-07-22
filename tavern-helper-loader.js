(async () => {
  const REPO = 'juxingmaomi/keep-awake-vibrate';
  const VERSION = 'v0.2.8';
  const URL = `https://gcore.jsdelivr.net/gh/${REPO}@${VERSION}/index.js`;

  const loaderState = {
    repo: REPO,
    loadedTag: VERSION,
    source: 'manual',
    url: URL,
    requestedAt: new Date().toISOString(),
  };
  window.__XW_KEEP_AWAKE_VIBRATE_LOADER__ = loaderState;

  function popup(type, message) {
    try {
      const toastr = window.toastr || window.parent && window.parent.toastr;
      if (toastr && typeof toastr[type] === 'function') {
        toastr[type](message);
        return;
      }
    } catch (_) {}
    if (type === 'error') alert(message);
    else console.log(`[keep-awake-vibrate] ${message}`);
  }

  try {
    await import(URL);
    loaderState.loadedAt = new Date().toISOString();
    popup('success', `屏幕常亮与生成震动已加载 ${VERSION}`);
  } catch (error) {
    loaderState.error = String(error && error.message || error);
    console.error('[keep-awake-vibrate] Load failed.', error);
    popup('error', `屏幕常亮与生成震动 ${VERSION} 加载失败。请确认 GitHub 已发布这个版本。`);
  }
})();
