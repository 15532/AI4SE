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
  - 根据用户决定，v1 WebUI 不设置 password
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
