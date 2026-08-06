# CI/CD 与 PR 工作流记录

更新时间：2026-08-06

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
- commit：`2d72daf9b2fc53f2dc6dca144f64c30ea21f6602`
- 提交信息：`功能：WebUI mock 机制演示接入确定性机制复现`
- 状态：`completed`
- 结果：`success`
- 创建时间：`2026-08-06T13:01:31Z`
- 更新时间：`2026-08-06T13:02:24Z`
- 链接：`https://github.com/15532/AI4SE/actions/runs/31103992485`

## 当前本地状态说明

当前分支为 `feature/core-loop`，本地与 `origin/feature/core-loop` 已同步。已经确认远端 CI 通过的最新提交：

- `2d72daf 功能：WebUI mock 机制演示接入确定性机制复现`

该提交是 2026-08-06 resume 会话的成果：WebUI「mock 机制演示」按钮不再走默认一步 finish，而是接入 `runMechanismDemo` 的确定性复现（护栏拦截危险命令 → `test_failed` 失败反馈 → 模型据此改为 `write_file` 修正动作 → 中文 finish 摘要），并在对话流中展示完整 timeline。本地验证 `npm run typecheck`、`npm run build`、`npm test`（193 个测试）全部通过，push 后 GitHub Actions `unit-test` 成功。

Docker build 已包含在 GitHub Actions workflow 中。当前服务器未安装 Docker，用户决定 Docker/compose 验证暂缓；systemd + Nginx 部署证据已补充到 `docs/DISTRIBUTION.md`。

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
- Docker build 已在 GitHub Actions workflow 中执行；目标服务器 Docker/compose 验证按用户决定暂缓，systemd + Nginx 部署记录见 `docs/DISTRIBUTION.md`。

## 最新证据待补清单

- 创建 PR 后，补 PR 链接、base/compare 分支和最终合并状态。
- 若课程要求容器分发，服务器或 registry 验证后补 `docker pull` 或 `docker compose up --build` 的真实记录。
- 若将本次 WebUI 机制演示修复同步到服务器，补服务器重新发布后的公网验证记录。
