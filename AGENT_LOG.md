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
