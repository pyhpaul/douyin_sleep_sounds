# UI 改版与抖音云后端里程碑设计

## 背景

当前项目是原生抖音小程序，真实运行时代码位于 `miniprogram/`。早期为提升本地反馈速度加入过 `dev-preview/` 浏览器预览链路，但该链路需要维护一套独立 HTML 结构，容易与 TTML/TTSS 真实 UI 分叉。抖音开发者工具 Lite 模式已经能承担快速预览职责，因此不再保留 Web Preview。

## 关键决策

- 真实 UI 只维护在 `miniprogram/pages/index/index.ttml` 与 `index.ttss`。
- 快速预览以抖音开发者工具 Lite 模式为准。
- Node 测试只覆盖语法、纯逻辑和页面运行时状态，不模拟完整 UI 渲染。
- 删除 `dev-preview/`、preview server、live reload、TTSS-to-CSS 转换器和相关测试。
- `douyin-miniapp-faststart` 全局 skill 更新为默认不创建 Web Preview。

## Milestone 1: 删除 Web Preview 并建立当前基线

目标：清理已确认无长期价值的 Web Preview 技术债，把当前小程序状态作为后续 UI/后端工作的基线。

范围：

- 删除 `dev-preview/`。
- 删除 `scripts/dev-preview-server.js`。
- 删除 `scripts/dev-local.js` 和 `scripts/dev-local.cmd`。
- 删除 `scripts/live-reload.js`。
- 删除 `scripts/transform-ttss.js`。
- 删除 `tests/devPreviewServer.test.js` 和 `tests/devLocal.test.js`。
- 从 `package.json` 移除 `preview` 和 `dev` scripts。
- 更新 `scripts/check-syntax.js`，只检查仍存在的运行时和工具文件。
- 新增 tooling 测试，防止 Web Preview 入口回流。
- 在验证通过后提交并打 baseline tag。

建议 tag：

```text
baseline/no-web-preview
```

验收：

- `npm run check` 通过。
- `npm test` 通过。
- 仓库不再暴露 `npm run preview` 或 `npm run dev` 的 Web Preview 入口。
- `dev-preview/` 不存在。

## Milestone 2: 播放器式 UI 改版

目标：把当前偏 Web 落地页的首页改成移动端音乐播放器/电台风格。

设计方向：

- 以当前播放为首页主视觉。
- 当前声音区使用更强的播放器卡片和封面/唱片视觉。
- 播放/暂停改为主操作按钮，循环和定时作为辅助控制。
- 声音分类保留频道感，但信息密度低于当前播放区。
- 保持深色助眠氛围，不引入复杂组件或跨端框架。

主要文件：

- `miniprogram/pages/index/index.ttml`
- `miniprogram/pages/index/index.ttss`
- 必要时少量调整 `miniprogram/pages/index/index.js` 的 view model 字段。

验收：

- DevTools Lite 模式下视觉更像播放器/电台小程序，而不是 Web 页面。
- 播放、暂停、切换声音、循环、定时行为保持不变。
- `npm run check` 和 `npm run debug:page` 通过。

## Milestone 3: 抖音云后端设计

目标：先定义后端边界和数据模型，再接入抖音云实现。

前端继续负责：

- 播放状态。
- 页面交互。
- 设备级本地缓存：
  - `sleepSounds.currentSoundId`
  - `sleepSounds.isLooping`
  - `sleepSounds.timerMinutes`
  - `sleepSounds.timerEndAt`

抖音云后续负责：

- 声音分类与声音列表。
- 音频 URL 与封面资源元数据。
- 运营排序、上架状态、推荐配置。
- 账号级收藏、历史、偏好等可跨设备同步的数据。

第一阶段接口只做只读内容：

```text
getSoundGroups()
  -> local mock fallback
  -> future Douyin Cloud content source
```

`miniprogram/services/soundSourceService.js` 保持为数据源适配层，避免页面直接依赖云端实现。

## 后续实施顺序

1. 完成 Milestone 1 的删除和 baseline tag。
2. 基于 tag 后的新提交做 UI 改版。
3. UI 稳定后写抖音云数据模型与接口计划。
4. 最后再进入抖音云接入实现。

## 风险与约束

- 删除 Web Preview 后，浏览器内快速 UI 反馈不再可用；接受该取舍，统一以 DevTools Lite 为准。
- DevTools Lite 仍不能完全替代真机，后台音频、生命周期、权限、登录相关行为需要真机验证。
- 旧的 local debug preview 设计文档和计划保留为历史记录，不代表当前架构方向。
