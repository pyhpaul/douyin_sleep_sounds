# 抖音云后端设计

## 背景与目标

当前项目已经完成原生抖音小程序前端主链路，真实运行时代码位于 `miniprogram/`，内容数据暂时来自 `miniprogram/data/sounds.js`，并由 `miniprogram/services/soundSourceService.js` 向页面提供声音分组数据。

现在需要开始后端设计，但不希望过早把播放器运行态、定时器、循环状态等前端本地职责搬到云端。后端的第一目标也不是搭一整套用户系统，而是先把“内容中心”建立起来，为后续接入抖音云、内容运营、跨设备同步预留稳定边界。

本设计的目标：

- 保持当前播放器交互与本地运行态不变。
- 把声音内容从本地 mock 平滑迁移到抖音云。
- 保留 `soundSourceService` 作为前端数据源适配层。
- 第一阶段只做只读内容服务。
- 第二阶段再扩展到收藏、历史、偏好等账号级同步数据。

## 范围

本设计包含：

- 抖音云后端选型。
- 前后端职责边界。
- 内容数据模型。
- 第一阶段 API 设计。
- 第二阶段账号同步扩展路径。
- 环境、部署与验收边界。

本设计不包含：

- 后台运营管理界面。
- 推荐算法。
- 付费、会员、订单。
- 用户上传音频。
- 评论、社交、消息。

## 方案选择

最终采用：

- **抖音云函数服务** 作为后端 BFF。
- **MongoDB** 作为内容元数据存储。
- **对象存储 + CDN** 作为音频与封面资源存储与分发。
- **小程序 service 适配层** 作为前端唯一内容入口。

不采用的路径：

### 方案 A：前端直连数据库或存储

不采用原因：

- 页面层会直接耦合云端结构。
- 之后做排序、上下架、灰度、兼容时改动面过大。
- 不利于后续引入登录态和账号级数据。

### 方案 B：抖音云函数服务 + MongoDB + 对象存储

采用原因：

- 当前项目使用 JavaScript，和函数服务的 Node.js 路径最贴近。
- 当前声音内容规模小，但未来会扩展到收藏、历史、偏好等文档型数据，MongoDB 更顺手。
- `soundSourceService` 已经形成天然边界，前端迁移成本低。
- 抖音云支持小程序后端托管、云调用和两套隔离环境，适合作为正式后端入口。

### 方案 C：容器服务 + Redis/MySQL/MongoDB 完整后端

暂不采用原因：

- 当前业务复杂度不足以支撑容器化的额外维护成本。
- 现在更需要把内容链路跑通，而不是一次性引入完整基础设施。

## 总体架构

```text
Douyin Mini App
  -> miniprogram/services/soundSourceService.js
    -> cloud content adapter
      -> Douyin Cloud Function Service
        -> MongoDB
        -> Object Storage + CDN

fallback:
  soundSourceService.js
    -> miniprogram/data/sounds.js
```

架构原则：

1. 页面只依赖 `soundSourceService`，不直接依赖抖音云调用细节。
2. 后端只管理“内容”和“账号级同步数据”，不接管播放器运行态。
3. 本地 mock 继续保留，作为开发期回退和接口故障时的受控兜底。

## 前后端职责边界

### 前端继续负责

- 页面结构与交互状态。
- `tt.getBackgroundAudioManager()` 的调用。
- 播放 / 暂停状态。
- 定时停止。
- 循环播放。
- 当前选中声音。
- 设备级本地缓存：
  - `sleepSounds.currentSoundId`
  - `sleepSounds.isLooping`
  - `sleepSounds.timerMinutes`
  - `sleepSounds.timerEndAt`

边界规则：

- “当前是否正在播放”不写入云端。
- “还有几分钟停止”不写入云端。
- “用户这台设备上最后一次选择了哪个声音”继续保留为本地设备状态，不在第一阶段同步。

### 后端第一阶段负责

- 频道列表。
- 声音列表。
- 音频 URL 与封面 URL。
- 描述文案。
- 排序。
- 上下架状态。
- 推荐位和默认频道配置。
- 内容版本号。

### 后端第二阶段负责

- 收藏。
- 播放历史。
- 偏好设置。
- 跨设备同步。
- 用户维度内容聚合。

## 数据模型

第一阶段建议 3 个集合。

### `sound_groups`

用于管理频道。

```js
{
  _id: ObjectId,
  groupId: "nature",
  title: "自然",
  subtitle: "把自然声放慢，留给入睡前的几分钟。",
  sort: 10,
  status: "published", // draft | published | archived
  createdAt: ISODate,
  updatedAt: ISODate
}
```

索引建议：

- `groupId` 唯一索引
- `status + sort` 复合索引

### `sounds`

用于管理声音元数据。

```js
{
  _id: ObjectId,
  soundId: "rain",
  groupId: "nature",
  title: "雨声",
  category: "自然",
  description: "细密雨声，适合放松和屏蔽环境噪声。",
  audioAssetKey: "sleep-sounds/audio/rain-v1.mp3",
  audioUrl: "https://cdn.example.com/sleep-sounds/audio/rain-v1.mp3",
  coverAssetKey: "sleep-sounds/cover/rain-v1.jpg",
  coverUrl: "https://cdn.example.com/sleep-sounds/cover/rain-v1.jpg",
  durationSec: 0,
  tags: ["sleep", "nature"],
  sort: 10,
  status: "published", // draft | published | archived
  createdAt: ISODate,
  updatedAt: ISODate
}
```

索引建议：

- `soundId` 唯一索引
- `groupId + status + sort` 复合索引

说明：

- `audioAssetKey` / `coverAssetKey` 用于内部追踪对象存储资源。
- `audioUrl` / `coverUrl` 用于直接下发给小程序。
- `category` 作为前端兼容字段继续保留，避免页面改造时强依赖 group title 推导。

### `app_configs`

用于保存聚合配置。

```js
{
  _id: "content-bootstrap",
  featuredGroupIds: ["nature", "white-noise"],
  defaultGroupId: "nature",
  contentVersion: "2026-05-06T16:00:00Z",
  updatedAt: ISODate
}
```

说明：

- `contentVersion` 用于前端识别当前内容快照版本。
- 第一阶段不做复杂配置中心，先控制在一个聚合配置文档内。

## 第一阶段 API 设计

第一阶段只暴露只读内容接口。

### 推荐主接口：`GET /content/bootstrap`

返回首页和播放器初始化所需的全部只读内容。

```js
{
  version: "2026-05-06T16:00:00Z",
  featuredGroupIds: ["nature", "white-noise"],
  defaultGroupId: "nature",
  groups: [
    {
      id: "nature",
      title: "自然",
      subtitle: "把自然声放慢，留给入睡前的几分钟。",
      sounds: [
        {
          id: "rain",
          title: "雨声",
          category: "自然",
          description: "细密雨声，适合放松和屏蔽环境噪声。",
          url: "https://cdn.example.com/sleep-sounds/audio/rain-v1.mp3",
          cover: "https://cdn.example.com/sleep-sounds/cover/rain-v1.jpg"
        }
      ]
    }
  ]
}
```

设计意图：

- 返回结构尽量贴近当前 `soundGroups` 形状。
- 第一阶段避免让前端多次请求频道、声音详情、配置。
- 保证 `soundSourceService.getSoundGroups()` 可以低成本切换到云端实现。

### 可选拆分接口

如果后续内容规模明显增大，再拆为：

- `GET /content/groups`
- `GET /content/groups/:groupId`
- `GET /content/sounds/:soundId`

但在当前阶段不建议预拆，避免为小数据量引入额外复杂度。

## 前端接入方式

### 保持现有 service 边界

`miniprogram/services/soundSourceService.js` 继续作为唯一入口。

建议后续演进为：

```text
soundSourceService.js
  -> getSoundGroups()
    -> if cloud enabled
         call cloud content adapter
       else
         return local sounds mock
```

建议新增但不改变页面依赖方向的文件：

```text
miniprogram/services/
  soundSourceService.js
  cloudContentService.js
  contentMapper.js
```

职责建议：

- `soundSourceService.js`
  - 对页面暴露稳定接口。
  - 决定当前走 mock 还是 cloud。

- `cloudContentService.js`
  - 负责请求抖音云内容接口。
  - 不包含页面映射逻辑。

- `contentMapper.js`
  - 把后端 DTO 映射为当前前端使用的 `soundGroups` 数据结构。

### 回退策略

第一阶段保留本地 mock 回退，但限定用途：

- 本地开发。
- 联调阶段抖音云服务未就绪。
- 服务端接口临时故障时的受控兜底。

长期原则：

- mock 是开发兜底，不是正式生产内容源。
- 页面层永远不知道当前内容来自 mock 还是 cloud。

## 用户体系与第二阶段扩展

第二阶段需要在服务端保存用户维度的数据时，再进入登录与账号同步设计。

### 第二阶段新增集合

#### `users`

```js
{
  _id: ObjectId,
  userId: "usr_xxx",       // 内部用户 ID
  openId: "open_xxx",      // 仅服务端保存
  unionId: "",
  createdAt: ISODate,
  updatedAt: ISODate
}
```

#### `user_favorites`

```js
{
  _id: ObjectId,
  userId: "usr_xxx",
  soundId: "rain",
  createdAt: ISODate
}
```

#### `user_history`

```js
{
  _id: ObjectId,
  userId: "usr_xxx",
  soundId: "rain",
  playedAt: ISODate,
  playSource: "manual"
}
```

#### `user_preferences`

```js
{
  _id: ObjectId,
  userId: "usr_xxx",
  preferredGroupIds: ["nature"],
  updatedAt: ISODate
}
```

### 登录策略

第二阶段采用“服务端持有用户标识，前端只拿业务会话”的策略：

1. 小程序通过 `tt.login` 获取 `code`。
2. 服务端通过 `code2Session` 换取 `open_id` / `session_key`。
3. 服务端保存 `open_id`，生成自己的业务会话凭证。
4. 前端后续访问用户接口时只携带业务会话，不直接使用 `open_id`。

边界规则：

- 不把 `AppSecret` 暴露到前端。
- 不把 `session_key` 暴露到前端。
- 不把 `open_id` 作为前端登录凭证直接下发。

### 为什么第二阶段再做登录

- 当前内容服务是公开只读数据，不需要为读取列表引入登录成本。
- 当前最优先的是把内容供给链路云化，而不是让播放器变成账号系统项目。
- 等到收藏、历史、偏好需要跨设备同步时，再引入用户体系，边界更清晰。

## 环境与部署策略

抖音云默认提供开发环境和线上环境两套隔离资源。

环境约束：

- `dev` 环境用于开发联调。
- `prod` 环境用于正式发布。
- 数据库、服务、权限、配置都按环境隔离。

部署建议：

1. 先在 `dev` 环境建函数服务、MongoDB、对象存储。
2. 先导入当前 mock 内容作为第一版种子数据。
3. 前端联调 `dev` 内容接口。
4. 联调稳定后再同步部署到 `prod`。

资源策略：

- 音频与封面文件上传到对象存储。
- 对外下发 CDN 地址，不直接在前端拼接对象存储路径。
- 元数据版本更新通过数据库文档变更完成，不通过重新发版小程序热修数据。

## 错误处理与可用性策略

### 第一阶段

- 内容接口失败时，前端展示 `声音列表加载失败`。
- 开发态允许回退到本地 mock。
- 如果声音元数据可拉到，但音频 URL 失效，继续沿用当前页面已有音频错误提示链路。

### 第二阶段

- 用户接口失败不影响基础播放功能。
- 收藏、历史、偏好写失败时，不阻断播放。
- 内容读取与用户同步分离，避免一个系统异常拖垮整页启动。

## 迁移路径

### Milestone 3A：内容后端

目标：

- 只把内容从本地 mock 迁移到抖音云。

范围：

- 抖音云函数服务。
- MongoDB 内容集合。
- 对象存储资源。
- `GET /content/bootstrap`。
- 前端 `soundSourceService` 云端适配。

不包含：

- 登录。
- 收藏。
- 历史。
- 偏好同步。

### Milestone 3B：账号与同步

目标：

- 在不影响基础播放的前提下，增加用户维度同步能力。

范围：

- `tt.login` 接入。
- `code2Session` 服务端换取用户标识。
- `users` / `user_favorites` / `user_history` / `user_preferences`。
- 收藏与历史接口。

## 验收标准

### 设计验收

- 前后端职责边界清晰。
- 第一阶段不把播放器运行态上云。
- `soundSourceService` 仍是页面唯一内容入口。
- 第二阶段用户同步路径已定义，但不阻塞第一阶段实施。

### 第一阶段实施验收

- 前端页面代码不直接依赖云数据库结构。
- `soundSourceService.getSoundGroups()` 能从云端取回与当前页面兼容的数据。
- `npm run check`、`npm run debug:page`、`npm test` 保持通过。
- DevTools Lite 和真机下，内容切换到云端后播放行为与当前一致。

## 风险与约束

- 抖音云接口调用方式在不同产品线文档中有细节差异，实施时需要以小程序当前可用的官方调用链路做一次最小验证。
- 如果未来内容规模增长很快，`/content/bootstrap` 可能需要拆分，但当前阶段不应预优化。
- 音频资源正式上线前必须替换掉当前示例调试资源。
- 第二阶段进入账号同步后，需要补充用户隐私、数据删除、授权提示等产品与合规设计。

## 官方依据

- 抖音小程序抖音云入口页说明支持免登录、云调用、抖音回调，并提供小程序接入抖音云能力入口。  
  https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/dev-tools/cloud

- 抖音云接入指南说明当前可选择容器服务或函数服务，函数服务支持 Node.js。  
  https://developer.open-douyin.com/docs/resource/zh-CN/interaction/develop/douyincloud/guide

- 抖音云账号入驻文档说明每个小程序默认有开发、线上两套隔离环境。  
  https://developer.open-douyin.com/docs/resource/zh-CN/developer/tools/cloud/develop-guide/prepare/account

- 抖音云产品定价页列出对象存储、MongoDB、MySQL、Redis 等可选组件。  
  https://developer.open-douyin.com/docs/resource/zh-CN/developer/tools/cloud/charge/price

- 小程序登录文档说明：纯工具类应用如果不在服务端保存用户信息，可以不接登录；若需要跨设备恢复用户数据，应使用服务端保存的唯一用户标识方案。  
  https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/tutorial/basic-ability/microapp-login

- `code2Session` 文档说明 `AppSecret` 和 `session_key` 只能在服务端使用，不应下发到前端。  
  https://developer.open-douyin.com/docs/resource/zh-CN/mini-app/develop/server/basic-abilities/log-in/code-2-session
