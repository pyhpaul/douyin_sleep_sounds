# 内容发布回滚命令设计

## 目标

把当前“打印 rollback hint”的半手工流程收敛成正式命令，支持通过 `releaseId` 恢复远端内容文件，并自动验证回滚结果。

## 命令入口

```bash
npm run rollback:content -- --env prod --release-id <releaseId>
```

## 范围

第一版只支持：

- 单环境：`prod`
- 通过 `releaseId` 推导备份目录
- 恢复：
  - `catalog.json`
  - `covers/`
  - 若备份存在 `audio/`，则恢复 `audio/`
- 自动验证：
  - 内网 `/healthz`
  - 内网 `/content/bootstrap`
  - 公网 `/healthz`
  - 公网 `/content/bootstrap`

## 不做

- `--backup-dir` 直接模式
- 自动选择“上一个 release”
- 自动写回滚 release log

## 方案选择

### 方案 A：只保留 hint，不做正式命令

优点：
- 实现最少

缺点：
- 实操仍容易出错
- agent 无法稳定执行

### 方案 B：新增正式 rollback 命令

优点：
- 操作入口稳定
- 校验链路一致
- 闭环更完整

本阶段选择 **方案 B**。

## 实现边界

- `loadRollbackConfig.js`
  - 复用现有 env 解析逻辑，额外要求 `--release-id`
- `rollbackRelease.js`
  - 负责 ssh 恢复远端文件
- `verifyRollback.js`
  - 负责回滚后的健康检查与 bootstrap 校验
- `rollback.js`
  - orchestrator

## 输出

成功时输出结构化 JSON：

- `ok`
- `releaseId`
- `envName`
- `backupDir`

失败时直接退出非零。
