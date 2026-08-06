# SPEC：Coding Agent Harness

状态：核心 harness、DeepSeek provider、方案 A 可用代码开发链路、方案 B 轻量智能 IDE 壳层、Workspace Session V1、Diff Inspector V1、Interactive Run V1 与 Approval V1 已实现；后续增强可继续扩展浏览器内编辑器和 Open Design 视觉系统。

## 1. 问题陈述

原始 LLM 输出本身并不是可靠的 coding agent。一个真正可用的 coding agent 需要 harness：由确定性代码控制模型能看到什么、能请求什么动作、哪些工具会被真正执行、危险操作如何被拦截、客观反馈如何回灌、记忆如何持久化、凭据如何保护。

本项目将实现一个 TypeScript 版 Coding Agent Harness，面向软件工程学生、评审者和开发者，用于观察 agentic software engineering 如何被工程化得更安全、更可验证。它不是对现成 agent runner 的简单封装；交付物中的 harness 内核必须自己实现主循环、工具分发、治理护栏、反馈传感器、记忆、配置、CLI 和 WebUI。

## 2. 已确认方向

- 项目类型：A - Coding Agent Harness
- 产品名称：Coding Agent Harness
- 主要贡献：治理护栏 + 确定性反馈闭环
- 架构：Typed JSON Action Harness
- 产品形态：TypeScript CLI + WebUI
- LLM 接口：实现可注入的 `LLMProvider` 抽象、mock provider 与 DeepSeek OpenAI-compatible provider
- 测试策略：mock/stub LLM 做确定性测试；DeepSeek provider 使用 fake fetch 测试请求格式，不依赖真实网络
- 分发方式：Docker 镜像 + Docker Compose，通过 Nginx 部署到云服务器
- 状态存储：SQLite
- 凭据存储：优先使用 `HARNESS_MASTER_PASSWORD` 保护的加密凭据文件；`.env` / 环境变量仅作为受控 fallback
- WebUI 策略：WebUI 可以触发真实 harness run，但只能针对预注册 workspace，并且必须使用与 CLI 相同的 guardrail 和 allowlist
- 前端策略：当前 WebUI 是轻量智能 IDE 壳层，用于演示 harness run、workspace、任务编排与 timeline inspector；Open Design 作为方案 B 后续视觉系统和交互原型的设计参考
- 方案 A 当前目标：可用 Coding Agent Loop V1，支持模型读取上下文、选择工具、修改文件、运行 allowlist 验证命令、根据反馈修正并最终 finish
- 方案 B 当前目标：轻量智能 IDE 壳层，包含 workspace rail、task composer、run inspector、timeline navigator 和 event detail stack
- Workspace Session V1：包含只读文件列表/文件内容 API、workspace memory 面板、recent runs 面板，以及后续 run 对同 workspace 历史摘要的 context 继承
- Diff Inspector V1：包含只读 git 变更列表 API、单文件 unified diff API，以及运行详情页的 diff inspector 区块
- Interactive Run V1：包含 SQLite session、session-run 关联、session 页面和继续运行 API
- Approval V1：allowlist 内的发布/部署命令进入 `pending_approval`，由 WebUI 人工批准或拒绝；未在 allowlist 的命令继续直接 block
- 方案 B 后续目标：基于 Open Design 继续设计浏览器内编辑器和更完整视觉系统

## 3. 用户故事

1. 作为开发者，我希望 harness 在受限 workspace 内执行 coding task，以避免 agent 静默影响无关文件。
2. 作为 reviewer，我希望危险 shell/file action 在执行前被代码拦截，而不是依赖提示词提醒模型注意安全。
3. 作为开发者，我希望 test/lint/build 反馈能回灌到 agent loop，让失败尝试驱动下一步修正。
4. 作为助教，我希望 mock LLM 机制演示能确定性复现 guardrail block 和 feedback correction，从而不依赖网络也能评分。
5. 作为运维者，我希望 API key 存储在仓库外，且永不出现在日志或 WebUI 响应中。
6. 作为访问者，我希望 WebUI 能对预注册 workspace 触发 run，并展示 action、guardrail、tool result、feedback 和 stop reason 的完整 timeline。

## 4. 功能模块

项目明确划分为六个职责模块，每个模块都要有测试覆盖。

### 4.1 Agent Loop Core

负责 harness 主循环：

1. 根据 task、workspace 配置、最近 feedback 和选择性 memory 构造上下文。
2. 调用注入的 `LLMProvider`。
3. 解析严格的一轮一个 JSON action。
4. 将 action 送入 guardrail。
5. 将允许执行的 action 分发给工具。
6. 将结果转换为 feedback。
7. 持久化事件。
8. 决定继续或停止。

该循环必须由本项目代码实现，不得委托给 LangChain `AgentExecutor`、AutoGen、CrewAI、LlamaIndex agent runner 或宿主 coding-agent SDK。

### 4.2 工具与工作区运行时（Tool And Workspace Runtime）

负责工作区（workspace）注册、路径边界检查、文件工具和 allowlist shell 执行。CLI 和 WebUI 都必须通过配置好的 workspace id 选择 workspace，不能输入任意服务器路径。

### 4.3 Governance Guardrail Engine

负责在执行前用确定性代码分类 action。结果类型为：

```ts
type GuardrailDecision =
  | { decision: "allow" }
  | { decision: "block"; reason: string; ruleId: string }
  | { decision: "require_approval"; reason: string; ruleId: string };
```

### 4.4 Feedback And Self-Correction Engine

负责把 parser error、guardrail decision、command result、test/lint/typecheck output 转换为结构化 feedback，并送入下一轮 loop。

### 4.5 Memory And Event Store

负责用 SQLite 持久化 run、event、action、feedback 和有边界的 memory。记忆检索必须显式且按 scope 限制；harness 不得把全部历史盲目塞进 LLM 上下文。

### 4.6 Credential, CLI, And WebUI Interface

负责凭据 status/set/clear 流程、CLI 命令、WebUI run 控制、timeline 展示和部署相关行为。该模块不得打印或持久化 secret 明文。

## 5. JSON Action 协议

LLM 每轮必须输出且只能输出一个严格 JSON action 对象。JSON 外的自然语言视为非法。非法 JSON 不会被执行，而是转换为 `invalid_action` feedback。

v1 支持的 action：

```json
{ "type": "read_file", "path": "src/index.ts", "reason": "inspect entrypoint" }
```

```json
{ "type": "write_file", "path": "src/index.ts", "content": "...", "reason": "apply fix" }
```

```json
{ "type": "list_files", "path": ".", "reason": "discover structure" }
```

```json
{ "type": "run_command", "command": "npm test", "reason": "verify tests" }
```

```json
{
  "type": "remember",
  "key": "project.testCommand",
  "value": "npm test",
  "scope": "workspace",
  "reason": "store discovered project convention"
}
```

```json
{ "type": "finish", "summary": "Requested change is complete" }
```

约束：

- 每轮最多执行一个 action。
- v1 不支持 batch action。
- 人工审批不是 LLM action；它是 `GuardrailEngine` 产生的 harness 状态。
- action parsing、validation、rejection 必须能在没有真实 LLM 的情况下测试。
- JSON action 必须是 object，不能是 `null`、array、string 或 number。
- JSON 外包含自然语言前后缀时，整体视为 invalid JSON，不尝试抽取其中片段。
- 未知 `type`、缺失必填字段、字段类型错误都返回 `invalid_action` feedback。
- v1 默认拒绝额外字段；错误 message 固定为 `LLM action shape is invalid`，payload 至少包含 `reason` 和 `raw`。

## 6. 工具与工作区边界

工作区（workspace）通过配置文件预注册：

```yaml
workspaces:
  - id: demo-ts
    name: TypeScript Demo
    root: ./examples/demo-ts
    allowedCommands:
      - npm test
      - npm run lint
      - npm run typecheck
      - npm run build
  - id: course-project
    name: Course Project
    root: D:/Projects/AI4SE
    allowedCommands:
      - npm test
      - npm run build
```

规则：

- CLI 和 WebUI 只能通过 workspace id 选择 workspace。
- WebUI 不能接收任意服务器路径。
- 所有文件路径都相对于选中的 workspace root 解析。
- 任何逃逸 workspace root 的路径都必须被 block。
- 空路径按 `.` 处理，解析为 workspace root。
- `.` 合法，解析为 workspace root。
- 绝对路径只有在解析后仍位于 workspace root 内时才允许；否则 block。
- Windows 路径和 POSIX 路径都必须经过 normalize/resolve 后再比较边界。
- 符号链接安全属于未来增强；v1 在 README 中声明不跟随或不特殊信任符号链接。
- shell command 必须与当前 workspace 的 `allowedCommands` 精确匹配。
- v1 不支持 `npm test -- <pattern>` 这类任意参数。
- 默认 TypeScript allowlist 是 `npm test`、`npm run test`、`npm run lint`、`npm run typecheck`、`npm run build`。

## 7. 领域与机制设计

Project A 要求 harness 实现六个维度：决策、工具、记忆、治理、反馈、配置。本设计的对应关系如下：

- 决策：`AgentLoop` 负责上下文组装、provider 调用、action 解析、dispatch、feedback 和停机条件。
- 工具：`ToolDispatcher` 负责文件工具与 allowlist shell 执行。
- 记忆：`remember` action 将 scoped memory 写入 SQLite；context builder 按 workspace scope 有边界地检索。
- 治理：`GuardrailEngine` 在执行前使用确定性规则分类 action。
- 反馈：`FeedbackSensors` 将客观结果解析成结构化 feedback，影响下一轮 LLM 调用。
- 配置：workspace registry、command allowlist、provider profile、max iterations、WebUI execution mode 都由配置文件声明，并由项目代码加载。

主要贡献是治理 + 反馈闭环。这些机制在移除真实 LLM、替换为 mock/stub LLM 后仍必须有意义且可单测。

## 8. Guardrail 规则

初始确定性规则：

- `path.escape_workspace`：任何解析后位于 workspace root 外的文件 action 都 block。
- `command.not_allowlisted`：任何不精确匹配当前 workspace allowlist 的 command 都 block。
- `command.destructive_delete`：识别并 block `rm -rf`、`del /s`、`Remove-Item -Recurse` 等破坏性删除命令。
- `command.secret_access`：block 读取或打印 `.env`、private key、token file 或已知 secret path 的尝试。
- `command.publish_or_deploy`：已在当前 workspace `allowedCommands` 中显式允许的 `git push`、`npm publish`、`docker push`、`kubectl apply` 等发布/部署命令返回 `require_approval`。
- `write.sensitive_file`：block 写入 `.env`、private key file 和含 secret 的配置文件。

规则优先级从高到低：

1. `command.destructive_delete`
2. `command.secret_access` / `write.sensitive_file`
3. `path.escape_workspace`
4. `command.not_allowlisted`
5. `command.publish_or_deploy`
6. allow

如果一个 action 同时命中多条规则，返回优先级最高的规则。例：`rm -rf .` 返回 `command.destructive_delete`；未加入 allowlist 的 `git push` 返回 `command.not_allowlisted`；只有已加入 allowlist 的 `git push` 才返回 `command.publish_or_deploy` 的 `require_approval`。

`require_approval` 是 harness 状态，不是 LLM action。核心 loop 记录 `approval_required` 事件并以 `pending_approval` 停止；WebUI 审批 API 在批准前会重新运行 guardrail，只有仍然是 `require_approval` 的 action 才会执行。

## 9. 反馈闭环

Feedback sensor 产生以下结构化 feedback：

- invalid JSON 或 invalid action shape -> `invalid_action`
- guardrail block -> `safety_blocked`
- command exit code 非 0 -> `command_failed`
- test failure output -> `test_failed`
- lint/typecheck failure output -> `static_check_failed`
- tool 成功 -> `tool_succeeded`
- 缺少凭据 -> `credential_missing`

下一轮 LLM context 包含最近 feedback 的 source、severity、简短 message 和相关 payload。机制演示必须证明 feedback 会改变 mock LLM 的下一步 action。

当 `invalid_action` 或 `safety_blocked` 发生且仍有剩余迭代次数时，loop 不应立刻结束，而应把结构化 feedback 放入下一轮 context，让模型有机会返回修正后的 JSON action 或选择更安全的 action。若最后一轮仍无法得到可执行 action，则按 `blocked` 或 `max_iterations` 结束。

## 10. LLM Provider

`LLMProvider` 是可注入抽象。当前阶段 provider：

- `MockLLMProvider`：为测试和 demo 提供确定性 scripted responses；不依赖网络。
- `OpenAICompatibleProvider` / DeepSeek：真实 provider mode，使用 DeepSeek OpenAI-compatible chat completion endpoint。

DeepSeek 默认配置：

- `baseUrl`: `https://api.deepseek.com`
- `model`: `deepseek-v4-flash`
- `apiKeyEnv`: `DEEPSEEK_API_KEY`
- `thinking`: `disabled`
- `response_format`: `{ "type": "json_object" }`

Provider 层只执行单次 completion call，不提供 agent loop 或 tool runner。

## 11. WebUI

当前 WebUI 是轻量智能 IDE 壳层，用于证明和演示 harness 机制；它不是 VS Code 替代品，也不包含完整代码编辑器、调试器、插件系统或复杂 IDE 交互。Open Design 已作为方案 B 的设计参考：本轮不引入 Open Design runtime，而是采用低依赖、可测试的 server-rendered 信息架构；后续若实现完整视觉系统或交互原型，再补充具体 Open Design skill 与设计系统说明。

WebUI v1 能力：

- 列出预注册 workspace
- 展示每个 workspace 的 allowlist commands
- 选择 workspace id
- 输入 task 描述
- 普通 WebUI 对话入口默认使用 DeepSeek provider profile 触发 run；mock provider 不在普通模型选择器中暴露，但左侧工具区提供专门的 mock 机制演示入口，用于课程要求的离线复现
- 触发 harness run
- 展示 run timeline
- 展示 action JSON、guardrail decision、tool result、feedback、memory event 和 stop reason
- 在出现 pending approval 时展示该状态
- 对 pending approval 提供批准和拒绝入口；批准后执行原 action 并追加 `approval_decision` 与 `tool_result` 事件，拒绝后只追加拒绝事件
- 首页展示 workspace rail、task composer 与 run inspector 三栏工作台
- 运行详情页展示 timeline navigator 与 event detail stack
- 首页展示只读 code viewer 入口、workspace memory 与 recent runs
- 文件查看 API 只能读取预注册 workspace 内文件，不能写文件
- 变更查看 API 只能读取 workspace git diff，不能写文件、回滚或审批变更
- 创建持久化 interactive session，并在同一 session 下继续触发真实 harness run
- Session 页面展示后续指令入口、历史 run 摘要、workspace memory 和 diff inspector

安全边界：

- WebUI 可以触发真实 run。
- WebUI 不能选择任意 filesystem path。
- WebUI 不能展示 API key。
- WebUI 使用与 CLI 相同的 workspace registry、allowlist、guardrail 和 feedback sensor。
- Session 绑定 workspace id 和 provider id；继续运行时不能从请求体覆盖 root、workspace 或 provider。
- Session 持久化在 SQLite 中，服务器部署必须持久化 `HARNESS_DB_PATH` 所在目录。
- 人工审批不能绕过 allowlist、workspace boundary、敏感文件和密钥保护。
- WebUI 本地默认不启用 password；服务器可通过 `WEBUI_ADMIN_PASSWORD` 启用内置 Basic Auth。公网部署必须启用认证，并建议继续放在 HTTPS、反向代理或等价网络边界后。

未来改进：

- 增加更友好的凭据状态提示。
- 在功能稳定后使用 Open Design 继续设计浏览器内编辑器和更完整视觉系统。

## 12. 凭据与威胁模型

威胁：

- 真实 API key 被提交进 Git
- 真实 key 被打印到日志或终端输出
- 真实 key 被 WebUI 返回
- `.env` 被意外部署或提交
- key 被存入 SQLite event payload

对策：

- 加密凭据文件是主凭据存储，默认路径为 `data/credentials.enc.json`，由 `HARNESS_MASTER_PASSWORD` 派生密钥保护。
- CLI 支持 `credentials status`、`credentials set`、`credentials clear`。
- `credentials status` 只显示 provider 和是否存在 key，不显示 secret value。
- `.env` / `DEEPSEEK_API_KEY` 只是受控 fallback，优先级低于加密凭据文件。
- `.env` 和常见 secret files 被 Git ignore。
- Event store 和 WebUI response 必须 redact secret-like values。
- 真实 provider run 在缺少 key 时失败为结构化 `credential_missing` feedback。

## 13. 数据模型

主要 SQLite 实体：

- Run：id、mode、provider_profile、workspace_id、task、status、started_at、ended_at、stop_reason
- Event：id、run_id、sequence、kind、payload_json、created_at
- Action：id、run_id、sequence、action_type、payload_json、guardrail_decision、created_at
- Feedback：id、run_id、sequence、source、severity、message、payload_json、created_at
- MemoryItem：id、workspace_id、scope、key、value_json、created_at、updated_at
- WorkspaceConfigSnapshot：id、run_id、workspace_id、root、allowed_commands_json、created_at
- Approval：id、run_id、workspace_id、action_json、rule_id、reason、status、created_at、decided_at

Secret values 不得存入 SQLite。

## 14. 非功能性需求

安全：

- 真实 key 不得被提交、记录、打印或存入 SQLite。
- 所有 file action 都受 workspace 边界限制。
- 所有 shell action 都受 allowlist 限制。
- WebUI 真实 run 限制在预注册 workspace 内。

可靠性：

- max iterations 防止无限循环。
- 工具失败会转换为结构化 feedback。
- 非法 LLM 输出不会触发工具执行。
- Event log 能解释每个 action decision。

性能：

- mock 机制演示在普通笔记本上 5 秒内完成。
- 真实 provider call 使用可配置 timeout。

可观测性：

- 每次 run 记录 action、guardrail decision、tool result、feedback、memory event 和 stop reason。

## 15. 测试与机制演示

一键测试入口：

```bash
npm test
```

必需确定性测试：

- mock LLM 返回 `finish`，loop 正常停止
- invalid JSON 转成 `invalid_action` feedback
- 危险 `run_command` 被 guardrail block
- failed test feedback 导致 mock LLM 下一步 action 改变
- workspace path traversal 被拒绝
- 非 allowlist command 被拒绝
- allowlist command dispatch 可在临时 workspace 中运行
- `remember` 写入 scoped memory，context builder 能取回
- credential status 不泄露 secret value
- WebUI run API 只接受已注册 workspace id
- WebUI real run 使用与 CLI 相同的 guardrail 和 allowlist

机制演示命令：

```bash
npm run demo:mechanisms
```

代码开发链路演示命令：

```bash
npm run demo:coding-task
```

`demo:coding-task` 必须在临时 workspace 内确定性完成一次小型修复：先 `list_files` 查看结构，再 `read_file` 阅读有 bug 的实现，随后 `write_file` 修复代码，执行 allowlist 中的 `npm test`，最后 `finish`。该演示不得修改真实仓库。

演示必须确定性展示：

1. mock LLM 尝试危险命令，guardrail 拦截。
2. 注入的 test failure 转成 feedback。
3. mock LLM 因该 feedback 改变下一步 action。
4. 最终 timeline 展示治理 + 反馈闭环这一主要贡献。
5. 可用 coding loop 能完成 inspect -> edit -> verify -> finish 的真实工具链路。

## 16. 技术选型

- TypeScript：core、CLI、WebUI server 和 tests 共用语言
- Node.js：适合 CLI、server、SQLite、keychain integration 和 Docker
- Vitest 或等价工具：确定性单元测试
- SQLite：本地持久化 run history、memory 和 WebUI timeline
- OpenAI-compatible API：当前用于 DeepSeek provider；WebUI 默认展示并选中 DeepSeek，mock provider 保留给离线确定性测试、CLI/API 调试和机制演示
- Open Design：当前作为方案 B 的设计参考，不直接引入 runtime；涉及更完整前端 / UI 增强时再选择设计系统并补充 SPEC
- Docker 和 Docker Compose：可复现分发与云服务器部署
- GitHub Actions + `.gitlab-ci.yml`：兼顾用户偏好和课程 checklist

## 17. 验收标准

- `npm test` 能在无网络情况下运行全部核心机制测试。
- harness main loop 是项目自有代码。
- mock LLM run 不依赖真实 LLM 即可完成。
- WebUI 默认使用 DeepSeek provider，普通模型选择器不暴露 mock 选项，但提供专门的 mock 机制演示入口。
- WebUI 的“mock 机制演示”入口能在对话流中确定性复现护栏拦截、失败反馈与修正动作。
- 危险 action 在执行前被 block。
- failure feedback event 会改变 mock LLM 的下一步 action。
- `remember` action 能持久化 scoped memory，context retrieval 有边界。
- CLI 能管理 credential status/set/clear 且不打印 secret。
- WebUI 只能对预注册 workspace 触发 run。
- WebUI 展示 action、guardrail、feedback 和 stop reason timeline。
- WebUI 首页展示轻量智能 IDE 壳层，至少包含 workspace rail、task composer 和 run inspector。
- WebUI 运行详情页展示 timeline navigator 与 event detail stack。
- WebUI 提供只读代码查看 API，路径逃逸会返回错误。
- WebUI 提供只读 git diff API，路径逃逸会返回错误，响应不包含 workspace 绝对路径。
- WebUI 提供 interactive session API，可连续触发同 workspace/provider 下的真实 harness run。
- WebUI 提供人工审批 API，可批准或拒绝 `pending_approval` action，且审批不能绕过 allowlist。
- 后续 run 的 provider context 包含同 workspace 的 memory 与最近 run 摘要。
- `npm run demo:coding-task` 能在临时 workspace 中完成读文件、写修复、运行测试并 finish。
- Docker 部署说明能在新服务器上启动 WebUI。
- CI 通过，且 job 名为 `unit-test`；`.gitlab-ci.yml` 也包含 `unit-test`。
- README 说明安装、运行、分发、key 配置、目录结构和安全边界。
- source、logs、docs、SQLite、Git history 中均无真实凭据。

## 18. 风险与未决问题

- WebUI 本地默认无 password；公网 real-run 部署必须设置 `WEBUI_ADMIN_PASSWORD`，并建议搭配 HTTPS 或反向代理访问控制。
- 加密凭据文件依赖 `HARNESS_MASTER_PASSWORD`；部署时必须把主密码交给受控 secret 管理，不得写入镜像或仓库。
- test/lint/typecheck failure output parsing 首版应保持简单、确定。
- 当前 WebUI 是轻量智能 IDE 壳层，适合演示 harness 机制；若要升级为完整智能 IDE，还需要继续实现浏览器内编辑器和更完整的 Open Design 视觉系统。
- DeepSeek provider 已可接入真实模型，真实 API key 优先来自加密凭据文件，其次来自 `DEEPSEEK_API_KEY` fallback。
