# AGENT_LOG

本日志记录 AI4SE 期末项目 A 的 agent 工作流过程证据。

## 记录

### 2026-07-27 - T0 - 准备基线

- 主 agent：Codex App
- 触发阶段：实现前准备；正式实现前确认规划选择
- 关键上下文：
  - 用户选择 Project A - Coding Agent Harness
  - 技术栈为 TypeScript
  - 产品形态为 CLI + WebUI
  - LLM 接口为 OpenAI-compatible abstraction
  - 凭据存储优先 OS keychain
  - 部署为 Docker + Nginx
  - 冷启动验证 agent 为 Cursor
- 人工决策：
  - 主要贡献：治理护栏 + 反馈闭环
  - CI 偏好：GitHub Actions，同时添加 `.gitlab-ci.yml` 兼容课程要求
  - 初始云端访问控制：暂不配置应用认证
- Agent 动作：
  - 初始化仓库
  - 创建准备文档
  - 在冷启动验证前避免编写 harness 实现代码
- 学到的教训：
  - 必须清晰区分“用于开发的宿主 coding agent”和“交付物中自己实现的 harness kernel”。

### 2026-07-27 - T0 - Superpowers 安装验证

- 主 agent：Codex App
- 触发 Superpowers skill：`using-superpowers`
- 验证证据：
  - 本地插件缓存存在 `C:\Users\sm\.codex\plugins\cache\openai-curated-remote\superpowers\6.2.0\skills\using-superpowers\SKILL.md`
  - 当前会话暴露了 Superpowers skills，包括 `brainstorming`、`writing-plans`、`using-git-worktrees`、`subagent-driven-development`、`test-driven-development`、`requesting-code-review`、`verification-before-completion`
- 人工动作：
  - 用户手动下载/安装 Superpowers 插件；此前 assisted install 被中断
- Agent 动作：
  - 阅读 `using-superpowers` 和 Codex-specific reference instructions
  - 确认插件可被当前 Codex 会话使用
- 学到的教训：
  - 可以开始按课程要求使用 Superpowers 工作流推进 SPEC/PLAN。

### 2026-07-27 - T0 - Superpowers Brainstorming 修订 SPEC

- 主 agent：Codex App
- 触发 Superpowers skill：`brainstorming`
- 关键 prompt/context：
  - 用户显式调用 Superpowers 并要求正式审查/修订 `SPEC.md`
  - 上下文包括 Project A 要求、已有 `SPEC.md`、`PLAN.md`、`SPEC_PROCESS.md` 和此前确认的选择
- 人工确认的关键决策：
  - 使用 Typed JSON Action Harness 架构
  - LLM action 协议为 strict JSON，每轮一个 action
  - v1 shell 执行使用 per-workspace narrow allowlist
  - WebUI 可以触发真实 harness run
  - 当时根据用户决定暂缓 WebUI password；后续已实现服务器 Basic Auth
  - WebUI 只能选择预注册 workspace id，不能输入任意服务器路径
  - 增加 `remember` action，让 memory 成为由代码支撑的机制
- Agent 动作：
  - 在 `docs/superpowers/specs/` 写入 Superpowers 设计文档
  - 修订 `SPEC.md`，明确 action protocol、modules、guardrails、feedback、WebUI boundaries、tests 和 risks
  - 更新 `SPEC_PROCESS.md` 的 brainstorming iterations
- 人工干预：
  - 拒绝 mock/demo-only WebUI，改为 WebUI 可触发真实 run
  - 将 WebUI password/authentication 延后到 v1 之后
- 学到的教训：
  - real-run WebUI 能增强产品展示，但 SPEC 必须直接说明无认证部署风险。

### 2026-07-27 - T0 - 文档中文化

- 主 agent：Codex App
- 触发 Superpowers skill：继续执行 `brainstorming` 的用户 review 修改流程
- 用户要求：
  - 希望文件都使用中文
- Agent 动作：
  - 将项目 Markdown 文档改为中文
  - 保留命令、配置键、类型名、action type 等工程标识符的英文原文
- 决策理由：
  - 中文文档更符合用户提交和阅读习惯
  - 工程标识符保持英文可避免实现时的接口歧义

### 2026-07-27 - T0 - Superpowers Writing Plans 修订 PLAN

- 主 agent：Codex App
- 触发 Superpowers skill：`writing-plans`
- 关键上下文：
  - 用户暂时确认中文 `SPEC.md`
  - 当前仍处于实现前阶段，Cursor 冷启动验证尚未完成
- Agent 动作：
  - 将根目录 `PLAN.md` 从粗任务列表升级为可执行实现计划
  - 写入 Superpowers 计划文件 `docs/superpowers/plans/2026-07-27-coding-agent-harness-implementation-plan.md`
  - 为每个 task 指定文件、接口、失败测试、验证命令和提交命令
- 人工干预：
  - 暂无新的范围变更；沿用已确认的 Typed JSON Action Harness 设计
- 学到的教训：
  - PLAN 不能只列模块名；必须把相邻 task 依赖的接口签名固定下来，否则 cold-start agent 会被迫猜测。

### 2026-07-27 - T0 - 冷启动验证反馈修订

- 主 agent：Codex App
- 触发 Superpowers skill：`verification-before-completion`
- 关键上下文：
  - 用户说明冷启动验证已完成，结果记录在 `SPEC_PROCESS.md`
  - 读取后发现冷启动记录指出 SPEC/PLAN 仍有歧义，尚不能进入实现
- Agent 动作：
  - 修订 `SPEC.md`，固定 parser shape validation、workspace path boundary、guardrail priority
  - 修订 `PLAN.md`，将冷启动目标改为 T1/T2，并补充 invalid action shape 测试矩阵、workspace path 测试和 guardrail 优先级说明
  - 同步更新 `docs/superpowers/plans/2026-07-27-coding-agent-harness-implementation-plan.md`
  - 更新 `SPEC_PROCESS.md`，记录 before/after diff 摘要
- 人工干预：
  - 用户已完成冷启动验证并提供记录入口
- 学到的教训：
  - 冷启动验证的价值在于暴露“看似合理但执行时会分叉”的计划细节，尤其是 task 依赖、错误文案和规则优先级。

### 2026-08-01 - T1-T11 - Harness 核心实现

- 主 agent：Codex App
- 触发 Superpowers skills：
  - `using-git-worktrees`
  - `test-driven-development`
  - `subagent-driven-development`
  - `requesting-code-review`
  - `verification-before-completion`
- 工作区：
  - `feature/core-loop`
- 关键实现提交：
  - `49226c8`：创建 TypeScript 项目脚手架
  - `a1942b1`：新增 Action 协议与解析器
  - `95ad7ec`：新增工作区注册与护栏规则
  - `08d0383`：新增受限工具分发器
  - `1d50505`：新增 Mock LLM 与 Agent 主循环
  - `2e62aec`：新增反馈传感器
  - `c5d7f2d`：新增 SQLite 事件与记忆存储
  - `9c553ab`：新增凭据管理器
  - `67b8815`：新增 CLI 与机制演示
  - `d5c9580`：新增 WebUI 运行控制
  - `975fed4`：新增分发配置、CI 与最终文档
- Agent 动作：
  - 按 PLAN 拆分模块实现 harness core、runtime、store、credentials、CLI、WebUI、Docker 和 CI。
  - 每个核心机制使用 mock/stub LLM 或确定性输入写测试，避免依赖真实 LLM。
  - 在最终审查后修复编译后 CLI/Web 入口、integration gap 和文档验证记录。
- 验证证据：
  - `npm test` 全量通过。
  - `npm run build` 通过。
- 人工干预：
  - 用户要求提交信息改为中文，并要求后续提交前先确认。
  - 用户指出当前实现偏 harness core，要求重新审视是否需要更像可用工具。
- 学到的教训：
  - Project A 的主角不是复制 VS Code，而是自己编码 agent harness 的主循环、工具、治理、反馈、记忆和配置。
  - 但如果 WebUI 过薄，会让评审者误以为项目只是后端 demo；需要一个简单但能展示机制的前端。

### 2026-08-01 - Git 历史整理 - 提交信息中文化

- 主 agent：Codex App
- 用户要求：
  - 所有提交信息使用中文，包括最早几次英文提交。
- Agent 动作：
  - 使用历史重写将 `feature/core-loop` 从首个提交开始改为中文提交信息。
  - 经用户确认后，将本地 `main` 与本地 `origin/main` tracking ref 也移动到对应中文历史节点。
  - 删除会让 VS Code 图表继续显示英文历史的本地备份分支。
- 验证证据：
  - `feature/core-loop` 的 `git log --reverse --format="%h %s"` 从第一条开始均为中文。
  - `git log --all` 不再显示英文提交信息。
  - 工作区保持干净。
- 人工干预：
  - 用户手动负责 push；agent 不推送远端。
- 学到的教训：
  - 为满足课程“完整 commit 历史”要求，历史可读性也很重要；重写已推送历史时必须让用户确认并由用户手动 force push。

### 2026-08-01 - 简单模型前端 V1

- 主 agent：Codex App
- 触发 Superpowers skills：
  - `brainstorming`
  - `writing-plans`
  - `test-driven-development`
  - `verification-before-completion`
- 关键上下文：
  - 用户指出当前实现更像最小 harness core，而不是一个可用工具。
  - 重新阅读 Project A 与通用要求后，确认目标不是完整 VS Code 替代品，而是可用的 Coding Agent Harness。
  - 用户进一步确认当前阶段只做简单模型前端；Open Design 和更 IDE 化界面放到功能完善后。
- Agent 动作：
  - 新增 `docs/superpowers/plans/2026-08-01-simple-model-frontend-v1.md`。
  - 使用 TDD 增强 WebUI：首页展示 workspace、allowlist commands、provider 和任务入口；run 页面按机制标签展示 timeline。
  - 新增 `scripts/start-local.ps1` 简化本地启动流程。
  - 更新 `SPEC.md`、`PLAN.md`、`README.md`，明确当前 WebUI 是功能性简单模型前端，Open Design 后置。
- 验证证据：
  - 新增脚本测试先因 `scripts/start-local.ps1` 缺失而失败，补脚本后通过。
  - WebUI 新测试先因缺少“简单模型前端”和机制分区标签而失败，更新 `src/web/views.ts` 后通过。
  - `npm test`：13 个测试文件、91 个测试通过。
  - `npm run build`：通过。
- 人工干预：
  - 用户确认脚本顺便放到后续提交。
  - 用户确认进入简单模型前端 V1 范围。
- 相关提交：
  - `27bf8c6`：功能：增强简单模型前端与本地启动脚本
- 学到的教训：
  - 前端目前应服务于 harness 机制可解释性，而不是提前投入完整 IDE 体验。
  - Open Design 是后续 UI 阶段的推荐工具，不应在核心 harness 还未完全闭环时扩大范围。

### 2026-08-01 - DeepSeek Provider 接入

- 主 agent：Codex App
- 触发 Superpowers skills：
  - `brainstorming`
  - `writing-plans`
  - `test-driven-development`
- 用户要求：
  - 直接接入真实 LLM，并明确选择 DeepSeek。
- Agent 决策：
  - 选择 DeepSeek OpenAI-compatible Chat Completions 方案。
  - 默认 provider id 为 `deepseek`，模型为 `deepseek-v4-flash`。
  - 使用 `DEEPSEEK_API_KEY` 作为本地和部署环境变量。
  - 一键测试继续使用 mock / fake fetch，不依赖真实网络或真实 key。
- Agent 动作：
  - 新增 `docs/superpowers/plans/2026-08-01-deepseek-provider.md`。
  - 扩展 YAML provider 配置解析，支持 `deepseek-compatible`。
  - 新增 `OpenAICompatibleProvider`，向 DeepSeek `/chat/completions` 发送 strict JSON action prompt。
  - WebUI provider 从 hidden input 改为下拉选择。
  - CLI 与 WebUI 通过同一 provider factory 选择 mock 或 DeepSeek。
  - 缺少 DeepSeek key 时，WebUI 返回结构化 400 错误。
- TDD 证据：
  - 配置测试先失败于 `Unsupported provider type: deepseek-compatible`。
  - Provider 测试先失败于 `OpenAICompatibleProvider is not a constructor`。
  - WebUI provider 选择测试先失败于 hidden provider input。
  - 缺 key 测试先失败于 provider 错误冒泡。
- 学到的教训：
  - 真实 provider 接入不应破坏 harness 的确定性测试边界。
  - 真实 LLM 只替换“决策来源”，不能绕过 parser、guardrail、tool dispatcher 或 feedback loop。

### 2026-08-01 - 方案 A：可用 Coding Agent Loop V1

- 主 agent：Codex App
- 触发 Superpowers skills：
  - `brainstorming`
  - `writing-plans`
  - `test-driven-development`
  - `verification-before-completion`
- 关键上下文：
  - 用户指出当前产物看起来更像测试用例，希望具备类似 Codex 的完整逻辑链路，能真正用于代码开发。
  - 经讨论确认先做方案 A：补完整可用 coding loop；方案 B：更 IDE 化的 WebUI 后续再做。
- Agent 动作：
  - 新增 `docs/superpowers/plans/2026-08-01-coding-agent-usable-loop-v1.md`。
  - 增强 `buildContext`，让模型看到任务、workspace、可用 action schema、allowed commands、memory、feedback 和工作规则。
  - 增强 DeepSeek provider system prompt，要求先 inspect、按严格 JSON action 工作、写代码后执行允许的验证命令、不要因简单问候过早 finish。
  - 修改 loop 控制流，让 `invalid_action` 和 `safety_blocked` 在仍有迭代次数时进入下一轮自修正，而不是立即终止。
  - 新增 `runCodingTaskDemo()` 和 `npm run demo:coding-task`，在临时 workspace 中确定性执行 `list_files`、`read_file`、`write_file`、`run_command`、`finish`。
- TDD 证据：
  - context/provider 测试先因缺少工具协议和工作策略失败，增强提示后通过。
  - loop 自修正测试先因返回 `blocked` 失败，修改控制流后通过。
  - coding-task demo 测试先因缺少 `src/demo/coding-task.ts` 入口失败，实现 demo 后通过。
- 人工干预：
  - 用户要求本轮先做方案 A，再做方案 B。
  - 用户此前要求提交前必须先确认，因此本轮完成验证后等待用户确认再提交。
- 学到的教训：
  - “真实可用”不等于做一个大 UI；先要证明 harness 能完整控制模型决策、工具执行、安全反馈和验证闭环。
  - 可用 loop 的核心证据应是能在临时项目中真实改文件并跑测试，而不是只展示模型返回文本。

### 2026-08-01 - 方案 B：轻量智能 IDE 壳层 V1

- 主 agent：Codex App
- 触发 Superpowers skills：
  - `brainstorming`
  - `writing-plans`
  - `test-driven-development`
  - `verification-before-completion`
- 关键上下文：
  - 用户要求按推荐方案推进，并一次完成所有任务后再询问。
  - 方案 B 第一版选择轻量智能 IDE 壳层，而不是直接实现完整 VS Code 替代品。
- Agent 动作：
  - 新增 `docs/superpowers/specs/2026-08-01-ide-shell-design.md`。
  - 新增 `docs/superpowers/plans/2026-08-01-ide-shell-v1.md`。
  - 将首页从简单表单升级为三栏工作台：`workspace-rail`、`task-composer`、`run-inspector`。
  - 将运行详情页升级为 `Run Inspector`，包含 `timeline-navigator` 与 `event-detail-stack`。
  - 保持 `/api/runs`、`/api/workspaces`、`/runs/:id` 行为不变，不暴露 workspace root 或 API key。
- Open Design 处理：
  - 课程推荐 Open Design 用于 UI。本轮不直接引入 Open Design runtime，选择低依赖、可测试的 server-rendered IDE 壳层。
  - `SPEC.md` 已说明 Open Design 作为后续文件预览、diff、浏览器内编辑器和视觉系统增强的设计参考。
- TDD 证据：
  - 首页布局测试先因缺少 `智能 IDE 工作台`、`workspace-rail`、`task-composer`、`run-inspector` 失败，更新 `renderIndex` 后通过。
  - 运行详情测试先因缺少 `Run Inspector`、`timeline-navigator`、`event-detail-stack` 失败，更新 `renderRun` 后通过。
- 学到的教训：
  - 对课程项目来说，UI 的价值是帮助评审者看清 harness 的工程链路，而不是提前堆复杂编辑器。
  - Server-rendered UI 仍然可以做出清晰的 IDE 信息架构，并保持测试简单可靠。

### 2026-08-01 - Workspace Session V1：上下文记忆与代码查看

- 主 agent：Codex App
- 触发 Superpowers skills：
  - `brainstorming`
  - `writing-plans`
  - `test-driven-development`
  - `verification-before-completion`
- 关键上下文：
  - 用户指出系统仍像一次性任务，希望更接近 Codex，具备工作区上下文记忆和代码查看。
  - 讨论后确定路线：先做 Workspace Session V1 + Code Viewer，再继续 Diff Inspector V1。
- Agent 动作：
  - 新增 `docs/superpowers/specs/2026-08-01-workspace-session-v1-design.md`。
  - 新增 `docs/superpowers/plans/2026-08-01-workspace-session-v1.md`。
  - 新增 `src/runtime/workspace-explorer.ts`，提供只读文件列表和文本文件读取。
  - 扩展 `EventStore`，支持 `listRecentRuns` 与 `summarizeRun`。
  - 扩展 `buildContext` 和 `runAgentLoop`，让后续 run 继承同 workspace 最近 run 摘要。
  - 扩展 WebUI，新增 code viewer、memory panel、recent runs，并提供只读文件 API。
- TDD 证据：
  - workspace explorer 测试先因模块缺失失败，实现后通过。
  - EventStore recent run 测试先因方法缺失失败，实现后通过；同秒创建排序问题通过 `rowid DESC` 修复。
  - context/loop recent runs 测试先因缺少 `Recent runs` 失败，实现后通过。
  - WebUI 文件 API 与 session panel 测试先因 404/缺少 panel 失败，实现后通过。
- 学到的教训：
  - 接近 Codex 的关键不是一次 run 更强，而是 workspace 级连续上下文、可见代码和可解释历史。
  - 文件查看必须是只读能力，并继续沿用 workspace boundary，不能为了 UI 便利绕过 harness 安全模型。

### 2026-08-01 - Diff Inspector V1：工作区变更查看

- 主 agent：Codex App
- 触发 Superpowers skills：
  - `brainstorming`
  - `writing-plans`
  - `test-driven-development`
  - `verification-before-completion`
- 关键上下文：
  - 用户确认继续按“Workspace Session V1 -> Diff Inspector V1 -> Interactive Run V1”的路线推进。
  - 本轮目标只做“看见变化”，不做浏览器内编辑、回滚、accept/reject 或逐行审阅。
- Agent 动作：
  - 新增 `docs/superpowers/specs/2026-08-01-diff-inspector-v1-design.md`。
  - 新增 `docs/superpowers/plans/2026-08-01-diff-inspector-v1.md`。
  - 新增 `src/runtime/diff-inspector.ts`，封装 `git status --porcelain=v1`、`git diff -- <path>` 和未跟踪文本文件的虚拟 diff。
  - 扩展 WebUI API：`GET /api/workspaces/:id/changes` 与 `GET /api/workspaces/:id/changes/<relativePath>`。
  - 扩展运行详情页，加入 `diff-inspector` 区块展示当前 workspace 的 git 变更摘要。
  - 更新 `README.md`、`SPEC.md` 和最终交付清单，将后续路线推进到 Interactive Run V1。
- TDD 证据：
  - `tests/runtime/diff-inspector.test.ts` 先因 `src/runtime/diff-inspector` 缺失失败。
  - `tests/web/server.test.ts` 先因 changes API 返回 404、运行详情页缺少 `diff-inspector` 失败。
  - runtime 初次实现后暴露两个边界：Windows 用户目录父级 git repo 会误吸收临时目录；排序受 locale 影响。通过要求 workspace root 是 git 顶层仓库、使用状态优先级排序修复。
  - `npm.cmd test -- tests/runtime/diff-inspector.test.ts tests/web/server.test.ts` 通过：2 个测试文件、23 个测试。
- 学到的教训：
  - diff 能力看似只是调用 git，但安全边界必须明确，否则临时目录或子目录可能被父级 repo 误识别。
  - 对课程演示来说，先展示“agent 改了哪些文件”比立刻做浏览器编辑器更能补齐可用工具的信任链路。

### 2026-08-01 - Interactive Run V1：持久化 Session 与连续指令

- 主 agent：Codex App
- 触发 Superpowers skills：
  - `brainstorming`
  - `writing-plans`
  - `test-driven-development`
  - `verification-before-completion`
- 关键上下文：
  - 用户确认进入 Interactive Run V1，并说明未来会部署到服务器。
  - 因服务器部署需求，本轮明确避免进程内 session、WebSocket 和长连接，改用 SQLite 持久化 session 与普通 HTTP 表单/API。
- Agent 动作：
  - 新增 `docs/superpowers/specs/2026-08-01-interactive-run-v1-design.md`。
  - 新增 `docs/superpowers/plans/2026-08-01-interactive-run-v1.md`。
  - 扩展 SQLite schema，新增 `sessions` 和 `session_runs`。
  - 扩展 `EventStore`，支持 `createSession`、`getSession`、`listSessions`、`listSessionRuns`，以及 `createRun(..., sessionId)`。
  - 扩展 `runAgentLoop`，支持可选 `sessionId`，使真实 run 能被挂到 session 下。
  - 扩展 WebUI API：`POST /api/sessions`、`GET /api/sessions/:id`、`POST /api/sessions/:id/runs`。
  - 新增 `/sessions/:id` 页面，包含继续指令表单、session run 列表、workspace memory 和 diff inspector。
  - 首页新增 `session-composer`，用户可从浏览器创建 interactive session。
  - 修复 redaction 幂等性，避免已经是 `[REDACTED]` 的内容再次经过响应过滤后变形。
- TDD 证据：
  - EventStore session 测试先因 `store.createSession is not a function` 失败，实现 schema/store 后通过。
  - Web session API 测试先因 `/api/sessions` 404 失败，实现 API 后通过。
  - Session 页面测试先因 `/sessions/:id` 404 失败，实现 `renderSession` 后通过。
  - 首页入口测试先因缺少 `session-composer` 失败，补充表单后通过。
- 学到的教训：
  - “接近 Codex”不一定要一次性实现流式长生命周期 run；先把同 workspace 的连续意图、历史 run、memory 和 diff 串成 session，就能显著提升可用性。
  - 未来服务器部署时，session、run、event、memory 都必须依赖持久化 SQLite volume；否则重启服务会破坏用户的连续工作上下文。
  - WebUI 无认证叠加真实 provider 与 interactive session 会放大风险，公网前必须补认证或反向代理访问控制。

### 2026-08-02 - Approval V1：人工审批发布/部署动作

- 执行 agent：Codex App
- 触发 Superpowers skills：
  - `brainstorming`
  - `writing-plans`
  - `test-driven-development`
  - `verification-before-completion`
- 关键上下文：
  - 用户确认按后续路线推进，并要求 Approval V1 可以先做简单版本。
  - 因未来会部署到服务器，本轮选择保守策略：审批不能绕过 workspace allowlist；只有已经被 allowlist 显式允许的发布/部署命令才进入人工审批。
- Agent 动作：
  - 新增 `docs/superpowers/specs/2026-08-02-approval-v1-design.md`。
  - 新增 `docs/superpowers/plans/2026-08-02-approval-v1.md`。
  - 扩展 guardrail：allowlist 内的发布/部署命令返回 `require_approval`；未 allowlist 的命令仍返回 `command.not_allowlisted`。
  - 扩展 SQLite schema 与 `EventStore`，新增审批记录创建、查询、待审批列表、批准和拒绝。
  - 扩展 `runAgentLoop`，遇到 `require_approval` 时写入 `approval_required` 事件并以 `pending_approval` 停止。
  - 扩展 WebUI，新增 Approval Panel 与 `/api/approvals/:id/approve`、`/api/approvals/:id/reject`。
  - 更新 `README.md`、`SPEC.md` 和最终交付清单中的审批说明。
- TDD 证据：
  - guardrail 测试先因发布命令仍被硬 block 失败，更新分类后通过。
  - EventStore 测试先因 `createApproval` 不存在失败，实现审批表和方法后通过。
  - loop 测试先因状态不是 `pending_approval` 失败，实现暂停后通过。
  - WebUI 测试先因缺少审批记录/API/UI 失败，实现审批路由和面板后通过。
- 学到的教训：
  - 人工审批不是 prompt 约束，而应是 harness 状态机的一部分。
  - 服务器部署场景下，审批应作为额外安全门，而不是绕过 allowlist 的后门。

### 2026-08-03 - 凭据安全 V2：加密凭据文件

- 主 agent：Codex App
- 触发 Superpowers skills：
  - `test-driven-development`
  - `verification-before-completion`
- 关键上下文：
  - 用户询问“凭据安全必须补强”是否已经完成。
  - 此前 DeepSeek 可接入真实模型，但凭据主要依赖环境变量 fallback。
- Agent 动作：
  - 新增 `EncryptedFileKeychainAdapter`，使用 AES-256-GCM 与 `HARNESS_MASTER_PASSWORD` 加密完整凭据映射。
  - 新增 `createDefaultCredentialManager()`，让 CLI 与 WebUI 共用加密凭据解析链路。
  - DeepSeek provider 优先读取加密凭据文件，其次读取 `DEEPSEEK_API_KEY`。
  - 更新 `.env.example`、README、SECURITY、SPEC、Docker Compose、启动脚本和交付清单。
- TDD 证据：
  - 凭据测试覆盖：加密文件不含 key 明文、不含 provider 名明文、同主密码可重开读取、缺主密码不能写入。
  - CLI 测试覆盖：`credentials set/status` 写入加密文件且不泄漏 secret。
  - WebUI 测试覆盖：DeepSeek run 使用加密凭据优先于环境变量 fallback。
- 验证证据：
  - `npm.cmd run check:acceptance -- -AllowDirty` 通过。
  - 已提交：`d8a3fad 安全：实现加密凭据存储`。
- 学到的教训：
  - 对课程项目来说，安全能力不只写在 README；必须有代码路径和测试证明 secret 不进入日志、响应或仓库。

### 2026-08-03 - WebUI Basic Auth 与公网访问控制

- 主 agent：Codex App
- 触发 Superpowers skills：
  - `brainstorming`
  - `test-driven-development`
  - `verification-before-completion`
- 关键上下文：
  - 用户确认未来会部署在服务器上。
  - WebUI 已能触发真实 harness run、DeepSeek、interactive session 和人工审批，因此公网裸露风险变高。
- Agent 动作：
  - `createServer()` 新增可选 `webAuth`。
  - `createDefaultServer()` 从 `WEBUI_ADMIN_PASSWORD` / `WEBUI_ADMIN_USER` 启用 Basic Auth。
  - 所有 WebUI 页面和 API 在同一入口统一认证。
  - 更新启动脚本、compose、README、SECURITY、SPEC 和交付清单。
- TDD 证据：
  - 未认证访问页面先失败于返回 200，期望 401。
  - 错误认证访问 API 先失败于返回 200，期望 401。
  - 实现后，未认证/错误认证返回 401，正确认证可访问页面与 API，响应不包含配置口令。
- 验证证据：
  - `npm.cmd test -- tests/web/server.test.ts tests/scripts/start-local.test.ts` 通过。
  - `npm.cmd run check:acceptance -- -AllowDirty` 通过。
- 学到的教训：
  - 服务器部署安全不能只靠“请用户自行配置 Nginx”的文字建议；项目自身也要有最低访问控制。

### 2026-08-03 - 分发与 CI/CD 记录

- 主 agent：Codex App
- 触发 Superpowers skills：
  - `test-driven-development`
  - `systematic-debugging`
  - `verification-before-completion`
- Agent 动作：
  - 新增 `.dockerignore`，排除本地依赖、构建产物、运行数据、日志、`.env`、SQLite 和加密凭据。
  - 新增 `docs/DISTRIBUTION.md`，记录 build/run/compose/registry 命令和当前 Docker CLI 不可用的验证状态。
  - 新增 `docs/CI_CD_RECORD.md`，记录 GitHub Actions、GitLab CI、最近远端 CI success 链接和 PR 工作流待办。
- TDD / 调试证据：
  - Docker build context 测试先因 `.dockerignore` 缺失失败，补文件后通过。
  - `docker build -t ai4se-coding-agent-harness:local .` 在当前机器失败，根因是 Docker CLI 未安装；手工确认常见 Docker Desktop 路径也不存在。
  - 一次 WebUI 测试中的临时 `git init` 失败无法稳定复现；同类手工命令成功，重跑测试组通过，判断为短暂环境抖动。
- CI 证据：
  - GitHub API 显示最近远端 `unit-test` run 成功：`https://github.com/15532/AI4SE/actions/runs/30786355322`。
  - 对应 commit：`78070cea36c0af89617812ffd46627d9dac9b5b2`。
  - 当前本地新提交和未提交改动尚未 push，因此还需要用户手动 push 后补最新 CI 链接。
- 学到的教训：
  - 分发闭环应诚实记录环境限制；不能伪造 registry 或 Docker build 结果。

### 2026-08-03 - DeepSeek 循环收尾增强

- 主 agent：Codex App
- 触发 Superpowers skills：
  - `brainstorming`
  - `systematic-debugging`
  - `test-driven-development`
  - `verification-before-completion`
- 关键上下文：
  - 用户在 WebUI 中用 `deepseek-sandbox` 测试“写一个冒泡排序”时，出现过 `max_iterations`，并且模型重复查看文件或重复执行相似动作，没有及时返回 `finish`。
  - WebUI 已经隐藏 mock 并默认 DeepSeek，因此真实模型的执行稳定性会直接影响项目可用性。
- 根因判断：
  - harness 已能解析 action、执行工具、写入反馈和展示结果；问题主要在循环协议对“预算”和“重复动作”的约束不够明确。
  - 模型在最后几轮没有看到强制收尾提示，连续重复工具调用也只被记录为成功工具结果，没有形成可读的纠偏反馈。
- Agent 动作：
  - 在 `runAgentLoop` 中为每轮上下文追加 `Loop control`，包含剩余迭代次数。
  - 在最后一轮明确要求：若已有足够信息，必须返回 `finish`，并用中文说明修改内容、跳过原因或验证结果。
  - 新增 `duplicate_action` feedback，当模型连续返回同一个动作签名时，在下一轮提示“不要连续重复同一个动作”，并要求根据已有结果换动作或收尾。
  - 为上述行为补充 TDD 回归测试，覆盖最后一轮提示和重复动作反馈。
- 验证证据：
  - 新增测试先失败于缺少 `剩余迭代次数` 与 `duplicate_action`。
  - 实现后，定向测试 `npm.cmd test -- tests/core/loop.test.ts -t "final-iteration|repeated actions"` 通过。
- 学到的教训：
  - 真实 LLM 接入后，不能只依赖 system prompt；循环本身也要给模型提供明确的状态机信息。
  - “工具调用成功”不等于“任务朝完成推进”，重复动作需要被视为可反馈的行为信号。

### 2026-08-03 - DeepSeek 沙箱 smoke test

- 运行命令：`node dist/src/cli/main.js run --workspace deepseek-sandbox --provider deepseek --task "...冒泡排序..."`
- 运行 ID：`c33eb4c1-6237-4c99-8cef-86c1073a2ca2`
- 结果：`finished`
- 实际链路：
  - DeepSeek 先读取 `src/index.js`，确认 `bubbleSort` 已实现。
  - 随后运行 `npm test`，沙箱内 2 个 node test 全部通过。
  - 模型又重复运行了一次 `npm test`，harness 写入 `duplicate_action` warning。
  - 下一轮模型返回中文 `finish`：说明 `src/index.js` 已实现、未修改文件、`npm test` 通过且 2 个测试全部通过。
- 后续优化点：
  - 当前 `duplicate_action` 能把模型从重复动作中拉回收尾，但仍允许重复动作先执行一次。
  - 后续可以考虑在“同一验证命令刚成功后”增加更强的完成提示，减少重复执行成本。

### 2026-08-03 - 重复动作执行前拦截

- 主 agent：Codex App
- 触发 Superpowers skills：
  - `test-driven-development`
  - `verification-before-completion`
- 目标：
  - 将 `duplicate_action` 从“工具执行后的提示”前移为“工具执行前的拦截反馈”，减少真实 DeepSeek 反复运行同一命令的成本。
- Agent 动作：
  - 扩展 `tests/core/loop.test.ts`，要求连续重复同一 `list_files` 时只产生 1 条 `tool_result`。
  - 先运行定向测试，确认当前实现失败于重复产生 2 条 `tool_result`。
  - 修改 `runAgentLoop`：非 `finish` action 在 guardrail 和 tool dispatch 前检查 action signature；若与上一条已执行 action 相同，则仅记录 `duplicate_action` feedback 并进入下一轮。
- 验证证据：
  - 红灯：`npm.cmd test -- tests/core/loop.test.ts -t "feeds repeated actions"` 失败，提示期望 1 条 `tool_result`，实际为 2 条。
  - 绿灯：实现后同一命令通过，`tests/core/loop.test.ts` 全部 14 个测试通过。

### 2026-08-03 - 当前 run 验证优先级补强

- 触发背景：
  - 重复动作前置拦截后，真实 DeepSeek smoke test 一度直接引用上一轮摘要返回 `finish`，没有在当前 run 中重新执行用户要求的 `npm test`。
- Agent 动作：
  - 在 `buildContext` 操作规则中明确：Recent runs 只能作为背景上下文；如果当前任务要求验证，必须在本轮 run 中验证。
  - 在 DeepSeek system prompt 中补充同样规则：不能把 previous run summaries 当作当前任务的证明。
  - 为 context 和 provider prompt 增加 TDD 断言。
- 验证证据：
  - 新增断言先失败于缺少 recent-run 约束提示。
  - 实现后，`tests/core/context.test.ts` 与 `tests/core/providers.test.ts -t "coding agent"` 通过。
  - 真实 DeepSeek smoke test `1f085cfc-c4c5-4514-9fc4-df0ba9c2543e` 在当前 run 中执行了 `npm test`，2 个测试通过；后续重复 `npm test` 被 `duplicate_action` 前置拦截，未产生第二条命令执行结果，并最终中文 `finish`。
- 剩余观察：
  - DeepSeek 偶尔会在 JSON 后追加自然语言或反引号，当前 feedback loop 可以恢复，但后续可考虑在 parser 层增加更友好的“提取首个 JSON object”容错或在 prompt 中继续收紧。

### 2026-08-04 - Parser 容错：提取首个 JSON action

- 主 agent：Codex App
- 触发 Superpowers skills：
  - `test-driven-development`
  - `verification-before-completion`
- 背景：
  - 真实 DeepSeek run 中出现过 `{"type":"run_command",...}` 后追加自然语言，或 JSON 后带多余反引号的输出。
  - 旧 parser 会把这类输出全部判为 `invalid_action`，feedback loop 可以恢复，但 WebUI 会多出噪声事件，真实 run 也会浪费迭代次数。
- Agent 动作：
  - 在 `tests/core/actions.test.ts` 新增三个失败用例：JSON 后跟解释文字、JSON 后跟 dangling backtick、`write_file.content` 字符串内包含花括号时仍能正确提取。
  - 在 `src/core/actions.ts` 增加 `extractFirstJsonObject()`，从第一个 `{` 开始扫描并计数花括号，同时正确处理字符串和转义字符。
  - parser 只在完整 JSON parse 失败后尝试提取首个 JSON object；提取成功后仍走原有 `isAction()` 严格校验，因此额外字段、未知 action、字段类型错误仍会被拒绝。
- 验证证据：
  - 红灯：新增 actions 测试先失败 3 项，均为 `LLM output is not valid JSON`。
  - 绿灯：实现后 `tests/core/actions.test.ts` 15 个测试通过；`tests/core/actions.test.ts tests/core/loop.test.ts tests/core/providers.test.ts` 共 34 个测试通过。

### 2026-08-04 - Provider 临时错误恢复

- 执行 agent：Codex App
- 触发 Superpowers skills：
  - `systematic-debugging`
  - `test-driven-development`
  - `verification-before-completion`
- 背景：
  - WebUI 真实提交任务后，DeepSeek 在完成 `npm test` 工具调用之后返回一次 503。
  - 旧行为是在 WebUI 后台层捕获异常并直接记录 `provider_error` stop，导致 run 变成 `blocked`，模型没有机会基于已经完成的工具结果返回 `finish`。
- 根因：
  - `runAgentLoop` 内部没有捕获 `provider.complete(...)` 异常。
  - WebUI 的后台兜底只能保证进程不崩溃，不能把 provider 抖动作为模型可读反馈写回下一轮上下文。
- Agent 动作：
  - 在 `Feedback.source` 中加入 `provider_error`。
  - 新增 `feedbackFromProviderError()`，把 provider 异常转为结构化反馈并进入事件流。
  - 在 `runAgentLoop` 中捕获 provider 异常：非最后一轮继续迭代；最后一轮记录 `provider_error` stop 并返回 `blocked`。
- TDD 证据：
  - 红灯：新增 `tests/core/loop.test.ts` 两个用例，先失败于 provider 异常直接抛出。
  - 绿灯：实现后定向测试 `npm.cmd test -- tests/core/loop.test.ts` 通过，16 个测试全部通过。
- 学到的教训：
  - 真实 LLM 接入必须把网络/API 抖动纳入 harness 状态机，而不是只依赖 WebUI 兜底异常处理。
  - 已完成的工具结果比一次 provider 503 更重要；只要还有迭代预算，就应保留上下文并给模型收尾机会。
