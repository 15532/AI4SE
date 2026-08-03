# 最终交付检查清单

更新时间：2026-08-03

本清单用于对照 `AI4SE_Final_Project_通用要求.md` 与 `AI4SE_Final_Project_A_Coding_Agent_Harness(1).md`，跟踪当前项目离最终提交还差什么。

## 已完成

- `SPEC.md`：已覆盖问题陈述、用户故事、模块规约、领域与机制设计、数据模型、凭据与分发、安全边界、验收标准。
- `PLAN.md`：已包含分 task 的实现计划、TDD 步骤、验证命令和 worktree 策略。
- `SPEC_PROCESS.md`：已记录 brainstorming、关键迭代和冷启动验证反馈。
- Harness 内核：已实现 action parser、agent loop、mock provider、DeepSeek provider、workspace boundary、guardrail、tool dispatcher、feedback、SQLite event/memory store。
- 可用代码开发链路：方案 A 已支持上下文工具协议、allowed commands、invalid_action / safety_blocked 自修正反馈、以及临时 workspace 内的 inspect -> edit -> verify -> finish 演示。
- WebUI：已实现对话式智能代码助手壳层，普通入口默认 DeepSeek 并隐藏 mock，可在同一对话流中触发真实 harness run，文件、diff、审批和状态作为侧栏/内嵌面板展示。
- Workspace Session V1：已实现只读文件列表/文件内容 API、workspace memory 面板、recent runs 面板，以及后续 run 的 workspace context 继承。
- Diff Inspector V1：已实现只读 git 变更列表 API、单文件 unified diff API，以及运行详情页的 diff inspector 区块。
- Interactive Run V1：已实现 SQLite session、session-run 关联、session 页面和继续运行 API，可在同一 workspace/provider 下连续触发真实 harness run。
- CLI：已支持 demo、run、credentials status/set/clear。
- 测试：`npm test` 可一键运行，覆盖核心机制、WebUI、DeepSeek fake fetch 与可用代码开发链路。
- 机制演示：`npm run demo:mechanisms` 可运行 mock LLM 下的治理与反馈闭环演示。
- 代码开发演示：`npm run demo:coding-task` 可在临时 workspace 中运行读文件、写修复、执行 `npm test`、finish 的确定性演示。
- 分发：已提供 `Dockerfile`、`.dockerignore`、`docker-compose.yml` 和 `docs/DISTRIBUTION.md`。
- CI：已提供 `.github/workflows/unit-test.yml` 与 `.gitlab-ci.yml`，job 名为 `unit-test`；CI 状态与 PR 工作流见 `docs/CI_CD_RECORD.md`。
- 安全文档：`SECURITY.md` 已说明加密凭据文件、WebUI 访问控制风险和提交前检查。
- 本地启动：已提供 `scripts/start-local.ps1`。
- 提交历史：当前本地主要分支提交信息已中文化。

## 待完成

- `REFLECTION.md`：目前只是提纲。最终 1500-2500 字反思报告必须由学生本人撰写；AI 可辅助润色但需要标注。
- `AGENT_LOG.md`：已补近期关键过程，但在最终提交前还应追加 CI、部署、人工修改和最后审查记录。
- 线上部署 URL：最终交付清单要求提供应用可访问的 WebUI 接口；当前尚未部署到公网。
- CI/CD 执行记录：已记录最近一次远端 `unit-test` success 链接；本地新提交和未提交改动 push 后仍需补最新 CI 链接。
- GitHub PR 工作流：已记录建议流程；当前 GitHub API 未发现 PR，PR 创建/合并记录需由用户在 GitHub 上完成并补链接。
- 公网访问控制：当前已有内置 Basic Auth、部署配置与安全说明；如果正式开放公网 WebUI，需要设置 `WEBUI_ADMIN_PASSWORD`，并记录最终访问方式。
- 方案 B / Open Design：当前已完成对话式 WebUI、Workspace Session V1、Diff Inspector V1、Interactive Run V1 和 Approval V1；若继续做浏览器内编辑器或更完整视觉系统，应引入 Open Design，并在 `SPEC.md` 中补充设计系统与 skill。

## 建议下一步

1. 提交凭据安全 V2 改动，并由用户手动 push。
2. 完成公网 WebUI 部署 URL、认证方式与访问控制记录。
3. 用户 push 后补最新 CI pass 链接；在有 Docker 的机器上补跑 `docker build -t ai4se-coding-agent-harness:local .`。
4. 补齐 `AGENT_LOG.md`、`SPEC_PROCESS.md`、`PLAN.md` 中最近几轮关键过程。
5. 用户撰写 `REFLECTION.md` 初稿后，可让 AI 做润色和结构建议。

## 2026-08-02 更新：Approval V1

已完成：

- Approval V1：allowlist 内的发布/部署命令会进入 `pending_approval`，由 WebUI 人工批准或拒绝。
- 审批安全边界：未在 allowlist 的命令仍按 `command.not_allowlisted` 拦截；破坏性删除、密钥访问、敏感写入和路径逃逸仍然永久 block。
- WebUI：运行详情页新增 `approval-panel`，审批决定会写入 timeline。
- 测试：新增 guardrail、EventStore、AgentLoop 和 WebUI 审批测试。

仍待最终交付前确认：

- 由用户手动 push 后查看 GitHub CI 结果。
- 公网部署前设置 `WEBUI_ADMIN_PASSWORD`，并优先补充 HTTPS/反向代理访问控制。
- 用户本人完成 `REFLECTION.md`。

## 2026-08-03 更新：凭据安全 V2

已完成：

- `CredentialManager` 默认使用 AES-256-GCM 加密凭据文件，路径由 `HARNESS_CREDENTIAL_STORE_PATH` 配置，默认写入 `data/credentials.enc.json`。
- 写入、读取或清除加密凭据需要 `HARNESS_MASTER_PASSWORD`；`.env` 和 `DEEPSEEK_API_KEY` 仅作为本地开发 fallback。
- CLI 与 WebUI DeepSeek run 共用同一凭据解析链路，优先读取加密凭据文件，其次才读取环境变量。
- `credentials status/set/clear` 不输出 secret 明文；测试确认加密文件不包含 provider 名或 key 明文。

仍待最终交付前确认：

- 正式服务器部署时应通过服务器环境变量、安全密钥管理或部署平台 secret 注入 `HARNESS_MASTER_PASSWORD`，不要把主密码写入镜像或仓库。
