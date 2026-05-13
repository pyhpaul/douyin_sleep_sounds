# 内容发布归档命令设计

## 目标

把本地运行态 `artifacts/content-release/release-log.jsonl` 中的单条 release 记录，显式归档到仓库内长期可追踪文件。

## 第一版入口

```bash
npm run archive:content -- --release-id <releaseId>
```

## 选择

第一版归档目标采用：

- `deployment/content-release/archive.jsonl`

而不是 Markdown。

## 原因

- 与当前本地 `release-log.jsonl` 结构一致
- 后续 agent 更容易查询、去重、聚合
- 人类可读报表可以后续从 JSONL 派生

## 行为

1. 从 `artifacts/content-release/release-log.jsonl` 读取本地记录
2. 按 `releaseId` 精确查找
3. 若仓库归档中已存在同 `releaseId`，则报错退出
4. 追加一行 JSON 到 `deployment/content-release/archive.jsonl`
5. 输出结构化 JSON：
   - `ok`
   - `releaseId`
   - `archivePath`

## 不做

- 自动归档全部未归档记录
- Markdown 双写
- 直接从远端拉取记录

## 实现边界

- `archiveReleaseRecord.js`
  - 负责读取本地 log、校验重复、写入仓库归档
- `archive.js`
  - orchestrator

## 文档要求

- README 说明：
  - 本地 log 是运行态
  - 长期留档走 `archive:content`
