# VM 内容源与多 Provider 设计

## 背景

当前项目的播放主链路已经稳定，但内容源已经出现分叉：

- `miniprogram/debug/sounds.js`：当前 UI 调试实际使用的数据。
- `cloud/seed/content.seed.json`：为抖音云内容后端 scaffold 准备的数据。

这两套数据在分组数量、声音数量、资源地址策略上都不一致。继续沿着现状推进，会同时引入两个问题：

1. **内容维护成本持续上升**：每次改频道、文案、封面、音频都要改两处甚至三处。
2. **部署方式和内容数据耦合**：当前后端是否放在抖音云、VM 或本地 mock，会倒逼改内容文件本身。

本设计要先解决“唯一内容源”和“多部署目标切换”两个问题，再决定正式后端最终落在哪。

## 目标

- 只维护一份内容源，避免前端 mock、VM 后端、未来云端 seed 三套内容长期分叉。
- 当前阶段优先支持 **VM 部署**，降低抖音云 MongoDB 和对象存储的持续成本。
- 保持前端页面层无感知，继续只通过 `miniprogram/services/soundSourceService.js` 获取内容。
- 为未来切回抖音云保留平滑路径，不重写前端协议。

## 非目标

- 当前阶段不建设后台运营台。
- 不引入登录、收藏、历史、偏好同步。
- 不在本阶段完成对象存储/CDN 正式接入。
- 不为了 VM 方案删除现有抖音云 scaffold；云路径只降级为非主线路径。

## 方案选择

### 方案 A：继续直接推进抖音云 MongoDB + 云函数

优点：

- 和未来正式线上形态一致。
- 平台内联调路径最直接。

问题：

- 当前阶段已经出现持续计费压力。
- 现有内容源仍然分叉，没有解决维护问题。
- 对当前只读内容场景来说，数据库和云资源偏重。

不采用，原因是**先把部署目标放到云上，并不能解决内容模型和内容维护边界问题**。

### 方案 B：VM + MongoDB

优点：

- 比抖音云成本更可控。
- 数据结构和未来正式架构接近。

问题：

- 当前内容是典型的读多写少，只靠 MongoDB 仍然偏重。
- 仍然没有天然解决“唯一内容源”的问题。

暂不作为第一阶段主方案。

### 方案 C：VM + 单一内容源文件 + 多 Provider 适配

优点：

- 当前成本最低。
- 可以先不依赖任何数据库。
- 可以先把内容维护边界理顺。
- 前端、VM、未来抖音云都能共享同一份内容定义。

缺点：

- 内容更新需要改文件并重新部署。
- 后续如果出现内容运营需求，还要再补数据存储层。

**最终采用方案 C。**

## 总体设计

```text
content/catalog.json
  -> scripts/sync-content-artifacts.js
    -> miniprogram/generated/sounds.js
    -> cloud/seed/content.seed.json

Douyin Mini App
  -> miniprogram/services/soundSourceService.js
    -> provider dispatcher
      -> local provider
      -> http provider
      -> douyinCloud provider

VM server
  -> read content/catalog.json
  -> adapt to bootstrap response
  -> GET /content/bootstrap

future:
  cloud seed / cloud function
    -> still use the same catalog source
```

核心原则：

1. **内容只手工维护一份**：`content/catalog.json`。
2. **页面只认统一 service 边界**：`soundSourceService.getSoundGroups()`。
3. **部署方式只通过 provider 配置切换**：`local | http | douyinCloud`。
4. **接口协议固定**：无论 VM 还是抖音云，都输出同一个 `/content/bootstrap` 结构。

## 单一内容源设计

### 新的唯一内容源

新增：

- `content/catalog.json`

它只保存**内容事实**，不保存部署相关信息。

建议字段：

```js
{
  "version": "2026-05-06",
  "defaultGroupId": "rain",
  "featuredGroupIds": ["rain", "water"],
  "groups": [
    {
      "id": "rain",
      "title": "雨声",
      "subtitle": "更聚焦的雨滴与空气层次，适合想快速静下来的时候。",
      "sort": 10
    }
  ],
  "sounds": [
    {
      "id": "rain_night",
      "groupId": "rain",
      "title": "雨夜白噪音",
      "category": "雨声",
      "description": "稳定雨声和远处空气感",
      "audioAssetKey": "sleep-sounds/audio/rain_night.mp3",
      "coverAssetKey": "sleep-sounds/cover/rain_night.jpg",
      "sort": 10
    }
  ]
}
```

约束：

- `groups[].id`、`sounds[].id` 全局稳定，不随展示文案变动。
- `audioAssetKey` / `coverAssetKey` 是资源身份，不直接写死线上 CDN URL。
- `category` 继续保留，避免当前页面和 mapper 需要根据 group title 反推分类。

### 为什么不把 URL 直接写进唯一内容源

因为 URL 属于环境配置，不属于内容事实：

- 本地 fallback 可能仍使用 demo audio URL 和本地 cover。
- VM 方案可能用 `https://api.example.com/assets/...`。
- 未来抖音云可能用对象存储/CDN 域名。

如果把 URL 写死进唯一内容源，每次切环境都需要修改内容文件本身，这会重新制造维护债。

## 生成与适配设计

### 生成脚本

新增：

- `scripts/sync-content-artifacts.js`

职责：

1. 读取 `content/catalog.json`。
2. 生成前端本地 fallback 使用的 `miniprogram/generated/sounds.js`。
3. 生成未来抖音云 seed 使用的 `cloud/seed/content.seed.json`。

这个脚本的作用不是制造第二套手工内容，而是把**唯一内容源派生为运行产物**。

### 前端本地产物

新增：

- `miniprogram/generated/sounds.js`

设计要求：

- 导出和当前页面兼容的 `soundGroups` 结构。
- `miniprogram/data/sounds.js` 只负责转发到这个生成文件。
- `miniprogram/debug/sounds.js` 不再作为长期手工内容源；后续要么删除，要么降级为迁移期参考文件。

### 云端 seed 产物

保留并改为生成：

- `cloud/seed/content.seed.json`

设计要求：

- 由 `content/catalog.json` 自动生成。
- 内容结构继续兼容当前 `seedContent.js` 和 `contentBootstrapBuilder.js`。
- 如果未来需要真实 CDN URL，可由脚本根据外部配置补全，不再手工直接改 seed 文件。

## 前端多 Provider 设计

### 配置抽象

新增：

- `miniprogram/config/contentSourceConfig.js`

建议结构：

```js
const contentSourceConfig = {
  provider: "local", // local | http | douyinCloud
  httpBaseUrl: "",
  envId: "",
  serviceId: "",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```

说明：

- `provider` 决定当前从哪里拿内容。
- `httpBaseUrl` 仅供 VM / 自建 API 使用。
- `envId` / `serviceId` 仅供抖音云 provider 使用。
- 所有 provider 共用 `bootstrapPath` 和超时策略。

### Provider 实现

前端保留和新增的 service：

- 保留：`miniprogram/services/cloudContentService.js`
- 新增：`miniprogram/services/httpContentService.js`
- 修改：`miniprogram/services/soundSourceService.js`

职责边界：

- `cloudContentService.js`：只负责 `tt.createCloud` + `callContainer`
- `httpContentService.js`：只负责 `tt.request`
- `soundSourceService.js`：作为统一分发入口，根据 `provider` 调用对应 provider，并在异常时统一回退本地内容

页面层仍然只调用：

```js
await getSoundGroups();
```

页面不关心当前内容来自本地、VM 还是抖音云。

## VM 后端设计

### 目标

当前只做最小只读内容服务：

- `GET /content/bootstrap`

### 建议文件

新增：

- `server/index.js`

职责：

1. 读取 `content/catalog.json`
2. 把 catalog 转成 `buildContentBootstrapResponse()` 所需的输入结构
3. 返回统一的 bootstrap JSON

### 与现有云 builder 的关系

当前仓库已经有：

- `cloud/functions/shared/contentBootstrapBuilder.js`

它应该被直接复用，而不是为 VM 再写一套新的 bootstrap 拼装逻辑。

这样可以保证：

- VM 返回的结构
- 未来抖音云函数返回的结构

完全一致。

### 资源策略

第一阶段允许两种资源部署方式：

1. **最省事**：音频和封面与 VM API 同机托管
2. **更稳一点**：API 在 VM，音频和封面后续迁对象存储/CDN

当前设计不强制先接对象存储/CDN，只要求：

- `audioAssetKey` / `coverAssetKey` 可稳定映射到最终 URL
- `/content/bootstrap` 返回的 `url` / `cover` 字段对前端保持稳定

## 抖音云兼容策略

本设计不是放弃抖音云，而是把它降级为未来可切回的 provider。

要求：

- 保留 `cloud/functions/contentBootstrap/index.js`
- 保留 `cloud/scripts/seedContent.js`
- 保留 `docs/douyin-cloud-content-setup.md`

但后续改造时要让这些云侧产物尽量从 `content/catalog.json` 派生，而不是继续手工维护独立内容。

迁回抖音云时，只需要：

1. 让云侧数据从同一 catalog 生成或 seed
2. 保持 `GET /content/bootstrap` 协议不变
3. 前端把 `provider` 从 `http` 切到 `douyinCloud`

页面和播放器逻辑都不需要重写。

## 迁移顺序

### Milestone 1：收敛内容源

- 新增 `content/catalog.json`
- 以当前 `miniprogram/debug/sounds.js` 的内容为初始真相迁入 catalog
- 新增 `scripts/sync-content-artifacts.js`
- 生成 `miniprogram/generated/sounds.js`
- 生成 `cloud/seed/content.seed.json`

### Milestone 2：接入 VM Provider

- 新增 `miniprogram/config/contentSourceConfig.js`
- 新增 `miniprogram/services/httpContentService.js`
- 修改 `miniprogram/services/soundSourceService.js`
- 新增 `server/index.js`

### Milestone 3：联调

- `provider=local` 验证小程序功能不回退
- 启动 VM 服务
- `provider=http` 联调 `/content/bootstrap`
- 验证小程序在 VM provider 下播放、切 tab、定时停止、异常 fallback 正常

### Milestone 4：保留未来云切换能力

- 修正现有 seed 和 cloud path 对 catalog 的依赖关系
- 在真正需要时，再恢复 MongoDB、对象存储/CDN 和抖音云联调

## 测试与验收

### 自动化测试

至少新增或修改以下测试：

- `tests/soundSourceService.test.js`
  - 覆盖 `local` / `http` / `douyinCloud` provider 分发
  - 覆盖 provider 失败时回退本地内容
- `tests/httpContentService.test.js`
  - 覆盖 `tt.request` 成功、失败、超时
- `tests/contentSync.test.js` 或同等测试
  - 覆盖 `content/catalog.json` 到前端/seed 产物的转换规则
- `tests/contentBootstrapBuilder.test.js`
  - 保持 VM 与抖音云共享 bootstrap 输出逻辑不回退

### 手工验收

1. `provider=local` 时，小程序仍能正常展示频道和播放。
2. 启动 VM 服务后，`provider=http` 时页面结构和行为与本地模式一致。
3. 修改 `content/catalog.json` 中一个标题并重新生成产物后：
   - 本地 fallback 可见变化
   - VM `/content/bootstrap` 也可见变化
4. 在 provider 请求失败时，页面不会崩溃，而是回退到本地内容。

## 风险与约束

- 如果继续同时手改 `miniprogram/debug/sounds.js` 和 `content/catalog.json`，分叉问题会立刻复发；因此迁移完成后必须明确只有 catalog 可手工编辑。
- 如果 VM 直接托管音频，后续流量上来后带宽和稳定性会成为瓶颈；这是可接受的第一阶段权衡，不是最终线上方案。
- 当前工作区已有用户在改的 UI 文件，本次改造需要避免回滚或覆盖这些未提交改动。

## 最终决策

当前主线切换为：

- **唯一内容源**：`content/catalog.json`
- **当前后端部署**：VM
- **前端接入方式**：`provider=http`
- **未来云迁移策略**：保留 `douyinCloud` provider 和现有云 scaffold，但不再作为当前联调主线

这个方案先把“内容维护”和“部署解耦”处理正确，再决定什么时候值得为正式线上引入数据库、对象存储/CDN 和抖音云资源。
