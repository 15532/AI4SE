# SPEC_PROCESS

状态：准备阶段已启动；Cursor 冷启动验证待完成。

## 过程摘要

本项目正在按 AI4SE 期末项目 A - Coding Agent Harness 准备。主开发智能体是 Codex App。计划使用 Cursor 作为冷启动验证智能体，因为课程要求第二个 agent 类型必须不同于主开发 agent。

## Brainstorming 关键迭代

### Iteration 1 - 项目方向

问题：Coding Agent Harness 的主要贡献应该放在哪种能力上？

决策：选择治理护栏 + 确定性反馈闭环。

原因：该方向直接对应 Project A 中“机制必须由代码实现，并能用 mock/stub LLM 测试”的要求。

### Iteration 2 - 技术栈与产品形态

问题：项目应使用什么技术栈和交互形态？

决策：TypeScript、CLI + WebUI、OpenAI-compatible LLM abstraction、SQLite state。

原因：同一种语言可以覆盖 CLI、WebUI server、测试、Docker 部署和共享类型。

### Iteration 3 - 部署与安全

问题：如何在用户自有服务器上部署 public WebUI？

决策：Docker + Nginx。初始建议为 mock/demo-only，但后续根据用户选择改为 WebUI 可触发真实 run。

原因：Docker + Nginx 适合云服务器部署；WebUI 真实 run 能提供更强产品展示，但需要更明确边界。

### Iteration 4 - CI 要求冲突

问题：用户偏好 GitHub Actions，但最终交付清单明确要求 `.gitlab-ci.yml` 且包含 `unit-test` job。

决策：两者都配置。GitHub Actions 作为主 CI，同时保留 `.gitlab-ci.yml` 以兼容课程 checklist。

原因：避免因格式要求丢分，同时保留用户偏好的工作流。

### Iteration 5 - Action 协议

问题：LLM 应使用什么 action 格式，才能让 parser、guardrail、mock LLM 和冷启动实现都具备确定性？

决策：严格 JSON action object，每轮一个 action。

原因：JSON 最清楚地区分 LLM 决策与 harness 代码。非法输出可被确定性拒绝并转成 feedback。

### Iteration 6 - 工具边界

问题：v1 允许哪些 shell 命令？

决策：使用每个 workspace 自己的窄 command allowlist。默认 TypeScript 命令为 `npm test`、`npm run test`、`npm run lint`、`npm run typecheck`、`npm run build`。

原因：精确 allowlist 让范围可测试，也避免 shell tool 变成无边界远程命令接口。

### Iteration 7 - WebUI 执行边界

问题：WebUI 只展示 mock/demo run，还是也触发真实 harness run？

决策：WebUI 可以触发真实 run，但只能选择预注册 workspace id。

原因：该选择提供更强产品演示，同时保留明确 filesystem 和 command 边界。

### Iteration 8 - WebUI 认证

问题：v1 是否要求 WebUI 管理员密码？

决策：根据用户决定，v1 不设置 password。SPEC 将其记录为已知风险，并通过 workspace registry、path boundary、command allowlist、guardrail 限制真实 run。

原因：用户暂时不想配置口令。设计应记录该 trade-off，而不是隐藏它。

### Iteration 9 - 模块与测试覆盖

问题：设计是否显式满足“至少 3 个职责清晰功能模块”和“一键运行测试”？

决策：SPEC 明确列出六个功能模块，并将 `npm test` 作为一键测试入口。

原因：结构上已经覆盖要求，但显式写入可减少评分歧义。

### Iteration 10 - 文档语言

问题：项目文件应使用什么语言？

决策：项目 Markdown 文档改为中文；代码标识符、命令、配置键保留英文。

原因：用户希望文件都是中文；工程标识符保留英文能避免命令和接口歧义。

### Iteration 11 - Writing Plans

问题：用户暂时确认中文 SPEC 后，如何把粗 PLAN 转换为可交给 subagent 执行的计划？

决策：使用 `superpowers:writing-plans`，将 `PLAN.md` 升级为带文件结构、接口签名、失败测试、验证命令、提交命令的中文实现计划，并同步保存到 `docs/superpowers/plans/2026-07-27-coding-agent-harness-implementation-plan.md`。

原因：课程要求每个 task 颗粒度足够小、路径明确、验证明确，且必须在实现前完成计划。

## 采纳的 AI 建议

- 主要贡献聚焦 guardrail 和 feedback，而不是只写 prompt。
- 使用严格 JSON action 协议，而不是自然语言解析。
- 增加 `remember` action，证明 memory 机制由代码支撑。
- 正式冷启动验证使用 Cursor，而不是新开 Codex chat。
- 工作区（workspace）应预注册并通过 id 选择。

## 被拒绝或修改的建议

- 纯 CLI 被拒绝，因为最终清单要求可访问 WebUI。
- mock/demo-only WebUI 被拒绝，因为用户希望 WebUI 触发真实 harness run。
- WebUI password protection 被推荐但根据用户决定延后。
- `.env` 作为主凭据存储被拒绝，因为要求更安全的凭据管理和威胁模型。

## 冷启动验证

状态：待完成。

计划 agent：Cursor。

提供输入：仅 `SPEC.md` 和 `PLAN.md`。

要求尝试的任务：T2 和 T4。

指令：遇到不确定之处即暂停提问，而不是猜测。

发现：

- 待记录。

后续必须做：

- 记录 Cursor 的问题和不一致理解。
- 修订 `SPEC.md` 和 `PLAN.md`。
- 在本文件中给出关键 before/after diff。
