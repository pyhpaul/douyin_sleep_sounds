# 内容发布本地台账设计

## 目标

在现有单次 `release-summary.json` 之外，自动维护一个本地可追加的发布台账，便于 agent 或人工快速回看最近几次 dry-run / 真实发布记录。

## 选择

本阶段只实现本地 JSONL 台账：

- 文件：`artifacts/content-release/release-log.jsonl`
- 写入方式：每次 dry-run 或成功发布后追加一行 JSON
- 数据来源：已有 `release-summary.json` 载荷

## 不做

- 仓库内长期 release log
- 自动提交 release log
- 失败发布日志写入

## 原因

- 本地 JSONL 最贴近运行态
- 不引入源码仓库噪音
- 后续可以再单独增加“归档到仓库”的显式命令

## 数据结构

每行直接记录一条 release summary，并额外保证包含：

- `releaseId`
- `dryRun`
- `envName`
- `assetMode`
- `contentVersion`
- `backupDir`
- `verifiedAt`

## 实现边界

- 新增 `scripts/content-release/appendReleaseLog.js`
- 在 `writeReleaseSummary.js` 成功写摘要后顺手追加 JSONL
- 台账文件和单次 summary 同属 `artifacts/content-release/` 运行态证据

## 文档要求

- README 说明会自动维护 `artifacts/content-release/release-log.jsonl`
- RUNBOOK 说明该文件用于回看最近发布记录，不入库
