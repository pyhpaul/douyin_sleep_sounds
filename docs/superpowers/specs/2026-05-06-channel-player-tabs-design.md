# 频道首页与播放器 Tab 设计

## 背景

当前首页以播放器主卡为首屏，下方展示全部频道。用户想换频道或换声音时需要向下拖动，尤其在移动端小程序里操作不顺。调研 Apple Music、Spotify 与 Material Tabs 后，决定采用频道优先的信息架构：频道浏览作为默认首页，播放器作为独立 Tab，底部保留 MiniPlayer。

## 目标

- 默认进入“频道”页，优先解决“选一个声音播放”的主任务。
- 顶部一级 Tab 在“频道”和“播放器”之间切换。
- 频道页提供频道 Tab，只展示当前频道下的声音。
- 每个声音项右侧提供播放按钮，减少进入播放器页的步骤。
- 底部 MiniPlayer 常驻，展示当前声音、状态和播放/暂停入口。
- 点击 MiniPlayer 信息区进入播放器 Tab。

## 非目标

- 不接入后端。
- 不引入组件框架。
- 不恢复 Web Preview。
- 不做收藏、历史、推荐、会员等功能。

## 交互规则

### 一级 Tab

- `pageMode = "channels"`：展示频道页。
- `pageMode = "player"`：展示播放器页。
- 默认值为 `"channels"`。

### 频道 Tab

- `activeGroupId` 表示当前频道。
- 默认选中当前声音所在频道；如果没有当前声音，则选中第一个频道。
- 点击频道 Tab 只切换频道，不自动播放、不改变当前声音。
- 频道页只渲染当前频道的声音列表。

### 播放

- 点击声音项或声音项右侧播放按钮：
  - 设置 `currentSoundId`。
  - 立即播放该声音。
  - 将 `activeGroupId` 同步到该声音所属频道。
  - MiniPlayer 和播放器页同步更新。

### MiniPlayer

- 有声音数据时显示。
- 信息区点击后切到播放器 Tab。
- 右侧按钮调用现有播放/暂停逻辑。

## 数据形状

新增页面数据：

```js
{
  pageMode: "channels",
  activeGroupId: "",
  soundGroupTabs: [
    { id, title, isActive }
  ],
  activeSoundGroup: {
    id,
    title,
    subtitle,
    sounds: []
  }
}
```

## 文件边界

- `miniprogram/utils/playbackState.js`
  - 负责频道选择、频道 Tab view model、当前频道 view model。
- `miniprogram/pages/index/index.js`
  - 负责页面事件编排、调用 view model helper、播放逻辑。
- `miniprogram/pages/index/index.ttml`
  - 负责频道页、播放器页、MiniPlayer 结构。
- `miniprogram/pages/index/index.ttss`
  - 负责 Tab、频道列表、MiniPlayer、播放器样式。
- `tests/playbackState.test.js`
  - 覆盖频道选择纯逻辑。
- `tests/pageRuntime.test.js`
  - 覆盖页面交互行为。

## 验收

- `npm run check` 通过。
- `npm run debug:page` 通过。
- `npm test` 通过。
- DevTools Lite 模式下默认看到频道页，而不是先看到完整播放器。
- 可通过频道 Tab 快速切换分类。
- 可从 MiniPlayer 进入播放器页。
