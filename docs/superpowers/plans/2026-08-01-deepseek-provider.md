# DeepSeek Provider 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 harness 接入 DeepSeek OpenAI-compatible Chat Completions provider，同时保持 mock LLM 离线测试能力。

**Architecture:** 新增通用 HTTP chat-completions provider，实现 DeepSeek 配置分支。CLI 与 WebUI 通过 registry 选择 provider；真实 key 只从环境变量读取，不写入日志、SQLite 或响应。

**Tech Stack:** TypeScript、Node.js `fetch`、Vitest、DeepSeek OpenAI-compatible `/chat/completions`。

## Global Constraints

- 默认测试仍使用 mock provider，不依赖网络和真实 DeepSeek key。
- DeepSeek 默认模型使用 `deepseek-v4-flash`，关闭 thinking。
- 请求使用 `response_format: { "type": "json_object" }`，但仍由 harness `parseAction` 做确定性校验。
- API key 环境变量为 `DEEPSEEK_API_KEY`，不得提交、打印、写入 SQLite 或通过 WebUI 返回。
- 不自动提交；提交前必须先向用户确认。

---

### Task 1: Provider 类型与配置解析

**Files:**
- Modify: `src/config/harness-config.ts`
- Modify: `config/harness.example.yaml`
- Test: `tests/config/harness-config.test.ts`

**Interfaces:**
- Produces: `ProviderConfig` union including `{ id, type: "deepseek-compatible", baseUrl, model, apiKeyEnv, thinking }`.

- [ ] **Step 1: Write the failing test**

Add a config test loading a provider:

```yaml
providers:
  - id: deepseek
    type: deepseek-compatible
    baseUrl: https://api.deepseek.com
    model: deepseek-v4-flash
    thinking: disabled
```

Expected provider object includes `apiKeyEnv: "DEEPSEEK_API_KEY"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/config/harness-config.test.ts`

Expected: FAIL with unsupported provider type.

- [ ] **Step 3: Implement config support**

Parse `deepseek-compatible`, validate non-empty `baseUrl` and `model`, default `apiKeyEnv` to `DEEPSEEK_API_KEY`, default `thinking` to `disabled`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/config/harness-config.test.ts`

Expected: PASS.

### Task 2: DeepSeek provider HTTP behavior

**Files:**
- Modify: `src/core/providers.ts`
- Test: `tests/core/providers.test.ts`

**Interfaces:**
- Produces: `OpenAICompatibleProvider` and `createProvider(config, env, fetchImpl)`.
- Consumes: `LLMProvider.complete({ task, context })`.

- [ ] **Step 1: Write failing tests**

Test:
- It posts to `https://api.deepseek.com/chat/completions`.
- It sends `Authorization: Bearer <key>`.
- It sends system/user messages instructing strict JSON Action output.
- It sends `response_format: { type: "json_object" }`, `thinking: { type: "disabled" }`, `stream: false`.
- It returns `choices[0].message.content`.
- Missing key throws `Missing API key for provider deepseek`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/providers.test.ts`

Expected: FAIL because provider is not implemented.

- [ ] **Step 3: Implement provider**

Use injected `fetchImpl` for tests and `globalThis.fetch` in production.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/core/providers.test.ts`

Expected: PASS.

### Task 3: CLI/WebUI provider selection

**Files:**
- Modify: `src/cli/main.ts`
- Modify: `src/web/server.ts`
- Modify: `src/web/views.ts`
- Test: `tests/cli/demo.test.ts`
- Test: `tests/web/server.test.ts`

**Interfaces:**
- CLI `run --provider deepseek` resolves `deepseek-compatible` provider.
- WebUI provider selector lists available provider ids.

- [ ] **Step 1: Write failing tests**

Add tests for:
- WebUI index renders provider select with `mock` and `deepseek`.
- Unsupported provider behavior remains 400.

- [ ] **Step 2: Run failing tests**

Run: `npm test -- tests/web/server.test.ts tests/cli/demo.test.ts`

Expected: FAIL because WebUI only renders hidden provider input and CLI rejects non-mock.

- [ ] **Step 3: Implement provider factory wiring**

Use `createProvider(providerConfig)` in CLI and WebUI.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/web/server.test.ts tests/cli/demo.test.ts`

Expected: PASS.

### Task 4: Docs and verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `AGENT_LOG.md`

- [ ] **Step 1: Update docs**

Document:
- `DEEPSEEK_API_KEY`
- `deepseek-v4-flash`
- provider selection commands
- no real key in Git/log/SQLite/WebUI

- [ ] **Step 2: Run verification**

Run:
- `npm test`
- `npm run build`

Expected: all tests and build pass.
