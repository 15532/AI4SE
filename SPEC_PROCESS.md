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

决策：当时根据用户决定暂缓应用层 password。2026-08-03 已被后续 Basic Auth 决策取代：本地默认关闭，服务器通过 `WEBUI_ADMIN_PASSWORD` 启用。

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
- WebUI password protection 最初被推荐但根据用户决定延后；后续已实现可选 Basic Auth。
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

## 后续实施更新（2026-08-03）

### Iteration 12 - DeepSeek 与 WebUI 默认入口

问题：WebUI 普通入口是否仍应暴露 mock provider？

决策：WebUI 默认使用 DeepSeek，并隐藏 mock；mock 只保留给离线测试、机制演示、CLI/API 调试。

原因：用户希望浏览器主流程是真实模型前端，而不是看起来像 mock demo。课程仍需要 mock/stub 做确定性测试，因此不能删除 mock。

### Iteration 13 - 凭据安全 V2

问题：仅依赖 `.env` 或环境变量是否足以满足凭据安全要求？

决策：实现加密凭据文件。`HARNESS_CREDENTIAL_STORE_PATH` 指向 AES-256-GCM 密文 JSON，`HARNESS_MASTER_PASSWORD` 用于派生密钥。CLI 和 WebUI 均优先读取加密凭据，其次才读取 `DEEPSEEK_API_KEY` fallback。

原因：真实 DeepSeek key 不应长期以明文 `.env` 作为主存储；同时跨平台课程环境不一定有统一 OS keychain。

验证证据：

- `npm.cmd run check:acceptance -- -AllowDirty` 通过。
- 加密凭据测试确认密文文件不含 provider 名或 key 明文。
- 提交：`d8a3fad 安全：实现加密凭据存储`。

### Iteration 14 - WebUI 公网访问控制

问题：未来部署到服务器时，WebUI 可触发真实 harness run，是否需要项目自身访问控制？

决策：加入可选 Basic Auth。本地默认关闭；服务器通过 `WEBUI_ADMIN_PASSWORD` 启用，用户名默认 `admin`，可用 `WEBUI_ADMIN_USER` 覆盖。

原因：只依赖“请配置 Nginx”的文档不足以证明项目自身具备最低安全边界。Basic Auth 简单、可测、部署成本低，后续仍可叠加 HTTPS、反向代理、VPN 或 SSO。

TDD 证据：

- 新增 WebUI Basic Auth 测试先失败于未认证/错误认证仍返回 200。
- 实现后，未认证和错误认证返回 401，正确认证可访问页面和 API，响应不泄漏口令。

### Iteration 15 - 分发闭环

问题：Docker 分发是否只写了命令，还是有构建上下文与验证记录？

决策：补 `.dockerignore` 与 `docs/DISTRIBUTION.md`。`.dockerignore` 排除 `node_modules/`、`dist/`、`data/`、`logs/`、`.env`、SQLite、日志和加密凭据文件。

验证证据：

- 新增 Docker build context 测试先因 `.dockerignore` 缺失失败，补文件后通过。
- 当前机器未安装 Docker CLI，`docker build -t ai4se-coding-agent-harness:local .` 返回 `docker` 命令不存在；需要在有 Docker 的机器上补跑。

### Iteration 16 - CI/CD 与 PR 记录

问题：最终交付需要 CI/CD pass 和 PR 工作流证据，当前有哪些可证明内容？

决策：新增 `docs/CI_CD_RECORD.md`，记录 GitHub Actions、GitLab CI 配置、最近远端 CI success 链接和 PR 工作流待办。

验证证据：

- GitHub API 查询最近一次远端 `unit-test`：`feature/core-loop`、commit `78070cea36c0af89617812ffd46627d9dac9b5b2`、结果 `success`。
- 链接：`https://github.com/15532/AI4SE/actions/runs/30786355322`。
- GitHub API 查询当前仓库未发现 PR 记录；PR 创建/合并需由用户在 GitHub 上完成。

### Iteration 17 - DeepSeek 循环预算与重复动作反馈

问题：真实 DeepSeek run 在简单代码任务中可能持续探索、重复 `list_files` 或 `read_file`，最终达到 `max_iterations`，导致 WebUI 中没有自然的中文完成摘要。

决策：不把该问题作为 WebUI 展示问题处理，而是在 core loop 层补充循环状态信号。每轮上下文追加剩余迭代次数；最后一轮明确要求模型返回 `finish` 并用中文总结。连续重复同一动作时，写入 `duplicate_action` feedback，提醒模型换下一步或收尾。

原因：Project A 的关键评分点是 harness 机制，而不是单纯 prompt。将预算和重复动作做成代码级反馈，可以被 mock/stub LLM 测试稳定覆盖，也能改善真实 DeepSeek 接入后的行为。

验证：新增 `tests/core/loop.test.ts` 回归测试，先确认缺少预算提示与重复动作反馈时失败，再实现 `Loop control` 与 `duplicate_action` 后通过。定向命令为 `npm.cmd test -- tests/core/loop.test.ts -t "final-iteration|repeated actions"`。

#### Iteration 17 验证补充 - 真实 DeepSeek smoke test

执行命令：`node dist/src/cli/main.js run --workspace deepseek-sandbox --provider deepseek --task "...冒泡排序..."`

结果：运行 ID `c33eb4c1-6237-4c99-8cef-86c1073a2ca2`，状态 `finished`。DeepSeek 读取 `src/index.js` 后运行 `npm test`，沙箱内 2 个测试通过。模型随后重复执行了一次 `npm test`，harness 记录 `duplicate_action` warning；下一轮模型根据反馈返回中文 `finish`，摘要说明未修改文件、冒泡排序已实现、验证通过。

结论：本轮补强已改善真实 DeepSeek 的收尾能力，能把重复动作转化为模型可读反馈并促使其返回中文完成摘要。剩余改进点是进一步减少“重复验证命令已经执行后才反馈”的成本。

#### Iteration 17 后续优化 - 重复动作执行前拦截

问题：第一次实现会在重复动作执行后才产生 `duplicate_action`，因此真实 DeepSeek smoke test 中仍重复运行了一次 `npm test`。

决策：将重复动作检测前移到 guardrail 与 tool dispatch 之前。若当前非 `finish` action 的签名与上一条已执行 action 相同，harness 不再执行工具，而是直接写入 `duplicate_action` feedback 并进入下一轮。

验证：扩展 `tests/core/loop.test.ts`，要求重复动作场景只产生 1 条 `tool_result`。该测试先失败于实际产生 2 条 `tool_result`，实现前置拦截后通过。

#### Iteration 17 后续优化 - 当前 run 验证优先

问题：真实 DeepSeek 可能把上一轮 recent run 摘要当作当前任务的验证证据，直接返回 `finish`，导致用户要求“请运行 npm test”时没有在当前 run 中执行验证。

决策：在 context 操作规则和 DeepSeek system prompt 中同时声明：Recent runs 只是背景上下文，不能作为当前任务证明；若当前任务要求验证，必须在本轮 run 中执行允许的验证命令。

验证：新增 context/provider prompt 测试先失败，补充规则后通过。真实 smoke test `1f085cfc-c4c5-4514-9fc4-df0ba9c2543e` 显示 DeepSeek 在当前 run 中执行了 `npm test`，2 个测试通过；随后重复 `npm test` 被 `duplicate_action` 前置拦截，没有再次执行命令，最终返回中文 `finish`。

### Iteration 18 - Parser 容错与严格 schema 并存

问题：真实 DeepSeek 偶尔会返回 `JSON action + 自然语言解释`，或在 JSON 后多出反引号。旧 parser 会把它们判为 `invalid_action`，虽然 feedback loop 能恢复，但会增加噪声和迭代成本。

决策：parser 先尝试解析完整响应；失败后只提取第一个完整 JSON object。提取算法必须支持字符串中的花括号和转义字符，避免误截 `write_file.content`。提取出的对象仍必须通过原有严格 action schema 校验，不能因此接受额外字段、未知 action 或错误字段类型。

验证：新增三个 actions 测试先失败，覆盖尾部 prose、尾部反引号、字符串中花括号。实现 `extractFirstJsonObject()` 后，`tests/core/actions.test.ts` 15 个测试通过，并联动验证 actions/loop/providers 共 34 个测试通过。

### Iteration 19 - Provider 临时错误进入反馈循环

问题：WebUI 真实 run 中，DeepSeek 在工具调用已经成功后返回了一次 503。旧实现由 WebUI 后台层捕获异常并直接把 run 标记为 `blocked`，导致模型无法看到“工具已成功、但 provider 临时失败”的上下文，也无法返回最终中文摘要。

决策：把 provider 异常处理下沉到 `runAgentLoop`。当 `provider.complete()` 抛错时，harness 记录 `provider_error` feedback；如果还剩迭代预算，则继续下一轮，把错误和已有工具结果一起交给模型；如果已经是最后一轮，再以 `provider_error` 停止并返回 `blocked`。

原因：这属于核心 harness 状态机问题，不应只在 WebUI 做兜底。CLI、WebUI、未来服务器部署都会遇到模型服务抖动，因此恢复逻辑必须在 core loop 中统一实现。这样既能保留事件审计，也能减少真实 DeepSeek 偶发 503 对用户任务的破坏。

验证：新增两个 loop 回归测试先失败于 provider 异常直接抛出；实现 `provider_error` feedback 和循环恢复后，`npm.cmd test -- tests/core/loop.test.ts` 通过，16 个测试全部通过。

### Iteration 20 - 连续 Provider 错误限流与中文摘要

问题：真实 WebUI 回归中，DeepSeek 对一次开发任务连续返回 503。Iteration 19 的恢复逻辑会继续把错误反馈给下一轮，但当服务持续不可用时，10 次迭代会全部变成重复的 `provider_error`，用户看到的是 blocked、0 个工具调用、没有摘要。

决策：在 core loop 中加入连续 provider error 阈值。连续 3 次 provider 请求失败后提前停止，并在 stop event 中写入中文 summary，说明模型服务连续失败、本次任务尚未完成、时间线已保留。同时让 `/api/runs/:id` 返回 `summary` 字段，保证 WebUI 和 API 看到同一份运行摘要。

原因：持续 503 已不是模型行为纠偏问题，而是外部服务可用性问题。此时继续消耗迭代预算没有价值；更好的 harness 行为是保留审计记录、减少页面噪声、给用户明确的中文状态说明。

验证：新增 core 测试先失败于 provider 被调用 10 次，修复后只调用 3 次并写入中文 summary。新增 Web 测试覆盖 `/api/runs/:id` 在连续 provider error 后返回 blocked 和中文 summary，先暴露 API 缺 summary，再修复后通过。

### Iteration 21 - 用户消息右对齐

问题：真实 WebUI 对话中，“你”和用户输入内容仍与助手消息一样从左侧开始，视觉上不像 Codex 桌面端的对话流。

决策：不改消息数据结构，只在用户消息 article 上增加 `chat-message-user` 类，并通过 CSS 控制右对齐、头像在右、文本靠右。助手消息和运行结果卡片保持左侧，工具调用、文件变更、timeline 折叠逻辑不变。

原因：这是纯布局改进，最小改动能降低回归风险；同时保留现有 DOM 层级，避免影响 live polling、session 渲染和 run 结果卡片。

验证：新增 WebUI 断言要求页面包含 `.chat-message-user`、`justify-self: end`、用户消息结构类；测试先失败，样式与渲染实现后通过。

### Iteration 22 - 对话气泡与错位修复

问题：用户希望 WebUI 主体更像 Codex 桌面端的对话流。第一次加入对话气泡后，普通消息出现了气泡，但用户气泡的盒子没有贴到右侧，只是气泡内部文字右对齐，导致头像在最右而气泡偏中间。

决策：将普通助手消息和用户消息都渲染为轻量圆角气泡；用户消息继续右侧展示，并将 `.chat-message-user .chat-bubble` 本身设置为 `justify-self: end`。运行结果卡片不再额外套气泡边框，避免“大结果卡片外再套一层卡片”的视觉噪声。

原因：对话式代码助手的主体页面应以对话流为中心，文件、状态和运行细节只是辅助面板。气泡能增强“用户输入”和“助手回应”的边界，但工具结果和运行结果属于结构化工作产物，仍应保持卡片化展示。

TDD 与验证证据：

- 新增 WebUI 样式断言，先失败于缺少 `border-radius: 16px`、用户气泡背景和 run-result 透明外层。
- 实现气泡样式后，用户反馈发现错位；随后新增断言覆盖 `justify-self: end` 与 `text-align: right`，先失败，再补齐用户气泡盒子右对齐。
- `npm.cmd test -- tests/web/server.test.ts -t "chat-first"` 通过。
- `npm.cmd run build` 通过。
- `npm.cmd test` 通过，20 个测试文件、190 个测试全部通过。
- 提交：`1927205 界面：修复对话气泡对齐`。

### Iteration 23 - 最终交付文档补全

问题：项目已经完成核心 harness、DeepSeek 接入、WebUI 对话式体验、安全与分发的大部分工作，但过程文档和个人反思仍需要补齐，最终 CI/PR/Docker 证据也需要明确哪些已经完成、哪些需要用户在外部环境补充。

决策：补齐 `SPEC_PROCESS.md`、`AGENT_LOG.md`、`docs/CI_CD_RECORD.md` 与 `REFLECTION.md`。过程文档只记录可验证事实，不伪造服务器 Docker build、registry push 或 PR 记录。`REFLECTION.md` 写成可提交的中文初稿，但保留说明：最终版本仍应由学生本人检查和个性化修改。

当前完成状态：

- 核心功能：严格 JSON action、parser、guardrail、工具分发、feedback loop、memory、SQLite timeline、CLI、WebUI 均已实现。
- 真实模型：DeepSeek OpenAI-compatible provider 已接入，WebUI 默认使用 DeepSeek，mock 保留用于离线测试和机制验证。
- 可用性：支持 `deepseek-sandbox` 这样的独立 workspace；WebUI 主体为对话流，文件列表、文件预览、运行状态、最近运行和允许命令为辅助面板。
- 安全：加密凭据文件、环境变量 fallback、日志/响应脱敏、Basic Auth、公网部署说明、`.dockerignore` 均已补强。
- 测试：当前本地 `npm.cmd run build` 与 `npm.cmd test` 均通过。

仍需用户完成：

- 手动 push 最新本地提交后，确认 GitHub Actions 最新 run 通过，并把链接补进 `docs/CI_CD_RECORD.md`。
- 在 GitHub 创建 PR，保留 PR 链接、评审/合并记录或截图。
- 服务器部署阶段补跑 Docker build 或 compose 验证；若推送 registry，补真实 `docker pull` 命令。
- 最终提交前由用户本人审阅并润色 `REFLECTION.md`，确保内容符合个人真实经历和表达。

### Iteration 24 - 服务器 systemd + Nginx 部署

问题：最终交付需要可访问的 WebUI URL。用户提供了 Debian 12 服务器、SSH 私钥、域名 `20230722.top`，并说明服务器当前没有 Docker，已有 SmartKitchen 通过 systemd + Nginx 部署在 `/smart-kitchen/`。

决策：本次不强行安装 Docker，也不改动 SmartKitchen 服务；采用 Node.js + systemd + Nginx 子路径部署。Harness 挂载到 `https://20230722.top/ai4se/`，Node 只监听 `127.0.0.1:3100`。配置、数据和工作区放在 `/opt/ai4se/config`、`/opt/ai4se/data`、`/opt/ai4se/workspaces`，应用代码采用 `/opt/ai4se/releases/*` + `/opt/ai4se/current` 的版本化发布结构。

实现细节：

- 新增 `WEB_BASE_PATH` 支持，使 WebUI 的链接、表单 action、live polling endpoint 和 redirect location 能在 `/ai4se` 子路径下工作。
- 修复 standalone 入口判断，支持 systemd 通过 `/opt/ai4se/current` 符号链接启动，而实际 ESM `import.meta.url` 指向真实 release 目录的情况。
- 服务器专用配置只注册 `deepseek-sandbox`，避免 WebUI 文件列表暴露本项目源码或其他无关目录。
- 按用户选择不启用 WebUI 登录界面；这是短期课程演示取舍，正式长期公网开放仍建议启用 Basic Auth、VPN、SSO 或其他访问控制。

验证：

- 本地：新增 symlink 入口测试先失败，修复后 `npm.cmd test -- tests/web/server.test.ts` 55 个测试通过，`npm.cmd run build` 通过。
- 服务器：`npm ci` 与 `npm run build` 通过；sandbox `npm test` 与 `npm run build` 通过。
- 服务：`systemctl is-active ai4se-harness.service` 为 `active`，Node 监听 `127.0.0.1:3100`。
- 公网：`https://20230722.top/ai4se/api/workspaces` 返回 `deepseek-sandbox`。
- 回归：`https://20230722.top/smart-kitchen/` 返回 `200`。

待补：

- 用户应轮换误发到对话中的 DeepSeek key，并在服务器 `/opt/ai4se/.env` 本地手动配置新 key。
- Docker build/compose 验证按用户决定暂缓到服务器安装 Docker 后再补。


### Iteration 25 - resume：WebUI mock 机制演示接入确定性复现

问题：WebUI 左侧「mock 机制演示」按钮只触发默认 mock provider 的一步 finish（`Mock run completed`），timeline 仅 4 个事件，没有展示课程要求的护栏拦截、失败反馈和修正动作。

决策：复用已有的 `runMechanismDemo`，让其支持把确定性演示事件写入 WebUI run 的 timeline；WebUI 请求 `provider=mock` 且 task 含「mock 机制演示」时改走该演示。

实现：`runMechanismDemo` 支持 `eventStore/existingRunId/sessionId`；server 识别演示请求；WebUI 事件标签按 payload 增强（护栏拦截/测试失败反馈/修正动作）。

验证：`npm test`（193 个测试）通过；新增端到端演示测试。提交：`2d72daf`、`6a29bd3`、`cbc09a4`。

### Iteration 26 - resume：聊天顺序、验证命令与迭代轮数修复

问题：用户反馈 ① 会话中新要求显示在旧要求上方；② 模型声称「没有可用验证命令」但 package.json 明明有 npm test/npm run build；③ 简单任务迭代很多次（run `caaebd00` 连续 6 次重复 `list_files .`）。

根因与修复：

- 聊天顺序：`listSessionRuns` 倒序返回，`renderChatSessionThread` 直接渲染 → 新消息在上。改为按时间正序（旧在上、新在下）渲染（`bf669ea`）。
- 验证命令：模型只 `list_files` 未读 package.json 就臆断脚本缺失；prompt 明确「Allowed commands 可直接运行，拿不准先 read package.json」（`bf669ea`、`522dde0`）。
- 迭代轮数：历史去重只拦「连续重复」，模型穿插其他动作后再写相同文件不被拦。引入历史去重（`0ae030c`）、有效迭代预算与总轮次分离（`acd71e6`）——重复/无效轮次不再消耗有效预算。

验证：`npm test` 逐步从 193 → 202 个测试通过。

### Iteration 27 - resume：验证守卫、多 JSON 检测、写后必须验证

问题：多轮反馈中模型多次「声称验证成功但未实际运行」（run `8f4b4141`、`71d27bed`），且一次响应拼接多个 JSON 导致第二个动作被静默丢弃（`1a0d0b43`），以及写完文件后反复重写同一文件耗尽预算（`80e7438c`）。

修复：

- 验证声明守卫（`deff9aa`）：finish.summary 声称验证成功但本 run 无成功 run_command 时拒绝 finish 并给 `verification_missing` 反馈。
- 多 JSON 检测（`4902fdc`、`a42d9a4`）：parser 提取第一个 JSON 后继续扫描剩余文本，存在第二个带 `"type"` 的 action 即判多 JSON，返回 `invalid_action`。
- 写后必须验证（`d99fd5a`）：同一路径已写入且未运行验证命令时，再次写同一文件被拦截并提示先验证。
- 验证守卫误报修复（`64c9110`）：守卫只匹配「命令/验证词 + 通过/成功」且排除「未运行/未执行/失败/未验证/不声明」，诚实报告失败/未验证的 finish 不再被误拦。

验证：`npm test`（208 个测试）全部通过；新增对应回归测试；线上逐轮发布并验证（`docs/DISTRIBUTION.md`）。

### Iteration 28 - resume：收尾全量核查

对照《AI4SE 通用要求》与《Project A》逐条核对：自有 harness 内核、mock-LLM 确定性单测、机制演示、凭据安全、CI（GitHub Actions + GitLab unit-test）、云部署 URL、README 必需章节。补齐 README「获取方式」「已知限制」章节（`67258b8`）。仓库凭据泄漏自查未发现真实 key；`npm run check:acceptance` 通过。

仍由用户完成：`REFLECTION.md` 本人审阅润色（未纳入 git）、PR #1 合并、公网长期部署前启用 `WEBUI_ADMIN_PASSWORD`。
