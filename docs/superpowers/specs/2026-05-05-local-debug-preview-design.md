# VS Code 本地模拟调试与浏览器预览设计

## 背景与目标

当前抖音小程序主体功能已经实现，但真实渲染和 `tt.*` API 仍依赖抖音开发者工具。为了降低日常开发成本，需要补充一套可在 VS Code 中运行的本地调试能力，让大部分逻辑、页面状态和基础音频交互在导入抖音开发者工具前就能验证。

目标：

- 在 VS Code 里运行页面逻辑测试，模拟抖音小程序运行时。
- 在浏览器里预览深色助眠 UI，并支持点击、播放、暂停、循环和定时停止。
- 提供一键本地调试脚本，减少每次手动运行多条命令。
- 浏览器预览应尽量跟随真实小程序页面变化，避免维护两套完全独立 UI。
- 保持抖音小程序源码不被 Web 预览耦合污染。
- 最终仍以抖音开发者工具作为真实 TTML/TTSS 和后台音频行为的验收入口。

## 范围

包含：

- Node 级页面运行时 mock 测试。
- 浏览器 Web 预览页。
- 本地预览 HTTP server。
- npm scripts。
- VS Code 调试入口。

不包含：

- 把 TTML 编译成 HTML。
- 完整模拟抖音宿主。
- 替代抖音开发者工具。
- 真实验证 `tt.getBackgroundAudioManager()`。
- 真机锁屏和后台播放验证。

## 方案选择

采用“两层本地调试”方案。

### 第一层：Node 运行时 mock 测试

新增：

```text
tests/pageRuntime.test.js
tests/helpers/mockMiniAppRuntime.js
```

`mockMiniAppRuntime.js` 提供：

- `global.Page`
- `global.tt`
- `tt.getBackgroundAudioManager()`
- `tt.getStorageSync()`
- `tt.setStorageSync()`
- `tt.showToast()`
- 页面实例 `setData()`
- 背景音频事件触发方法

测试覆盖：

- `onLoad` 加载声音源。
- 默认选中第一个声音但不自动播放。
- 点击声音后调用背景音频并更新当前项。
- 播放/暂停按钮状态。
- 循环开关状态。
- 定时选择、倒计时、关闭定时。
- `onShow` 恢复后台期间过期的定时并停止音频。
- `onUnload` 不强制停止后台音频。

### 第二层：浏览器 Web 预览

新增：

```text
dev-preview/
  index.html
  preview.js

scripts/
  dev-local.js
  dev-preview-server.js
  transform-ttss.js
```

浏览器预览使用普通 Web 技术模拟小程序界面：

- `index.html`：只保留预览容器和调试提示，不复制完整小程序页面结构。
- `preview.js`：加载与小程序相同的声音源 service，并使用浏览器 `<audio>` 完成播放。
- `transform-ttss.js`：读取真实页面 `pages/index/index.ttss`，转换为浏览器可用 CSS。
- `dev-preview-server.js`：提供本地 HTTP 服务，并把真实页面样式转换后暴露给浏览器。

为降低预览页和真实页漂移，浏览器预览遵循以下约束：

- 复用 `data/sounds.js` 和 `services/soundSourceService.js`。
- 复用 `utils/timer.js`、`utils/playbackState.js` 的状态规则。
- 样式不维护独立 `preview.css`，而是从 `pages/index/index.ttss` 转换生成。
- 预览 DOM 使用与 TTML 相同的 class 名，例如 `.page`、`.hero`、`.now-card`、`.sound-card`、`.controls`。
- 预览只在 `preview.js` 中维护最小 HTML 渲染函数，避免复制小程序页面逻辑。
- 新增测试或脚本检查，保证预览引用的关键 class 在真实 `index.ttss` 中存在。

无法完全自动跟随的内容：

- TTML 指令如 `tt:for`、`tt:if`、`bindtap` 不会被真实编译。
- 如果真实 TTML 结构大幅调整，`preview.js` 的渲染函数仍需要同步调整。
- 预览样式是 TTSS 转换结果，不保证与抖音 WebView 渲染完全一致。

浏览器预览支持：

- 点击声音卡片。
- 当前声音高亮。
- 播放和暂停。
- 使用 `<audio>` 真实播放音频 URL。
- 循环播放。
- 定时倒计时。
- 定时到点停止。
- 切换声音后重播。

浏览器预览不保证：

- TTML/TTSS 编译一致。
- `tt.getBackgroundAudioManager()` 行为一致。
- 抖音宿主后台策略一致。
- 小程序合法域名和音频权限一致。

## npm scripts

新增或调整：

```json
{
  "scripts": {
    "test": "现有测试命令保持可用",
    "check": "现有 JS 语法检查保持可用",
    "dev": "node scripts/dev-local.js",
    "preview": "node scripts/dev-preview-server.js",
    "debug:page": "node --test tests/pageRuntime.test.js"
  }
}
```

预期命令：

```powershell
npm test
npm run check
npm run debug:page
npm run dev
npm run preview
```

浏览器打开：

```text
http://localhost:5173
```

### 一键调试脚本

`npm run dev` 执行：

1. 运行 `npm run check`。
2. 运行 `npm run debug:page`。
3. 启动本地预览 server。
4. 输出预览地址 `http://localhost:5173`。
5. 可选自动打开系统默认浏览器。如果自动打开失败，只打印 URL，不中断 server。

该脚本不调用抖音开发者工具，不要求安装 `tt-ide-cli`。

## 数据流

### Node mock 测试数据流

```text
测试创建 mock runtime
  -> require pages/index/index.js
  -> 捕获 Page 配置对象
  -> 创建页面实例
  -> 调用 onLoad/onShow/事件 handler
  -> 断言 data、storage、audio manager 状态
```

### 浏览器预览数据流

```text
preview.js
  -> 调用 getSoundGroups()
  -> 渲染分类和声音卡片
  -> 用户点击声音
  -> 设置 audio.src
  -> 调用 audio.play()
  -> 更新 UI 状态
```

### 真实页面样式跟随数据流

```text
dev-preview-server.js
  -> 读取 pages/index/index.ttss
  -> transform-ttss.js 转换 rpx 等浏览器不直接识别的单位
  -> 暴露 /preview.css
  -> 浏览器预览页面加载 /preview.css
```

转换规则：

- `rpx` 按固定比例转换为 `px`，默认 `1rpx = 0.5px`。
- 保留颜色、圆角、flex、margin、padding 等通用 CSS。
- 对浏览器不支持或无意义的小程序样式做安全忽略。

## 文件边界

- 小程序生产代码仍在：

```text
pages/
data/
services/
utils/
```

- Node mock 测试只放在：

```text
tests/
```

- 浏览器预览只放在：

```text
dev-preview/
scripts/dev-preview-server.js
scripts/dev-local.js
scripts/transform-ttss.js
```

预览代码可以复用 `services/soundSourceService.js`，但不得让小程序页面依赖 `dev-preview`。

## 测试与验收

自动化验证：

```powershell
npm test
npm run check
npm run debug:page
npm run dev
```

浏览器手工验证：

1. 运行 `npm run dev` 或 `npm run preview`。
2. 打开 `http://localhost:5173`。
3. 页面展示 3 类 6 个声音。
4. 点击声音后当前项高亮。
5. 播放按钮可播放和暂停音频。
6. 循环开关生效。
7. 定时按钮显示倒计时。
8. 定时到点后音频停止。

预览跟随真实页面验证：

1. 修改 `pages/index/index.ttss` 中某个明显样式，例如 `.primary-control` 背景色。
2. 刷新 `http://localhost:5173`。
3. 浏览器预览应体现该样式变化。
4. 恢复样式后再次刷新，预览同步恢复。

最终平台验收仍需：

1. 导入 `E:/douyinProj/test` 到抖音开发者工具。
2. 编译 TTML/TTSS。
3. 验证 `tt.getBackgroundAudioManager()`。
4. 验证真机切后台和定时停止。

## 风险与约束

- 浏览器 `<audio>` 与抖音后台音频不是同一运行时，只能验证基础播放交互。
- 当前 6 个声音使用同一个 mock MP3 URL，切换体验会被弱化；上线前需要换成授权且可区分的音频资源。
- `project.config.json` 当前已有用户改动，后续实现不得覆盖。
- 浏览器预览跟随真实页面主要通过复用 TTSS 和 class 名实现；TTML 结构变化仍需同步调整 `preview.js` 渲染函数。
