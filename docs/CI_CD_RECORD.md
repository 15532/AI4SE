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
- Actions 总览：`https://github.com/15532/AI4SE/actions`
- 分支：`feature/core-loop`
- workflow：`unit-test`
- commit：`fd9117c7e5f1b17a5abbbe6e92a48aad5c935f9f`
- 提交信息：`交付：补访问控制分发与过程记录`
- 状态：`completed`
- 结果：`success`
- 创建时间：`2026-08-03T09:53:46Z`
- 更新时间：`2026-08-03T09:54:37Z`
- 链接：`https://github.com/15532/AI4SE/actions/runs/30803331722`

## 当前本地状态说明

当前本地分支为 `feature/core-loop`。已经确认远端 CI 通过的最新提交：

- `fd9117c 交付：补访问控制分发与过程记录`

Docker build 已包含在 GitHub Actions workflow 中。独立服务器 Docker 验证将在服务器部署阶段补充到 `docs/DISTRIBUTION.md`。

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
- Docker build 已在 GitHub Actions workflow 中执行；服务器部署阶段仍应补充目标服务器上的 `docker build` 或 `docker compose up --build` 记录。
