# 抖音云兼容内容服务框架设计

## 背景

当前内容服务已经在普通云服务器上跑通：

- API：`https://sleep.zhenweiai.com/content/bootstrap`
- 封面示例：`https://sleep.zhenweiai.com/covers/rain_night.jpg`
- 音频示例：`https://sleep.zhenweiai.com/audio/rain_night.mp3`

现在线上实现是轻量形态：Node.js API 读取 `catalog.json`，Nginx 提供 HTTPS 和静态资源，systemd 守护 Node 进程。这个方案稳定、成本低，但它的目录和配置仍然偏“云服务器专用”。如果未来要迁移到抖音云，容易出现两个问题：

1. 服务器实现和抖音云正式服务形态不配套。
2. 迁移时可能需要重新整理业务入口、配置、数据读取和资源 URL 生成逻辑。

本设计的目标是把后端框架调整成“抖音云兼容服务框架”，但当前服务器仍然启用轻量实现。后续迁移抖音云时，优先切换运行环境和适配器，而不是重写业务链路。

## 目标

- 保持现有线上行为不变：`/content/bootstrap` 仍返回当前小程序可用的 bootstrap 结构。
- 保留当前本地、HTTP、抖音云三种 provider：`local | http | douyinCloud`。
- 把后端拆成稳定业务核心和可替换运行适配器。
- 当前 ECS 继续使用 `catalog.json` 和 `sleep.zhenweiai.com` 静态资源。
- 提前补齐抖音云迁移需要的配置模板、运行入口、健康检查和验证说明。
- 为后续接入抖音云数据库、对象存储或云托管服务预留清晰边界。

## 非目标

- 本阶段不接入真实抖音云数据库。
- 本阶段不迁移音频和封面到抖音云对象存储。
- 本阶段不建设 CMS 或运营后台。
- 本阶段不新增用户系统、收藏、播放历史、会员、统计等功能。
- 本阶段不改变小程序页面 UI 和播放器运行态。
- 本阶段不删除现有云服务器 HTTP 部署能力。

## 设计原则

1. **一个业务契约**：所有环境都提供 `GET /content/bootstrap`。
2. **一个响应结构**：HTTP 服务器和未来抖音云服务返回同一份 bootstrap shape。
3. **多个适配器**：内容来源、资源 URL、运行入口都可替换。
4. **当前轻量，未来可迁**：当前 ECS 使用最轻实现，未来抖音云只切适配层。
5. **不把环境写进内容事实**：`catalog.json` 保存内容事实，域名、资源前缀、仓库类型由环境配置决定。

## 总体架构

```text
Mini App
  -> soundSourceService
    -> local provider
    -> http provider
    -> douyinCloud provider

Content Service Framework
  -> HTTP Runtime / Douyin Cloud Runtime
    -> Content Bootstrap Service
      -> Content Repository
        -> Json Catalog Repository
        -> Future Douyin Cloud Repository
      -> Asset Resolver
        -> Static Base URL Resolver
        -> Future Douyin Storage Resolver
      -> contentBootstrapBuilder
```

当前 ECS 路径：

```text
Nginx
  -> Node HTTP Runtime
    -> JsonCatalogRepository
    -> StaticBaseUrlResolver
    -> /content/bootstrap

Nginx
  -> /covers/*
  -> /audio/*
```

未来抖音云路径：

```text
Mini App
  -> tt.createCloud()
  -> callContainer({ path: "/content/bootstrap" })
    -> Douyin Cloud Runtime
      -> DouyinCloudRepository or MongoRepository
      -> DouyinStorageResolver or StaticBaseUrlResolver
      -> same bootstrap response
```

## 服务模块设计

### 1. Content Bootstrap Service

职责：

- 从 repository 读取内容数据。
- 调用 asset resolver 生成音频和封面 URL。
- 复用 `content/catalogAdapter.js` 生成发布态 documents。
- 复用 `cloud/functions/shared/contentBootstrapBuilder.js` 生成小程序 bootstrap 响应。

建议接口：

```js
async function getContentBootstrap() {
  const catalog = await repository.getCatalog();
  const documents = buildPublishedContentDocuments(catalog, {
    resolveAudioUrl: assetResolver.resolveAudioUrl,
    resolveCoverUrl: assetResolver.resolveCoverUrl
  });
  return buildContentBootstrapResponse(documents);
}
```

边界：

- 不直接读取文件。
- 不直接读取数据库。
- 不直接知道 ECS、Nginx 或抖音云。
- 不处理 HTTP request/response。

### 2. Repository

Repository 只负责“内容从哪里来”。

第一阶段实现：

```text
JsonCatalogRepository
```

职责：

- 读取 `catalog.json`。
- 返回统一 catalog object。
- 允许通过环境变量指定 catalog 路径。

未来预留：

```text
DouyinCloudRepository / MongoRepository
```

职责：

- 从抖音云数据库或平台服务读取 `sound_groups`、`sounds`、`app_configs`。
- 转成与 catalog adapter 兼容的数据结构。

Repository 不负责：

- 拼资源 URL。
- 组装 HTTP 响应。
- 判断小程序 provider。

### 3. Asset Resolver

Asset Resolver 只负责“资源地址怎么生成”。

第一阶段实现：

```text
StaticBaseUrlResolver
```

配置：

```env
STATIC_BASE_URL=https://sleep.zhenweiai.com
```

输出：

```text
https://sleep.zhenweiai.com/audio/rain_night.mp3
https://sleep.zhenweiai.com/covers/rain_night.jpg
```

未来预留：

```text
DouyinStorageResolver
```

可能职责：

- 从对象存储 key 生成 CDN URL。
- 或调用平台 SDK 生成临时访问 URL。
- 或根据环境返回不同资源域名。

Asset Resolver 不负责：

- 读取 catalog。
- 判断声音是否 published。
- 写数据库或上传文件。

### 4. Runtime

Runtime 负责“服务怎么被调用”。

当前 ECS 实现：

```text
Node HTTP Runtime
```

提供：

- `GET /healthz`
- `GET /content/bootstrap`

监听配置：

```env
HOST=127.0.0.1
PORT=3000
```

说明：

- ECS 上继续绑定 `127.0.0.1`，由 Nginx 对外暴露 HTTPS。
- 这不是资源 URL 绑定到 `127.0.0.1`，只是进程内部监听地址。

未来抖音云实现：

```text
Douyin Cloud Runtime
```

配置：

```env
HOST=0.0.0.0
PORT=<platform injected port>
```

或根据抖音云函数/云托管形态调整入口，但仍调用同一个 Content Bootstrap Service。

## 配置设计

统一环境变量建议：

```env
CONTENT_REPOSITORY=jsonCatalog
CONTENT_ASSET_RESOLVER=staticBaseUrl
CONTENT_CATALOG_PATH=./catalog.json
STATIC_BASE_URL=https://sleep.zhenweiai.com
HOST=127.0.0.1
PORT=3000
NODE_ENV=production
```

当前 ECS 轻量模式：

```env
CONTENT_REPOSITORY=jsonCatalog
CONTENT_ASSET_RESOLVER=staticBaseUrl
CONTENT_CATALOG_PATH=/srv/sleep-sounds/api/catalog.json
STATIC_BASE_URL=https://sleep.zhenweiai.com
HOST=127.0.0.1
PORT=3000
```

未来抖音云最小迁移模式：

```env
CONTENT_REPOSITORY=jsonCatalog
CONTENT_ASSET_RESOLVER=staticBaseUrl
CONTENT_CATALOG_PATH=./catalog.json
STATIC_BASE_URL=https://sleep.zhenweiai.com
HOST=0.0.0.0
PORT=3000
```

未来抖音云正式数据模式：

```env
CONTENT_REPOSITORY=douyinCloudMongo
CONTENT_ASSET_RESOLVER=douyinStorage
STATIC_BASE_URL=
HOST=0.0.0.0
PORT=3000
```

本阶段只实现和验证 `jsonCatalog + staticBaseUrl`，但把枚举和文档边界预留清楚。

## 目录建议

新增通用服务框架：

```text
server/contentService/
  createContentBootstrapService.js
  createContentHttpApp.js
  env.js
  repositories/
    jsonCatalogRepository.js
  assetResolvers/
    staticBaseUrlResolver.js
```

新增抖音云兼容部署说明：

```text
deployment/douyin-cloud-content/
  README.md
  ecs-lite.env.example
  douyin-cloud.env.example
  package.json
  scripts/
    verify-local.ps1
```

保留现有云服务器部署：

```text
deployment/cloud-http-content/
```

调整方向：

- `deployment/cloud-http-content/api/app.js` 改为使用 `server/contentService/createContentHttpApp.js`。
- `server/createVmContentServer.js` 可继续保留本地 debug 静态文件能力，但 bootstrap 组装逻辑尽量复用 Content Bootstrap Service。
- `scripts/check-syntax.js` 纳入新增文件。

## 小程序切换设计

当前 HTTP 模式：

```js
const contentSourceConfig = {
  provider: "http",
  httpBaseUrl: "https://sleep.zhenweiai.com",
  envId: "",
  serviceId: "",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```

未来抖音云模式：

```js
const contentSourceConfig = {
  provider: "douyinCloud",
  httpBaseUrl: "",
  envId: "<douyin-cloud-env-id>",
  serviceId: "<douyin-cloud-service-id>",
  bootstrapPath: "/content/bootstrap",
  timeoutMs: 5000
};
```

不改变：

- `soundSourceService.js` 继续作为 provider dispatcher。
- `httpContentService.js` 继续用于 ECS / HTTPS fallback。
- `cloudContentService.js` 继续用于 `tt.createCloud + callContainer`。
- 远程失败仍回退 local mock。

## 当前 ECS 行为保持

实施后，当前服务器对外行为应保持：

```text
GET https://sleep.zhenweiai.com/content/bootstrap
GET https://sleep.zhenweiai.com/covers/rain_night.jpg
GET https://sleep.zhenweiai.com/audio/rain_night.mp3
```

bootstrap 返回仍包含：

```text
7 个分类：
rain, water, forest, room, wind, noise, ambient

8 条声音：
rain_night, ocean_slow, forest_breeze, fireplace_room,
creek_soft, soft_wind, nap_white_noise, deep_ambient
```

服务器 systemd 仍可使用：

```ini
Environment=PORT=3000
Environment=HOST=127.0.0.1
Environment=STATIC_BASE_URL=https://sleep.zhenweiai.com
Environment=CONTENT_REPOSITORY=jsonCatalog
Environment=CONTENT_ASSET_RESOLVER=staticBaseUrl
```

Nginx 仍负责：

```text
/content/bootstrap -> 127.0.0.1:3000
/covers/*          -> /srv/sleep-sounds/static/covers
/audio/*           -> /srv/sleep-sounds/static/audio
```

## 未来抖音云迁移步骤

迁移时不应重写业务代码，目标步骤是：

1. 将同一套 content service 框架打包到抖音云服务。
2. 设置 `HOST=0.0.0.0` 和平台要求的 `PORT`。
3. 初期仍使用 `CONTENT_REPOSITORY=jsonCatalog`。
4. 初期仍使用 `STATIC_BASE_URL=https://sleep.zhenweiai.com`。
5. 在小程序配置中切换：

```js
provider: "douyinCloud"
```

6. 填入真实 `envId` 和 `serviceId`。
7. 真机验证 `callContainer({ path: "/content/bootstrap" })`。
8. 后续再单独切换 repository 和 asset resolver。

## 验证设计

### 单元测试

新增或调整测试覆盖：

- `createContentBootstrapService` 可以从 mock repository 返回 bootstrap。
- `jsonCatalogRepository` 能读取 catalog。
- `staticBaseUrlResolver` 能生成 `/audio/rain_night.mp3` 和 `/covers/rain_night.jpg` 这类 URL。
- HTTP app 能返回 `/healthz`。
- HTTP app 能返回 `/content/bootstrap`。
- 未知路径返回 404。

### 本地验证

```powershell
npm run check
npm test
node deployment/cloud-http-content/api/app.js
curl.exe http://127.0.0.1:3000/healthz
curl.exe http://127.0.0.1:3000/content/bootstrap
```

### 服务器验证

```bash
systemctl status sleep-sounds-api
curl -s https://sleep.zhenweiai.com/healthz
curl -s https://sleep.zhenweiai.com/content/bootstrap
curl -I https://sleep.zhenweiai.com/covers/rain_night.jpg
curl -I https://sleep.zhenweiai.com/audio/rain_night.mp3
```

如果不对外暴露 `/healthz`，也可只在服务器内部验证：

```bash
curl -s http://127.0.0.1:3000/healthz
```

### 小程序验证

- `provider: "http"` 时，真机可以拿到 7 类 / 8 声音。
- `provider: "local"` 时，本地 fallback 仍可用。
- `provider: "douyinCloud"` 的配置仍保留，未填真实 `envId/serviceId` 时不作为当前验收主链路。

## 风险与约束

### 风险 1：过早实现抖音云数据库会扩大范围

处理：本阶段只预留 repository 枚举和文档，不接真实数据库。

### 风险 2：当前 ECS 行为被重构破坏

处理：所有测试和 curl 验证必须证明 `/content/bootstrap` 返回内容数量不变，资源 URL 仍使用 `https://sleep.zhenweiai.com/audio/` 和 `https://sleep.zhenweiai.com/covers/` 前缀。

### 风险 3：抖音云运行时要求和 Node HTTP 入口不同

处理：Runtime 和业务服务分离。若抖音云最终要求函数式入口，只新增 runtime wrapper，不改 Content Bootstrap Service。

### 风险 4：`/healthz` 是否对外暴露

处理：默认在 Node app 中提供 `/healthz`。Nginx 是否暴露由部署配置决定；即使不对公网暴露，也可以在服务器内部验证。

## 验收标准

- 新的 content service 框架存在，并由当前 cloud HTTP API 使用。
- 当前线上 `/content/bootstrap` 行为不变。
- 当前线上音频和封面 URL 不绑定 `127.0.0.1`。
- `local | http | douyinCloud` provider 结构不被删除。
- 文档说明 ECS 轻量模式和未来抖音云模式的配置差异。
- `npm run check` 通过。
- 相关单元测试通过。
- 本地或服务器 curl 能验证 `/content/bootstrap`、音频、封面。
