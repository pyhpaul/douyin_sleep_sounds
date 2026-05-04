# 助眠声音抖音小程序设计

## 背景与目标

在 `E:/douyinProj/test` 创建一个可被抖音开发者工具直接导入和调试的原生小程序。首版产品是一款声音助眠工具，用户可以选择背景声音播放，设置定时停止或循环播放。音频源首版使用本地 mock 配置，同时预留远程接口替换点，便于后续接入后台管理。

成功标准：

- 抖音开发者工具可以导入 `E:/douyinProj/test` 并编译运行。
- 首页以深色助眠风展示 3 个分类、6 个声音。
- 用户可以选择声音、播放、暂停、开启或关闭循环。
- 用户可以选择关闭、15、30、45、60 分钟定时停止。
- 小程序切后台后声音继续播放。
- 播放源当前来自本地配置，后续可通过 service 层切换到远程 API。

## 产品范围

首版只做一个单页助眠声音播放器，重点保证核心播放链路稳定。

包含：

- 声音列表展示。
- 当前播放状态展示。
- 后台音频播放。
- 播放和暂停。
- 循环播放开关。
- 定时停止。
- 本地缓存最近选择、循环状态和定时选项。

不包含：

- 登录。
- 收藏。
- 播放历史列表。
- 付费。
- 用户上传音频。
- 推荐算法。
- 在线后台管理界面。

## 页面与交互设计

页面只有一个主页面：

```text
pages/index/
  index.ttml
  index.ttss
  index.js
  index.json
```

页面从上到下分为四个区块：

1. Header
   - 标题：`晚安声音`
   - 副标题：`选择一段声音，慢慢入睡`

2. 当前播放卡片
   - 当前声音名称。
   - 分类标签。
   - 播放状态：播放中、已暂停、未选择。
   - 定时状态：未开启或剩余时间。

3. 声音列表
   - 3 个分类，每类 2 个声音：
     - 自然：雨声、海浪。
     - 白噪音：篝火、风声。
     - 放松冥想：轻音乐、深呼吸。
   - 当前声音高亮。
   - 点击新声音时立即切换并播放。
   - 点击当前声音时保持选择，不重复重置定时。

4. 控制区
   - 主按钮：播放或暂停。
   - 循环开关。
   - 定时按钮组：关闭、15、30、45、60 分钟。

交互规则：

- 没有选择声音时点击播放，默认播放第一个声音。
- 切换声音时立即播放新声音。
- 定时到点后停止播放，清空倒计时，保留当前声音选择。
- 循环和定时可以同时开启，定时优先。
- 音频加载失败时展示 toast：`声音暂时无法播放，请稍后再试`。

## 方案选择

采用原生抖音小程序 MVP 方案。

原因：

- 项目目录可以直接导入抖音开发者工具。
- 不引入跨端框架和额外构建链路，降低首版风险。
- `tt.getBackgroundAudioManager()` 更符合助眠场景，支持切后台继续播放。
- service 层隔离播放源来源，后续从本地 mock 切换到远程 API 时页面层不需要大改。

暂不采用：

- `src -> dist/douyin` 的工程化构建模式。首版不需要额外构建复杂度。
- uni-app/Taro 等跨端方案。当前目标优先保证抖音小程序调试稳定。

## 文件结构

```text
E:/douyinProj/test/
  project.config.json
  app.js
  app.json
  app.ttss
  package.json

  data/
    sounds.js

  services/
    soundSourceService.js

  utils/
    timer.js
    playbackState.js

  pages/
    index/
      index.json
      index.ttml
      index.ttss
      index.js

  tests/
    timer.test.js
    playbackState.test.js
```

职责边界：

- `data/sounds.js`
  - 保存 3 类 6 个声音的本地 mock 数据。
  - 每个声音包含 `id`、`title`、`category`、`description`、`url`、`cover`。

- `services/soundSourceService.js`
  - 当前从 `data/sounds.js` 返回播放源。
  - 后续远程 API 接入只修改这一层。

- `utils/timer.js`
  - 负责定时选项、分钟转毫秒、剩余时间格式化。
  - 不依赖抖音运行时，使用 Node 测试。

- `utils/playbackState.js`
  - 负责默认声音选择、当前声音高亮、声音切换等纯逻辑。
  - 不依赖抖音运行时，使用 Node 测试。

- `pages/index/index.js`
  - 负责页面编排、背景音频管理器调用、事件处理、本地缓存和页面状态更新。
  - 不承载复杂纯计算逻辑。

## 数据流

页面加载流程：

1. 调用 `soundSourceService.getSoundGroups()` 获取声音分组。
2. 读取本地缓存：
   - 上次选择的声音 ID。
   - 循环开关状态。
   - 上次定时选项。
3. 如果没有历史选择，默认选中第一个声音，但不自动播放。
4. 初始化 `BackgroundAudioManager` 事件监听。

播放流程：

```text
用户点击声音
  -> 更新 currentSoundId
  -> 设置 backgroundAudioManager.title / epname / singer / coverImgUrl / src
  -> 标记播放中
  -> 写入本地缓存
```

播放按钮流程：

```text
如果没有 currentSoundId
  -> 选择第一个声音
设置背景音频元信息和 src
进入播放状态
```

暂停按钮流程：

```text
调用 backgroundAudioManager.pause()
更新 isPlaying 为 false
```

## 音频状态设计

页面核心状态：

```js
{
  soundGroups: [],
  currentSoundId: '',
  isPlaying: false,
  isLooping: false,
  selectedTimerMinutes: 0,
  remainingText: '未开启',
  errorMessage: ''
}
```

后台音频事件：

- `onPlay`：设置 `isPlaying` 为 `true`。
- `onPause`：设置 `isPlaying` 为 `false`。
- `onStop`：设置 `isPlaying` 为 `false`。
- `onEnded`：根据循环和定时状态决定是否重播。
- `onError`：设置 `isPlaying` 为 `false` 并展示错误提示。

循环规则：

- 循环开关存在本地缓存。
- `onEnded` 触发时，如果定时已到点或循环关闭，则停止。
- `onEnded` 触发时，如果循环开启且定时未到点，则重播当前声音。
- 定时优先级高于循环。

定时规则：

- 每次选择新定时前先清理旧定时器。
- 选择 15、30、45、60 分钟时记录目标结束时间 `timerEndAt`。
- 每秒刷新剩余时间展示。
- 选择关闭时清理定时器并显示 `未开启`。
- 到点后停止背景音频、清空倒计时、保留当前声音选择和循环开关。

## 错误处理

- 播放源为空：
  - 页面显示空状态：`暂无可播放声音`。
  - 播放按钮点击后展示提示。

- 音频加载失败：
  - `onError` 中把 `isPlaying` 置为 `false`。
  - 展示 toast：`声音暂时无法播放，请稍后再试`。

- 定时器重复设置：
  - 每次设置前清理旧 interval。

- 页面卸载：
  - 清理倒计时 interval。
  - 不强制停止后台播放，避免用户切页后音乐中断。

- 资源 URL 上线要求：
  - 需要替换为自有版权或已授权音频。
  - 需要在抖音小程序后台配置合法下载或音频资源域名。

## 测试策略

自动化测试只覆盖纯逻辑，不测试抖音运行时 API。

`utils/timer.js` 测试：

- 定时选项为关闭、15、30、45、60 分钟。
- 分钟可以正确转为毫秒。
- 剩余时间可以格式化为 `MM:SS`。
- 到点或超过结束时间时返回 `00:00`。

`utils/playbackState.js` 测试：

- 无历史选择时默认选择第一个声音。
- 有历史选择且存在于列表时恢复历史选择。
- 历史选择不存在时回退第一个声音。
- 当前声音高亮判断正确。
- 空列表时返回空选择。

抖音开发者工具手工验证：

1. 导入 `E:/douyinProj/test`。
2. 项目可以编译运行。
3. 首页深色 UI 正常展示 3 类 6 个声音。
4. 点击任意声音进入播放状态。
5. 播放和暂停按钮状态正确切换。
6. 循环开关可开启和关闭。
7. 定时选项显示倒计时。
8. 关闭定时后倒计时清空。
9. 切换声音后新声音成为当前播放项。
10. 循环开启时音频结束后重播。
11. 循环关闭时音频结束后停止。
12. 小程序切后台后音频继续播放。

## 实施约束

- 代码使用原生抖音小程序语法：TTML、TTSS、JavaScript。
- 首版不接入登录。
- 首版不引入跨端框架。
- 首版不依赖后端服务。
- 首版公开示例 URL 仅用于调试链路，上线前必须替换为授权资源。
- 页面保持简洁，避免首版加入内容运营和社交功能。
