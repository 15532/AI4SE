# PLAN：Coding Agent Harness

状态：实现计划草案。`SPEC.md` 通过用户 review，并经 Cursor 冷启动验证前，不得编写 harness 实现代码。

## 流程门禁

- 当前阶段：规约与计划准备。
- 实现门禁：`SPEC.md` 和 `PLAN.md` 必须先 review，再由 Cursor 仅凭这两个文件冷启动验证。
- 过程证据：实现前必须更新 `SPEC_PROCESS.md` 和 `AGENT_LOG.md`。

## Task 依赖概览

顺序基础任务：

1. 仓库与文档基线
2. TypeScript 项目脚手架
3. 核心领域类型与测试基础
4. mock LLM 驱动的主循环

核心类型确定后可并行：

- Guardrail engine
- Tool dispatcher
- Feedback sensors
- SQLite event store
- Credential manager
- WebUI demo views
- Docker 与 CI

## 计划任务

### T0 - 准备基线

目标：创建仓库、文档骨架、忽略规则和 CI 占位。

涉及文件：`SPEC.md`、`PLAN.md`、`SPEC_PROCESS.md`、`AGENT_LOG.md`、`README.md`、`.gitignore`、`.github/workflows/unit-test.yml`、`.gitlab-ci.yml`。

验证：`git status --short` 只显示预期基线文件；尚无 harness 实现代码。

状态：进行中。

### T1 - TypeScript 项目脚手架

目标：创建 package、TypeScript、测试、lint/build 命令基线。

预期文件：`package.json`、`tsconfig.json`、`vitest.config.ts`、`src/`、`tests/`。

先写失败测试：一个导入未来 core module 的 smoke test，应先失败。

验证：`npm test`、`npm run build`，CI 使用同一测试命令。

依赖：T0。

### T2 - 核心领域类型与 Action Parser

目标：定义 action、feedback、guardrail decision、run event、LLM response 接口。

先写失败测试：

- invalid action JSON 转成 `invalid_action` feedback
- valid tool action 解析为 typed action

验证：无网络确定性单元测试。

依赖：T1。

### T3 - Mock LLM 与主循环骨架

目标：实现项目自有 agent loop：context -> LLM -> parse action -> guardrail -> dispatch -> feedback -> stop。

先写失败测试：

- mock LLM 返回 finish action 后 loop 停止
- max iteration limit 能停止 runaway loop

验证：单元测试断言 event sequence 和 stop reason。

依赖：T2。

### T4 - Guardrail Engine

目标：为危险 shell/file action 实现确定性治理分类。

先写失败测试：

- recursive delete command 被 block
- command 不在 allowlist 时被 block 或 require_approval
- 安全的 allowlisted test command 被 allow

验证：不需要 mock LLM；直接测试 guardrail。

依赖：T2；接口稳定后可与 T5/T6 并行。

### T5 - Bounded Tool Dispatcher

目标：实现 workspace-bounded file tools 和 restricted shell execution。

先写失败测试：

- path traversal outside workspace 被拒绝
- allowlisted command 可在临时 workspace 中执行
- blocked command 永不执行

验证：测试使用临时目录且不依赖网络。

依赖：T2、T4。

### T6 - Feedback Sensors

目标：将 command result、test output、lint/typecheck output、invalid LLM output、guardrail block event 转换为结构化 feedback。

先写失败测试：

- failed test output 产生 actionable feedback
- guardrail block 产生 safety feedback
- feedback 被放入下一轮 loop context

验证：mock LLM 在收到 feedback 后改变第二个 action。

依赖：T2、T3。

### T7 - SQLite Event Store 与 Memory

目标：持久化 run event、feedback、decision 和有边界的 memory item。

先写失败测试：

- run events 按顺序存储
- memory retrieval 按 scope 且有边界
- secret value 不会存为 memory 或 event payload

验证：SQLite 单测使用临时数据库文件。

依赖：T2。

### T8 - Credential Manager

目标：实现 credential status/set/clear 抽象，以 OS keychain 为主，`.env` 仅为 development mode fallback。

先写失败测试：

- status 隐藏 secret value
- clear 移除 provider key
- `.env` fallback 未显式启用时禁用

验证：单测使用 in-memory fake keychain adapter。

依赖：T1。

### T9 - CLI

目标：暴露 mock run、mechanism demo、real-provider run、credential management 和 config validation commands。

先写失败测试：

- `demo` command 返回 guardrail 和 feedback 证据
- credential status command 永不打印 secret value

验证：CLI integration tests 使用 mock LLM 和 fake keychain。

依赖：T3、T4、T5、T6、T8。

### T10 - WebUI Run Control

目标：提供 WebUI，展示 mock/real run history、blocked actions、feedback transitions、run timeline，并允许对预注册 workspace 触发真实 run。

先写失败测试：

- server 暴露 demo run data
- WebUI run API 只接受预注册 workspace id
- WebUI real run 使用与 CLI 相同的 guardrail 和 allowlist

验证：API/component tests 确认 workspace boundary。

依赖：T7、T9。

### T11 - Docker 与服务器部署

目标：用 Docker 打包应用，并文档化在用户自有服务器上通过 Nginx 部署。

先写失败测试：

- container build command 在 CI 中成功
- 文档化环境变量足以启动 WebUI

验证：`docker build` 与 `docker run` 说明可在新机器运行。

依赖：T9、T10。

### T12 - CI、Review 与最终文档

目标：完成 README、CI、`.gitlab-ci.yml`、AGENT_LOG、SPEC_PROCESS 冷启动证据和 REFLECTION 提纲。

验证：

- GitHub Actions 通过
- `.gitlab-ci.yml` 包含 `unit-test` job
- README 包含安装、运行、分发、目录结构、key 配置、安全边界
- `SPEC_PROCESS.md` 包含 Cursor 冷启动发现和 SPEC/PLAN 修订记录

依赖：所有实现任务。

## Worktree 策略

- `feature/core-loop`：T1-T3
- `feature/guardrails-tools`：T4-T5
- `feature/feedback-memory`：T6-T7
- `feature/credentials-cli`：T8-T9
- `feature/webui-deploy`：T10-T11
- `docs/finalization`：T12

每个 feature branch 对应一个 PR，commit message 标注 subagent 或 human reviewer。

## 冷启动验证提示词

在 Cursor 中开启全新 session。只提供 `SPEC.md` 和 `PLAN.md`，然后要求：

> 你正在验证这个 AI4SE Project A 规约。请从 `PLAN.md` 中选择 T2 和 T4，并尝试用 TDD 实现它们。不要依赖任何先前对话或隐藏上下文。如果任何要求存在歧义，请停止并提问，不要猜测。请报告你遇到的所有歧义、不一致、缺失接口或非预期解读。

实现前将结果记录到 `SPEC_PROCESS.md`。
