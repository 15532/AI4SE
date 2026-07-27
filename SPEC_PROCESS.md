# SPEC_PROCESS

状态：准备阶段已启动；Cursor 冷启动验证已完成第一轮模拟，并已据此修订 SPEC/PLAN。

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

状态：已完成第一轮模拟验证，未进入实现。

计划 agent：Cursor。

实际执行方式：根据用户要求，由 Codex 假装为新开的 Cursor session 执行冷启动验证；验证过程中只使用 `SPEC.md` 和 `PLAN.md` 作为任务上下文，不读取既有对话、隐藏上下文或实现代码。

提供输入：仅 `SPEC.md` 和 `PLAN.md`。

要求尝试的任务：T2 和 T3。

指令：遇到不确定之处即暂停提问，而不是猜测。

发现：

- Cursor 会在进入 T2 Step 1 前暂停提问：`PLAN.md` 全局约束说冷启动验证必须在 Task 1 前完成，但冷启动提示又要求尝试 T2/T3；T2/T3 依赖 T1 产物（`package.json`、Vitest、`src/core/actions.ts`、`tests/core/actions.test.ts`），所以新 session 无法判断应该先补 T1、假设 T1 已完成，还是只做静态审查。
- `SPEC_PROCESS.md` 原记录写成“要求尝试的任务：T2 和 T4”，与 `PLAN.md` 冷启动提示和本次用户要求的 T2/T3 不一致。已在本文件修正为 T2/T3。
- T2 中 `src/runtime/guardrails.ts` 被列为创建文件，并要求产出 `GuardrailDecision`，但 T2 的失败测试只覆盖 `parseAction`，没有测试或示例说明 `GuardrailDecision` 应从哪个模块导入。后续 T3 又修改同一文件并实现 `classifyAction`，容易让冷启动 agent 不确定 T2 是否只应创建类型空壳。
- T2 的 parser 边界不足：SPEC 要求 invalid JSON 和 invalid action shape 都转成 `invalid_action`，但 PLAN 只给了 invalid JSON 和 valid `run_command` 两个测试。缺少对 `null`、array、缺失字段、字段类型错误、未知 action type、JSON 外自然语言、额外字段是否允许的明确规则。
- T2 的错误反馈形状只固定了 invalid JSON message；invalid action shape 的 `message`、`payload`、是否保留原始输入没有固定，冷启动 agent 很可能自行发明不一致文案。
- T3 的 guardrail 规则优先级不明确。例：`rm -rf .` 同时命中 destructive delete 和 not allowlisted；`git push` 同时命中 publish/deploy 和 not allowlisted。PLAN 测试期望前者返回 `command.destructive_delete`、后者返回 `command.not_allowlisted`，但 SPEC 没定义优先级，agent 可能实现出不同但看似合理的分类。
- T3 要求实现 `resolveWorkspacePath`，但只提供了 `guardrails.test.ts` 样例，没有提供 `workspace.test.ts` 样例。路径边界细节因此不够稳定，例如绝对路径输入、Windows drive path、大小写差异、符号链接、root 自身、`.`、空路径、路径分隔符规范化如何处理。
- T3 的 sensitive write、secret access、publish/deploy 规则列出了规则名和示例，但没有固定 reason 文案、匹配范围或测试用例。冷启动 agent 可能只实现测试中的三条规则，或自行扩展出不一致行为。
- T2/T3 的提交步骤假定可以直接提交，但全局约束要求冷启动阶段不写实现代码；冷启动提示也要求报告问题。应明确冷启动验证不执行 git commit。

非预期解读：

- Cursor 可能把 T2/T3 理解为“在没有 T1 的仓库里直接实现完整脚手架 + T2/T3”，这会越过 Task 1 的边界。
- Cursor 也可能把 T2 理解为只做 parser，不创建 `src/runtime/guardrails.ts`，导致 T3 之后缺少 `GuardrailDecision` 的稳定导出位置。
- Cursor 可能按自己的安全直觉让 `git push` 返回 `command.publish_or_deploy`，与 PLAN 示例测试要求的 `command.not_allowlisted` 不同。

产出与预期差距：

- 按“有歧义就停止”的冷启动指令，本轮不能进入 TDD 实现 T2/T3，只能产出暂停问题清单。
- 冷启动验证暴露出 PLAN 对 T1 依赖、parser 验证边界和 guardrail 优先级的说明不足。若不修订，后续不同 agent 可能写出测试能过但机制边界不一致的实现。

对 `SPEC.md` / `PLAN.md` 的修订：

- 已修订 `PLAN.md`：冷启动验证目标从 T2/T3 改为 T1/T2，避免 T2/T3 依赖 T1 产物导致新 agent 无法判断执行边界。
- 已修订 `PLAN.md`：冷启动提示词明确“冷启动验证阶段不要执行 git commit”。
- 已修订 `PLAN.md`：补充 T2 的 invalid action shape 测试矩阵，覆盖 `null`、array、missing type、unknown type、wrong field type、extra field，并固定错误文案 `LLM action shape is invalid`。
- 已修订 `SPEC.md`：明确 parser shape validation 规则，要求 JSON action 必须是 object，未知 type、缺失字段、字段类型错误和额外字段都返回 `invalid_action`。
- 已修订 `SPEC.md` 和 `PLAN.md`：明确 guardrail 规则优先级为 destructive delete > secret access/sensitive write > path escape > publish/deploy > not allowlisted > allow。
- 已修订 `PLAN.md`：将 `git push` 期望分类改为 `command.publish_or_deploy`，与 guardrail 优先级一致。
- 已修订 `SPEC.md`：明确 workspace path boundary，覆盖空路径、`.`、绝对路径、Windows/POSIX normalize/resolve 和符号链接风险说明。
- 已修订 `PLAN.md`：为 `tests/runtime/workspace.test.ts` 添加最小失败测试，覆盖 `.`、空路径和 `..` path traversal。

关键 before/after diff 摘要：

```diff
- 请从 PLAN.md 中选择 T2 和 T3，并尝试用 TDD 实现它们。
+ 请从 PLAN.md 中选择 T1 和 T2，并尝试用 TDD 实现它们。
+ 冷启动验证阶段不要执行 git commit。
```

```diff
- T2 只测试 invalid JSON 和 valid run_command。
+ T2 增加 invalid action shape 测试矩阵：
+ null、array、missing type、unknown type、wrong field type、extra field。
+ 错误 message 固定为 "LLM action shape is invalid"。
```

```diff
- git push 期望返回 command.not_allowlisted。
+ git push 期望返回 command.publish_or_deploy。
+ guardrail 优先级固定：
+ destructive delete > secret access/sensitive write > path escape > publish/deploy > not allowlisted > allow。
```

后续必须做：

- 用户 review 本轮修订后的 `SPEC.md` 和 `PLAN.md`。
- 若用户确认，可进入实现阶段；执行前仍应使用 `using-git-worktrees` 和 `subagent-driven-development` / `executing-plans`。
