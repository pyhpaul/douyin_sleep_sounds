# 抖音云真实环境缺位暂停口径

## 当前结论

- 3A 当前代码侧已完成：
  - `local | http | douyinCloud` provider 边界
  - `contentSourceConfig` / `cloudContentService` / `contentMapper`
  - `cloud/functions/contentBootstrap/index.js`
  - `cloud/scripts/seedContent.js`
  - `docs/douyin-cloud-content-setup.md`
  - 对应自动化测试与回退保护
- 当前正式验收主链路仍是 `http`，不是 `douyinCloud`
- 因缺少真实抖音云 `dev` 环境，真实云接入验证暂停

## 暂停规则

在未具备真实抖音云 `dev` 环境前：

1. 不进行 fake 接入验收
2. 不新增假 runtime、假 SDK、假服务成功路径
3. 不把 `douyinCloud` 切为当前默认 provider
4. 不把“未完成真实云验证”误判为“还需要继续补本地代码结构”

## 当前可接受验收口径

继续接受并维持以下验收：

- `provider: "local"` 可正常回退
- `provider: "http"` 可通过 `https://sleep.zhenwei1.cn/content/bootstrap` 工作
- 自动化测试通过
- setup / deployment / fallback 文档完整

## 旧 worktree 处置

`task/douyin-cloud-content-backend` worktree 中存在早于当前 `main` 的未提交分叉实现。

当前观察到的漂移范围包括：

- 已修改但未提交：
  - `miniprogram/services/soundSourceService.js`
  - `scripts/check-syntax.js`
  - `tests/soundSourceService.test.js`
- 未跟踪文件：
  - `miniprogram/config/cloudContentConfig.js`
  - `miniprogram/services/cloudContentService.js`
  - `miniprogram/services/contentMapper.js`
  - `tests/cloudContentService.test.js`
  - `tests/contentMapper.test.js`
  - `package-lock.json`

处置口径：

- 不继续基于该 worktree 开发
- 不把其中未提交改动直接合并回当前主线
- 如需保留，仅作为历史参考；恢复真实抖音云工作时，应从当前 `main` 重新开新分支

## 恢复条件

只有在以下条件都具备后，才恢复真实抖音云接入执行：

- 真实抖音云 `dev` 环境可用
- MongoDB / 对象存储 / 函数服务已开通
- `envId` / `serviceId` 已拿到
- `GET /content/bootstrap` 可部署并可调用
