# CI/CD 与 PR 工作流记录

更新时间：2026-08-03

## CI 配置

GitHub Actions：

- 文件：`.github/workflows/unit-test.yml`
- workflow 名称：`unit-test`
- 触发条件：`push`、`pull_request`
- job 名称：`unit-test`
- 主要步骤：`npm ci`、`npm test`、`npm run build`、`docker build -t coding-agent-harness .`

GitLab CI：

- 文件：`.gitlab-ci.yml`
- job 名称：`unit-test`
- 镜像：`node:22-bookworm-slim`
- 主要步骤：`npm ci`、`npm test`、`npm run build`

## 已确认的远端 CI 记录

通过 GitHub API 查询到的最近一次远端 CI：

- 仓库：`https://github.com/15532/AI4SE`
- 分支：`feature/core-loop`
- workflow：`unit-test`
- commit：`78070cea36c0af89617812ffd46627d9dac9b5b2`
- 提交信息：`验收：新增一键交付检查脚本`
- 状态：`completed`
- 结果：`success`
- 创建时间：`2026-08-03T05:09:46Z`
- 更新时间：`2026-08-03T05:10:40Z`
- 链接：`https://github.com/15532/AI4SE/actions/runs/30786355322`

## 当前本地状态说明

当前本地分支为 `feature/core-loop`。本地已有更新提交：

- `d8a3fad 安全：实现加密凭据存储`

该提交以及后续未提交的 WebUI Basic Auth、分发记录改动尚未 push，因此远端 GitHub Actions 还没有对应 CI 结果。用户手动 push 后，应重新检查 `https://github.com/15532/AI4SE/actions`，并把最新 run 链接补到本文。

## PR 工作流记录

通过 GitHub API 查询，当前仓库尚未发现 PR 记录。最终提交建议使用以下流程：

```powershell
git -C D:\Projects\AI4SE\.worktrees\feature-core-loop status --short
git -C D:\Projects\AI4SE\.worktrees\feature-core-loop push origin feature/core-loop
```

然后在 GitHub 创建 PR：

- base：`main`
- compare：`feature/core-loop`
- 标题建议：`项目 A：Coding Agent Harness 完整实现`
- PR 说明应包含：核心 harness、DeepSeek、WebUI、凭据安全、Basic Auth、Docker 分发、CI 链接和剩余人工事项。

合并前检查：

- 最新 `unit-test` workflow 必须为 `success`。
- PR 页面应展示完整 commit 历史。
- 不应包含 `.env`、SQLite 数据库、加密凭据文件、日志或真实 secret。
- Docker build 若在 GitHub Actions 中通过，可作为服务器分发证据；如果 Actions 未执行 Docker build，应在有 Docker 的机器上补跑并记录。
