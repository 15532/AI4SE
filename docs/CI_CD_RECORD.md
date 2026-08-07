# CI/CD 与 PR 工作流记录

更新时间：2026-08-07

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

通过 GitHub API 查询到的最近一次远端 CI（2026-08-07 收尾轮次）：

- 仓库：`https://github.com/15532/AI4SE`
- Actions 总览：`https://github.com/15532/AI4SE/actions`
- 分支：`feature/core-loop`
- workflow：`unit-test`
- commit：`67258b8a7b574d8ce2bdcf2c245905921ad6328c`
- 提交信息：`文档：README 补齐获取方式与已知限制，收尾核查记录`
- 状态：`completed`
- 结果：`success`
- 创建时间：`2026-08-07T05:50:45Z`
- 更新时间：`2026-08-07T05:51:44Z`
- 链接：`https://github.com/15532/AI4SE/actions/runs/31151926069`

## 当前本地状态说明

当前分支为 `feature/core-loop`，本地与 `origin/feature/core-loop` 已同步。已经确认远端 CI 通过的最新提交：

- `67258b8 文档：README 补齐获取方式与已知限制，收尾核查记录`

resume 会话（2026-08-06 ~ 2026-08-07）在已有核心实现之上完成的多轮修复与增强，均已 push 并通过 CI：

- WebUI「mock 机制演示」按钮接入确定性机制复现（`2d72daf`）。
- 聊天线程按时间正序渲染，新消息显示在下方（`bf669ea`）。
- DeepSeek 摘要要求更详细且禁止编造未执行的验证（`522dde0`）；验证声明守卫拒绝「声称验证成功但未实际运行」（`deff9aa`），并修复守卫对「如实报告失败/未验证」的误报（`64c9110`）。
- agent loop 历史去重、有效迭代预算与重复空转分离（`0ae030c`/`acd71e6`）。
- 多 JSON 拼接检测（含中间夹文字）不再静默丢弃动作（`4902fdc`/`a42d9a4`）。
- 写后必须验证护栏，阻止未验证时反复重写同一文件（`d99fd5a`）。
- WebUI 清除历史对话与工作区（`1a5c07a`）。
- 每轮修复后都重新发布服务器，`docs/DISTRIBUTION.md` 有逐轮部署记录。

Docker build 已包含在 GitHub Actions workflow 中。当前服务器未安装 Docker，用户决定 Docker/compose 验证暂缓；systemd + Nginx 部署证据已补充到 `docs/DISTRIBUTION.md`。

## PR 工作流记录

已创建 PR（2026-08-06）：

- PR：https://github.com/15532/AI4SE/pull/1
- 标题：`项目 A：Coding Agent Harness 完整实现（含 WebUI mock 机制演示）`
- base：`main`
- compare：`feature/core-loop`
- 状态：`open`，`mergeable: true`
- 创建时间：`2026-08-06T13:05:24Z`
- PR 触发的 `unit-test` workflow：`https://github.com/15532/AI4SE/actions/runs/31104305686`，结果 `success`

合并前检查：

- 最新 `unit-test` workflow 必须为 `success`（push 与 pull_request 两次触发均已通过）。
- PR 页面应展示完整 commit 历史。
- 不应包含 `.env`、SQLite 数据库、加密凭据文件、日志或真实 secret。
- Docker build 已在 GitHub Actions workflow 中执行；目标服务器 Docker/compose 验证按用户决定暂缓，systemd + Nginx 部署记录见 `docs/DISTRIBUTION.md`。

## 最新证据待补清单

- PR 合并后，补最终合并状态（merged 时间与 merge commit）。
- 若课程要求容器分发，服务器或 registry 验证后补 `docker pull` 或 `docker compose up --build` 的真实记录。
