# 最终交付检查清单

更新时间：2026-08-01

本清单用于对照 `AI4SE_Final_Project_通用要求.md` 与 `AI4SE_Final_Project_A_Coding_Agent_Harness(1).md`，跟踪当前项目离最终提交还差什么。

## 已完成

- `SPEC.md`：已覆盖问题陈述、用户故事、模块规约、领域与机制设计、数据模型、凭据与分发、安全边界、验收标准。
- `PLAN.md`：已包含分 task 的实现计划、TDD 步骤、验证命令和 worktree 策略。
- `SPEC_PROCESS.md`：已记录 brainstorming、关键迭代和冷启动验证反馈。
- Harness 内核：已实现 action parser、agent loop、mock provider、DeepSeek provider、workspace boundary、guardrail、tool dispatcher、feedback、SQLite event/memory store。
- 可用代码开发链路：方案 A 已支持上下文工具协议、allowed commands、invalid_action / safety_blocked 自修正反馈、以及临时 workspace 内的 inspect -> edit -> verify -> finish 演示。
- WebUI：已实现方案 B 第一版轻量智能 IDE 壳层，可选择预注册 workspace 与 mock/DeepSeek provider，触发真实 harness run，并通过 timeline navigator / event detail stack 查看机制分区 timeline。
- Workspace Session V1：已实现只读文件列表/文件内容 API、workspace memory 面板、recent runs 面板，以及后续 run 的 workspace context 继承。
- CLI：已支持 demo、run、credentials status/set/clear。
- 测试：`npm test` 可一键运行，覆盖核心机制、WebUI、DeepSeek fake fetch 与可用代码开发链路。
- 机制演示：`npm run demo:mechanisms` 可运行 mock LLM 下的治理与反馈闭环演示。
- 代码开发演示：`npm run demo:coding-task` 可在临时 workspace 中运行读文件、写修复、执行 `npm test`、finish 的确定性演示。
- 分发：已提供 `Dockerfile` 与 `docker-compose.yml`。
- CI：已提供 `.github/workflows/unit-test.yml` 与 `.gitlab-ci.yml`，job 名为 `unit-test`。
- 安全文档：`SECURITY.md` 已说明凭据、WebUI 无密码风险和提交前检查。
- 本地启动：已提供 `scripts/start-local.ps1`。
- 提交历史：当前本地主要分支提交信息已中文化。

## 待完成

- `REFLECTION.md`：目前只是提纲。最终 1500-2500 字反思报告必须由学生本人撰写；AI 可辅助润色但需要标注。
- `AGENT_LOG.md`：已补近期关键过程，但在最终提交前还应追加 CI、部署、人工修改和最后审查记录。
- 线上部署 URL：最终交付清单要求提供应用可访问的 WebUI 接口；当前尚未部署到公网。
- CI/CD 执行记录：需要最后一次 CI/CD pass 状态截图或链接。
- GitHub PR 工作流：课程要求完整 commit 历史与 PR 工作流；当前已有 commit 历史，但 PR 创建/合并记录需由用户在 GitHub 上确认。
- OS keychain：当前 `CredentialManager` 使用测试用内存 adapter；DeepSeek provider 已支持环境变量读取，Windows Credential Manager 或等价安全存储仍是后续增强。
- 方案 B / Open Design：当前已完成轻量智能 IDE 壳层和 Workspace Session V1；若继续做 diff、浏览器内编辑器或更完整视觉系统，应引入 Open Design，并在 `SPEC.md` 中补充设计系统与 skill。

## 建议下一步

1. 完成方案 A 验证后，经用户确认再提交本轮修改。
2. 用户手动 push 后，在 GitHub 上确认 CI 运行状态。
3. 若继续方案 B，下一步实现 Diff Inspector V1，并用 Open Design 补充更完整视觉系统。
4. 完成公网 WebUI 部署与 CI pass 记录。
5. 用户撰写 `REFLECTION.md` 初稿后，可让 AI 做润色和结构建议。
