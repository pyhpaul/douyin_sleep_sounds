# 内容发布摘要自动落地设计

## 目标

在现有内容发布成功后，自动把关键发布结果写入本地 bundle 目录，避免人工二次抄录 `releaseId`、`backupDir` 和校验目标。

## 范围

本阶段只实现本地摘要文件：

- 输出文件：`artifacts/content-release/<releaseId>/release-summary.json`
- 触发时机：`publish:content` 成功完成后
- dry-run 也生成摘要，但标记为 dry-run

本阶段不做：

- 仓库内长期 release log
- 自动提交 release record
- 远端 release metadata 持久化

## 方案对比

### 方案 A：只写本地 bundle 摘要

优点：

- 改动最小
- 不引入仓库噪音
- 与当前 `artifacts/content-release/<releaseId>/` 结构一致

缺点：

- 长期记录仍需后续单独方案

### 方案 B：直接写仓库内 release log

优点：

- 项目内沉淀清晰

缺点：

- 每次真实发布都制造额外提交流程
- 容易把运行态记录和源码演进混在一起

## 选择

本阶段采用 **方案 A**。

## 数据结构

`release-summary.json` 至少包含：

- `ok`
- `dryRun`
- `releaseId`
- `envName`
- `assetMode`
- `contentVersion`
- `bundleDir`
- `backupDir`
- `publicBaseUrl`
- `verifiedAt`
- `verificationTargets`

其中：

- dry-run 时 `backupDir` 为空字符串
- dry-run 时 `verifiedAt` 为空字符串
- `verificationTargets` 统一输出预期校验目标列表，便于 agent 或人工复核

## 实现边界

- 新增 `scripts/content-release/writeReleaseSummary.js`
- `publish.js` 在 dry-run 成功和真实发布成功后都调用它
- `verifyRelease.js` 保持现有职责，不负责写文件
- `buildReleaseBundle.js` 继续只负责 bundle 和 `manifest.json`

## 文档要求

- README 说明成功后会在 bundle 目录生成 `release-summary.json`
- RUNBOOK 说明该文件可作为本地 release record 复制源
