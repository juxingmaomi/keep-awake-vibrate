# 屏幕常亮与生成震动

适用于 SillyTavern + TavernHelper 的轻量脚本。

## 功能

- 酒馆页面位于前台时优先申请 Screen Wake Lock；局域网 HTTP 无法使用原生接口时自动启用兼容视频保活。
- 正常生成结束后触发手机震动，手动停止不震动。
- 红色小按钮表示常亮关闭，绿色表示常亮开启。
- 小按钮可拖动，手机与电脑都可直接点击打开设置面板。
- 同时保留 TavernHelper 的“屏幕与震动”备用按钮。
- 设置保存在当前浏览器的 `localStorage` 中。

## 安装与更新

导入 `屏幕常亮与生成震动-入口壳.json`，或将 `tavern-helper-loader.js` 放进 TavernHelper 脚本。

手动更新只需修改入口壳中的版本号：

```js
const VERSION = 'v0.2.5';
```

固定版本 CDN 地址：

```text
https://gcore.jsdelivr.net/gh/juxingmaomi/keep-awake-vibrate@v0.2.5/index.js
```

## 浏览器限制

- Wake Lock 需要安全上下文；局域网 HTTP 下脚本会改用 NoSleep.js 风格的短视频兼容保活。
- Edge/Chromium 常亮成功开启后，通常不会受系统“最长 10 分钟”网页熄屏计时限制。
- 页面切到后台、浏览器被系统冻结或省电策略强制介入时，锁可能暂时释放；返回前台后脚本会重新申请。
- 兼容保活可能受手机厂商的激进省电策略影响，可靠性不完全等同于原生 Wake Lock。
- 网页震动是否生效取决于手机硬件、浏览器权限和系统设置。
