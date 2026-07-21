# 屏幕常亮与生成震动

适用于 SillyTavern + TavernHelper 的手机辅助脚本。

## 功能

- 酒馆页面处于前台时保持屏幕常亮。
- 正常生成完毕后触发手机震动，手动停止不震动。
- 常亮和震动可以独立开关。
- 小金色入口按钮支持鼠标或触摸拖动，并会记住位置。
- 可调整震动时长，并提供常亮重试和震动测试。
- 设置保存在当前浏览器的 `localStorage` 中。
- 不轮询、不扫描聊天消息、不修改聊天文件和世界书。

## 安装

在 TavernHelper 脚本库中新建或导入脚本，使用 `tavern-helper-loader.js` 的内容。

入口壳每次运行时加载 `main` 分支上的最新版：

```text
https://cdn.jsdelivr.net/gh/juxingmaomi/keep-awake-vibrate@main/index.js
```

## 浏览器限制

- Android Edge/Chrome 通常同时支持 Wake Lock 和网页震动。
- Wake Lock 通常要求 HTTPS 或浏览器认可的安全环境。
- iPhone/iPad 浏览器通常不支持网页震动。
- 系统省电模式、后台标签页或浏览器权限可能临时释放 Wake Lock；页面回到前台后脚本会自动重试。

## 文件

- `index.js`：插件核心。
- `tavern-helper-loader.js`：建议导入 TavernHelper 的自动更新入口壳。
- `屏幕常亮与生成震动-入口壳.json`：可直接导入 TavernHelper 的成品。
