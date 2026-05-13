# ECS 内容发布闭环设计

## 背景

当前项目已经有一条可用的内容主链路：

- 内容事实源：`content/catalog.json`
- 小程序本地派生产物：`miniprogram/generated/sounds.js`
- 云端种子派生产物：`cloud/seed/content.seed.json`
- HTTP 部署目录：`deployment/cloud-http-content/api/catalog.json`
- 线上服务：`https://sleep.zhenwei1.cn/content/bootstrap`
- 线上静态资源：`https://sleep.zhenwei1.cn/covers/*`、`https://sleep.zhenwei1.cn/audio/*`

当前也已经确认了几件关键事实：

1. `content/catalog.json` 是唯一内容真相。
2. ECS 上的 API 进程在每次请求 `/content/bootstrap` 时实时读取 `catalog.json`，只更新内容文件时不需要重启服务。
3. 仓库里保留了封面图和调试音频，但没有完整的生产音频源文件；这是为了控制抖音小程序项目体积。
4. 生产音频现在常驻在 ECS 静态目录中，发布内容时不能默认假设本地有一整套音频源。
5. `scripts/sync-content-artifacts.js` 当前只同步小程序和云种子产物，还没有把 HTTP 部署用的 `deployment/cloud-http-content/api/catalog.json` 纳入统一同步流程。

这意味着当前“改内容 → 上线”的能力还不闭环：

- 有部署文档，但没有面向日常内容发布的一条主命令。
- 有线上目录约定，但没有稳定的发布快照、备份和失败语义。
- 有验证命令，但没有把校验、部署、验证串成一个 agent 可执行的标准流程。

本设计的目标，是在当前单一 ECS / HTTPS 主链路前提下，把日常内容发布收敛成稳定、可重复、可审计的闭环。

## 目标

- 提供一条面向 prod 的主发布命令，自动完成：
  - 本地校验
  - 内容派生产物同步
  - 远端部署
  - 自动验证
- 保持 `content/catalog.json` 作为唯一内容真相。
- 把 HTTP 部署用的 `deployment/cloud-http-content/api/catalog.json` 纳入统一派生和校验链路。
- 支持两种资产模式：
  - 默认 `remote-only`：远端音频常驻，本地不要求持有生产音频源
  - 可选 `local-assets`：从仓库外目录读取生产音频/封面并一并上传
- 发布失败时默认停住，不自动回滚，但必须输出明确的回滚入口。
- 文档要能直接给 agent 使用，而不是依赖操作者自行理解上下文。
- 结构上预留未来多环境能力，但当前只实现 prod。

## 非目标

- 本阶段不做 API 代码发布、systemd 配置发布、Nginx 配置发布。
- 本阶段不做自动回滚。
- 本阶段不引入 staging 真实环境，只保留配置边界。
- 本阶段不引入 CMS、后台、审核流、权限系统或数据库内容管理。
- 本阶段不把抖音云真实接入纳入发布主链路。
- 本阶段不把真机验证作为发布命令成功的阻塞条件。

## 成功标准

一次内容发布在下面条件全部满足时视为成功：

1. 主命令完成 `prepare -> package -> deploy -> verify` 全链路。
2. 本地校验通过：
   - `npm run sync:content`
   - `npm run check`
   - `npm test`
3. 远端部署完成：
   - 远端 `catalog.json` 被替换到目标路径
   - 封面文件完成更新
   - 若启用 `local-assets`，对应音频文件完成更新
4. 自动验证通过：
   - 远端内网 `/healthz`
   - 远端内网 `/content/bootstrap`
   - 公网 `/healthz`
   - 公网 `/content/bootstrap`
   - 抽样封面资源返回 `200`
   - 抽样音频资源返回 `200`
5. 发布命令输出：
   - `releaseId`
   - 目标环境
   - 资产模式
   - 远端备份目录
   - 自动验证结果
   - 手动回滚提示

真机验证保留为发布后的可选验收动作，不阻塞自动发布链路。

## 备选方案

### 方案 A：单个大脚本直接完成全部动作

做法：

- 用一个 PowerShell 或 Node 脚本直接串起校验、上传、替换、验证。

优点：

- 起步最快。

问题：

- 逻辑容易堆在一个文件里。
- 失败点难定位。
- 后续加环境、回滚、资产模式、agent 托管时会快速失控。

### 方案 B：单命令 orchestrator，内部阶段化执行

做法：

- 对外只有一条主命令。
- 对内拆成 `prepare`、`package`、`deploy`、`verify` 四个阶段，由 orchestrator 串起来。

优点：

- 自动化足够。
- 失败点和输出边界清晰。
- 便于写测试。
- 便于后续增加 `rollback`、`staging`、`--dry-run`、`--asset-source`。

成本：

- 比单大脚本多一些结构设计。

### 方案 C：先生成发布包，再手动执行 apply

做法：

- 先产出 release bundle，再用第二条命令部署到 ECS。

优点：

- 审计性最好。

问题：

- 当前阶段过重。
- 自动化体验不够顺。

## 方案选择

本阶段选择 **方案 B**：

- 对操作者和 agent 暴露一条主命令。
- 内部仍按阶段化执行，以保证结构清晰、失败语义明确、后续可扩展。

## 总体架构

```text
content/catalog.json
  -> sync-content-artifacts
    -> miniprogram/generated/sounds.js
    -> cloud/seed/content.seed.json
    -> deployment/cloud-http-content/api/catalog.json

publish:content
  -> loadReleaseConfig
  -> prepareRelease
  -> buildReleaseBundle
  -> deployRelease
  -> verifyRelease
  -> printRollbackHint
```

远端部署链路：

```text
artifacts/content-release/<releaseId>/
  -> upload to /srv/sleep-sounds/releases/content/<releaseId>/incoming
  -> backup current files to /srv/sleep-sounds/backups/content/<releaseId>
  -> replace /srv/sleep-sounds/api/catalog.json
  -> replace /srv/sleep-sounds/static/covers/*
  -> optionally replace /srv/sleep-sounds/static/audio/*
  -> verify internal and public endpoints
```

## 关键设计决策

### 1. 单命令是操作入口，阶段化是实现边界

对外默认入口：

```bash
npm run publish:content -- --env prod
```

可选参数：

- `--asset-source <path>`
- `--dry-run`
- `--skip-tests`
- `--verbose`

这样既保留自动化体验，也保留结构上的清晰边界。

### 2. `content/catalog.json` 继续作为唯一内容真相

所有部署相关内容都从它派生，而不是手改多个目录：

- 小程序本地内容模块
- 云端 seed
- HTTP 部署 catalog
- 发布 bundle manifest

这能避免出现“本地内容、部署内容、线上内容”三份事实互相漂移。

### 3. 把 HTTP 部署 catalog 纳入统一派生

当前 `deployment/cloud-http-content/api/catalog.json` 是独立存在的部署产物，但没有统一生成入口。闭环实现里要把它纳入 `sync:content`。

派生规则：

- group 基本字段直接同步
- sound 基本字段直接同步
- `audioAssetKey` 转成部署态文件名，如 `rain_night.mp3`
- `coverAssetKey` 转成部署态文件名，如 `rain_night.jpg`

这样部署态 catalog 可以继续保持当前远端静态路径约定：

- `/audio/<filename>`
- `/covers/<filename>`

### 4. 默认资产模式是 `remote-only`

这是对当前事实的直接收敛：

- 仓库不保留完整生产音频源
- 线上音频已经常驻 ECS
- 日常改文案、排序、分组、推荐位时，不应该强制要求本地具备整套生产音频

在 `remote-only` 模式下，发布对象默认是：

- `catalog.json`
- `covers/*`

自动验证仍然会检查 catalog 引用到的线上音频 URL 是否可达。

### 5. 提供 `local-assets` 模式，作为向后扩展边界

当执行机上存在仓库外资产目录时，可以显式启用：

```bash
npm run publish:content -- --env prod --asset-source D:\sleep-assets\prod
```

该目录约定至少支持：

- `audio/*.mp3`
- `covers/*.jpg`

在该模式下，主命令会把本次 release 需要的音频/封面一起上传。

### 6. 默认失败停住，不自动回滚

原因：

- 现在更重要的是稳定第一版闭环，而不是隐藏失败现场。
- 如果公网失败来自缓存、Nginx、文件不一致或路径错误，自动回滚会掩盖根因。

因此：

- `deploy` 失败：保留远端 incoming 和备份目录
- `verify` 失败：明确标记“已部署但未通过自动验收”
- 统一输出手动回滚命令

### 7. 当前只实现 prod，但配置模型要支持未来扩展

本阶段不做 staging 实现，但配置读取必须按环境名组织：

- `deployment/content-release/prod.env.example`
- 未来可以新增 `staging.env.example`

脚本主体不应硬编码 host、path、domain，只应依赖配置。

## 组件设计

### `loadReleaseConfig`

职责：

- 解析 `--env`
- 读取对应 env 文件或系统环境变量
- 归一化远端路径、URL、SSH 参数、默认资产模式
- 校验 prod 运行所需字段齐备

输入：

- CLI 参数
- 环境变量

输出：

- 标准化后的 release config 对象

### `prepareRelease`

职责：

- 校验内容结构和引用关系
- 校验本地封面资源
- 在 `local-assets` 模式下校验音频和封面资源
- 触发 `sync:content`
- 触发 `npm run check`
- 触发 `npm test`
- 生成标准化 release model

失败语义：

- 任一步失败即退出非 0
- 不发生远端副作用

### `buildReleaseBundle`

职责：

- 生成 `releaseId`
- 创建本地发布快照目录
- 复制待发布文件
- 计算 hash / size
- 写入 `manifest.json`

本地目录建议：

```text
artifacts/content-release/<releaseId>/
```

内容包括：

- `manifest.json`
- `catalog.json`
- `covers/*`
- 可选 `audio/*`

### `deployRelease`

职责：

- 上传 bundle 到远端 incoming 目录
- 在远端创建本次备份目录
- 备份将被覆盖的文件
- 替换远端目标文件
- 输出远端 incoming / backup 路径

远端目录建议：

```text
/srv/sleep-sounds/releases/content/<releaseId>/incoming
/srv/sleep-sounds/backups/content/<releaseId>
```

目标写入路径：

- `/srv/sleep-sounds/api/catalog.json`
- `/srv/sleep-sounds/static/covers/*`
- `/srv/sleep-sounds/static/audio/*`（仅 `local-assets`）

### `verifyRelease`

职责：

- 验证远端内网接口
- 验证公网接口
- 验证抽样封面和音频资源
- 校验 bootstrap 返回结果与 manifest 关键字段一致

验证层次：

1. 远端内网
   - `http://127.0.0.1:3000/healthz`
   - `http://127.0.0.1:3000/content/bootstrap`
2. 公网
   - `https://sleep.zhenwei1.cn/healthz`
   - `https://sleep.zhenwei1.cn/content/bootstrap`
   - 抽样 `/covers/*`
   - 抽样 `/audio/*`

### `printRollbackHint`

职责：

- 在 `deploy` 或 `verify` 失败时统一输出：
  - 当前 `releaseId`
  - 远端备份目录
  - 远端 incoming 目录
  - 推荐回滚命令

## 配置模型

建议新增：

- `deployment/content-release/README.md`
- `deployment/content-release/prod.env.example`

prod 配置至少包含：

```env
CONTENT_RELEASE_ENV=prod

CONTENT_RELEASE_SSH_HOST=8.138.108.110
CONTENT_RELEASE_SSH_USER=root
CONTENT_RELEASE_SSH_KEY=C:/Users/lxy/.ssh/id_ed25519_aliyun

CONTENT_RELEASE_PUBLIC_BASE_URL=https://sleep.zhenwei1.cn
CONTENT_RELEASE_INTERNAL_BASE_URL=http://127.0.0.1:3000

CONTENT_RELEASE_REMOTE_API_DIR=/srv/sleep-sounds/api
CONTENT_RELEASE_REMOTE_STATIC_DIR=/srv/sleep-sounds/static
CONTENT_RELEASE_REMOTE_RELEASES_DIR=/srv/sleep-sounds/releases/content
CONTENT_RELEASE_REMOTE_BACKUPS_DIR=/srv/sleep-sounds/backups/content

CONTENT_RELEASE_DEFAULT_ASSET_MODE=remote-only
```

不把真实 `prod.env` 提交进仓库；只提交 example 文件和字段说明。

## 远端目录约定

### 固定目标目录

- API catalog：`/srv/sleep-sounds/api/catalog.json`
- 封面：`/srv/sleep-sounds/static/covers`
- 音频：`/srv/sleep-sounds/static/audio`

### 发布痕迹目录

- Release incoming：`/srv/sleep-sounds/releases/content/<releaseId>/incoming`
- Backup：`/srv/sleep-sounds/backups/content/<releaseId>`

这样可以做到：

- 每次发布有独立痕迹
- 回滚可以直接依赖远端备份
- agent 能从日志中定位本次发布相关目录

## 发布流程

### Phase 1: prepare

执行：

1. 读取配置
2. 校验 `content/catalog.json`
3. 校验本地封面资源
4. 若为 `local-assets`，校验本地生产音频/封面目录
5. 执行 `npm run sync:content`
6. 执行 `npm run check`
7. 执行 `npm test`

产出：

- release model
- 预计待发布文件列表

### Phase 2: package

执行：

1. 创建 `releaseId`
2. 生成本地 bundle
3. 复制待发布内容
4. 生成 `manifest.json`

产出：

- `artifacts/content-release/<releaseId>/`

### Phase 3: deploy

执行：

1. 上传 bundle 到远端 incoming 目录
2. 创建备份目录
3. 备份被覆盖文件
4. 覆盖远端目标文件

备注：

- 不默认重启 `sleep-sounds-api`
- 因为当前服务按请求读取 `catalog.json`

### Phase 4: verify

执行：

1. 验证远端内网健康检查
2. 验证远端内网 bootstrap
3. 验证公网健康检查
4. 验证公网 bootstrap
5. 验证抽样封面与音频资源
6. 对比 manifest 关键字段

成功后输出发布摘要。

## 失败语义

### prepare 失败

- 不触发远端动作
- 直接退出非 0

### package 失败

- 不触发远端动作
- 保留本地 bundle 现场

### deploy 失败

- 可能已写入远端 incoming 目录
- 不自动回滚
- 输出备份目录与回滚提示

### verify 失败

- 视为“已部署但未通过自动验收”
- 不自动回滚
- 输出失败层级、备份目录、回滚提示

## 回滚设计

本阶段只要求 **手动回滚能力可用**，不要求自动回滚。

每次发布前，远端备份目录至少保留：

- `api/catalog.json`
- 本次覆盖的 `covers/*`
- 本次覆盖的 `audio/*`（若有）
- `manifest.before.json` 或等价元信息文件

发布脚本失败时输出推荐恢复方式，例如：

```bash
ssh -i <key> root@<host> "cp /srv/sleep-sounds/backups/content/<releaseId>/api/catalog.json /srv/sleep-sounds/api/catalog.json"
```

后续如果第一版闭环稳定，再单独立项把回滚动作封装成正式命令。

## 测试与验证策略

### 自动化测试

实现阶段需要覆盖：

- 部署态 catalog 派生逻辑
- 发布配置加载与校验
- `prepare` 资源校验逻辑
- bundle manifest 生成逻辑
- deploy 命令拼装和失败语义
- verify 命令拼装与结果解析
- 发布文档字段完整性

### 手工验证

一次完整演练至少要证明：

1. 本地主命令能成功执行到结束
2. 远端 `catalog.json` 已替换
3. 公网 `/content/bootstrap` 返回新内容
4. 封面与音频 URL 返回 `200`

### 真机验证

真机验证仍然保留在发布文档中，但作为可选验收项，不阻塞主命令成功。

## 运维文档要求

发布文档必须明确写出：

- 发布前准备项
- `prod.env` 字段说明
- 一条标准发布命令
- 成功输出长什么样
- 失败输出长什么样
- 回滚入口
- 真机抽检 checklist

文档默认以“agent 直接执行”为目标，不假设操作者有历史上下文。

## 后续扩展边界

当前设计为后续预留了但暂不实现的扩展点：

- `staging` 环境
- 自动回滚
- 只发布部分内容资源
- 发布后自动触发真机验收流程
- 与未来抖音云内容服务边界对齐

这些都应建立在本次 prod 内容发布闭环稳定之后再推进。
