# Project A 交付验收清单

本清单用于提交前自查，目标是把 AI4SE 项目 A 的课程要求、当前 SPEC 和可运行证据放在同一个入口中。

## 一键验收

推荐命令：

```powershell
npm run check:acceptance
```

该命令会按顺序执行：

- `npm.cmd run build`：确认 TypeScript 可编译。
- `npm.cmd test`：运行可一键运行的测试。
- `npm.cmd run demo:mechanisms`：确定性展示 mock、guardrail、feedback 和 timeline。
- `npm.cmd run demo:coding-task`：确定性展示 inspect -> edit -> verify -> finish 的代码开发链路。
- `git status --short`：提醒提交前是否仍有未提交变更。
- 基础密钥扫描：检查已跟踪文件中是否出现 `DEEPSEEK_API_KEY=` 或 `sk-` 形态的疑似密钥。

如只想快速验证构建与测试，可执行：

```powershell
npm run check:acceptance -- -SkipDemos
```

## 项目 A 要求对应

- 至少 3 个职责清晰的功能模块：当前实现拆分为 `src/core/`、`src/runtime/`、`src/store/`、`src/config/`、`src/web/`、`src/cli/` 等模块，职责分别覆盖 agent loop、工具与 workspace、安全边界、状态持久化、配置、WebUI 和 CLI。
- 可一键运行的测试：`npm test` 可在无网络情况下运行全部 Vitest 测试；`npm run check:acceptance` 会进一步串联 build、test 和 demo。
- Mock 或 stub 测试：mock provider 是必做能力，用于无网络确定性验证 action parsing、guardrail、feedback、memory 和 finish 流程。
- 真实 LLM 接入：DeepSeek 作为默认 WebUI provider，优先通过加密凭据文件读取真实 key，其次才使用 `DEEPSEEK_API_KEY` 环境变量 fallback。
- WebUI：当前 WebUI 是对话式 coding agent 工作台，普通入口默认使用 DeepSeek，文件、diff、状态和审批作为上下文面板。
- 安全策略：workspace path boundary、命令 allowlist、guardrail、人工审批、密钥脱敏和无密码 WebUI 风险说明见 `SECURITY.md`。
- Docker：`Dockerfile` 与 `docker-compose.yml` 可用于服务器分发；compose 透传 `HARNESS_MASTER_PASSWORD` 与可选 `DEEPSEEK_API_KEY`，并持久化 `/app/data`。

## 提交前人工检查

- README 已说明安装、运行、DeepSeek key、WebUI、Docker 和安全边界。
- SPEC 已说明所选设计策略、模块边界、mock 职责和 DeepSeek 默认入口。
- `SECURITY.md` 已说明无密码 WebUI 的部署风险，服务器上不得直接暴露 `3000` 端口。
- Git history、source、docs、logs、SQLite 和示例配置中不得包含真实凭据。
- 若部署到服务器，必须先准备反向代理认证、持久化数据目录和受控的 `DEEPSEEK_API_KEY` 注入方式。
