# Coding Agent Harness 设计文档

日期：2026-07-27

状态：已在 Superpowers brainstorming 中确认；实现前写入。

## 摘要

本项目为 AI4SE 期末项目 A 构建一个 TypeScript Coding Agent Harness。已选架构为 Typed JSON Action Harness：LLM 每轮只输出一个严格 JSON action，而项目自有代码负责 parsing、guardrail、tool dispatch、feedback、memory、configuration、credentials、CLI 和 WebUI。

主要贡献是治理 + 确定性反馈闭环。移除真实 LLM、替换为 mock/stub LLM 后，harness 仍必须能展示有意义且可单测的行为。

## 设计决策

- 使用 TypeScript 覆盖 shared core、CLI、WebUI server 和 tests。
- OpenAI-compatible chat API 只作为 `LLMProvider` 后的一次 completion call。
- `MockLLMProvider` 用于全部确定性单测和机制演示。
- 使用严格 JSON action output，而不是 XML 或自然语言解析。
- 使用预注册 workspace id，而不是任意路径输入。
- 每个 workspace 使用精确 command allowlist。
- WebUI 可以触发真实 harness run，但只能在注册 workspace 内，并且使用与 CLI 相同的 guardrail。
- 根据用户决定，v1 不要求 WebUI password；文档中明确这是风险，适合作为受信任环境或短期课程演示。

## 核心模块

实现分为六个模块：

1. Agent Loop Core：context、provider call、action parsing、guardrail、dispatch、feedback、persistence、stop。
2. 工具与工作区运行时（Tool And Workspace Runtime）：workspace registry、path check、file tools、allowlisted shell。
3. Governance Guardrail Engine：确定性的 allow/block/require_approval 分类。
4. Feedback And Self-Correction Engine：客观结果解析与 feedback injection。
5. Memory And Event Store：SQLite run timeline、action、feedback、memory。
6. Credential, CLI, And WebUI Interface：key lifecycle、本地命令、WebUI run control 和 timeline。

## Action 协议

v1 支持的 action：

- `read_file`
- `write_file`
- `list_files`
- `run_command`
- `remember`
- `finish`

每个 loop iteration 只接受一个 JSON object。非法 JSON 或非法结构会变成 feedback，不会进入工具执行。

人工审批不是 LLM action，而是 guardrail 产生的 harness 状态。

## 工作区与工具边界

工作区（workspace）在运行前配置：

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
```

CLI 和 WebUI 通过 workspace id 选择 workspace。路径相对于该 workspace root 解析；逃逸路径会被 block。shell command 必须与该 workspace 的 allowlist 精确匹配。v1 不允许任意命令参数。

## 治理与反馈

初始 guardrail 会 block workspace escape、非 allowlist command、破坏性删除、secret access、publish/deploy command，以及写入敏感文件。

Feedback sensor 为 invalid action、guardrail block、command failure、test failure、static-check failure、missing credential 和 tool success 产生结构化 feedback。下一轮 context 会包含最近 feedback，使 mock LLM 测试能证明 self-correction 不依赖真实 LLM。

## WebUI 与安全

WebUI 可以触发 mock 或 real provider run。它只能选择预注册 workspace，不能展示 API key，并且必须使用与 CLI 相同的 runtime 边界。由于用户决定 v1 不配置 password，公网部署应被记录为受信任网络或短期课程演示部署。未来应加入 `WEBUI_ADMIN_PASSWORD` 或反向代理认证。

凭据以 OS keychain 为主存储。`.env` 只是显式启用的开发 fallback，并被视为明文风险。secret value 不得出现在 Git、logs、SQLite、WebUI response 或 CI output 中。

## 测试与演示

一键测试入口：

```bash
npm test
```

必需确定性测试覆盖 main loop stop、invalid JSON feedback、guardrail block、feedback-driven action change、workspace path escape、command allowlist rejection、memory write/retrieval、credential masking 和 WebUI registered-workspace enforcement。

机制演示命令：

```bash
npm run demo:mechanisms
```

该演示必须确定性展示：危险动作被 block、失败测试结果回灌到 loop、mock LLM 因 feedback 改变下一步 action。
