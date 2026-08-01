# Coding Agent Harness Implementation Plan（实现计划）

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐 task 执行本计划。步骤使用 checkbox（`- [ ]`）语法追踪。

**目标：** 按 `SPEC.md` 实现一个 TypeScript Coding Agent Harness，具备自有 agent loop、严格 JSON action、预注册 workspace、guardrail、feedback loop、memory、credential、CLI、WebUI、Docker 与 CI。

**架构：** 采用 Typed JSON Action Harness。LLM 每轮只输出一个 JSON action；项目代码负责解析、治理、工具执行、反馈回灌、记忆和停机。CLI 与 WebUI 共用同一套 core runtime，WebUI 只能选择预注册 workspace id。

**技术栈：** TypeScript、Node.js、Vitest、SQLite、OpenAI-compatible API、OS keychain adapter、Docker、GitHub Actions、GitLab CI。

## 全局约束

- SPEC/PLAN 与 Cursor 冷启动验证完成前不得写实现代码。
- 主循环必须由项目代码实现，不得使用 LangChain `AgentExecutor`、AutoGen、CrewAI、LlamaIndex agent runner 或宿主 coding-agent SDK。
- LLM action 协议是严格 JSON；每轮最多一个 action。
- v1 action：`read_file`、`write_file`、`list_files`、`run_command`、`remember`、`finish`。
- WebUI 可以触发真实 run，但只能选择预注册 workspace id，不能输入任意服务器路径。
- 当前 WebUI 只做功能性简单模型前端；Open Design 与更 IDE 化的界面留到核心功能完善后的增强阶段。
- 当前 provider 支持 mock 与 DeepSeek OpenAI-compatible；测试仍默认使用 mock 或 fake fetch，不依赖真实网络。
- v1 WebUI 不设置 password；公网 real-run 部署是已知风险，只用于受信任网络或短期课程演示。
- 默认 TypeScript command allowlist：`npm test`、`npm run test`、`npm run lint`、`npm run typecheck`、`npm run build`。
- 一键测试入口：`npm test`。
- 机制演示入口：`npm run demo:mechanisms`。
- 真实 API key 不得提交、打印、写入 SQLite、写入日志或通过 WebUI 返回。

---

## 文件结构

实现时创建以下结构。每个文件职责必须保持单一。

```text
src/
  core/
    actions.ts          # Action union、parser、validator
    feedback.ts         # Feedback 类型与 helper
    loop.ts             # AgentLoop 主循环
    context.ts          # context builder，合并 task、memory、feedback
    providers.ts        # LLMProvider、MockLLMProvider、OpenAICompatibleProvider
  runtime/
    workspace.ts        # WorkspaceRegistry 与 path boundary
    guardrails.ts       # GuardrailEngine 与 rule implementations
    tools.ts            # file tools 与 allowlisted shell dispatch
  store/
    schema.ts           # SQLite schema SQL
    event-store.ts      # Run/Event/Action/Feedback persistence
    memory-store.ts     # scoped memory write/read
  credentials/
    credential-manager.ts # credential status/set/clear abstraction
    keychain-adapter.ts   # real/fake keychain adapters
  cli/
    main.ts             # CLI entrypoint
  web/
    server.ts           # HTTP server 与 API routes
    views.ts            # server-rendered HTML helpers
  demo/
    mechanisms.ts       # mock LLM 机制演示
tests/
  core/
  runtime/
  store/
  credentials/
  cli/
  web/
examples/
  demo-ts/
config/
  harness.example.yaml
```

核心接口名固定如下，后续 task 不得改名：

```ts
export type Action =
  | { type: "read_file"; path: string; reason: string }
  | { type: "write_file"; path: string; content: string; reason: string }
  | { type: "list_files"; path: string; reason: string }
  | { type: "run_command"; command: string; reason: string }
  | { type: "remember"; key: string; value: string; scope: "workspace" | "global"; reason: string }
  | { type: "finish"; summary: string };

export type Feedback = {
  source:
    | "invalid_action"
    | "safety_blocked"
    | "command_failed"
    | "test_failed"
    | "static_check_failed"
    | "tool_succeeded"
    | "credential_missing";
  severity: "info" | "warning" | "error";
  message: string;
  payload?: Record<string, unknown>;
};

export type GuardrailDecision =
  | { decision: "allow" }
  | { decision: "block"; reason: string; ruleId: string }
  | { decision: "require_approval"; reason: string; ruleId: string };
```

---

## Task 0：文档与流程基线（已完成）

**文件：**

- 已创建：`SPEC.md`
- 已创建：`PLAN.md`
- 已创建：`SPEC_PROCESS.md`
- 已创建：`AGENT_LOG.md`
- 已创建：`README.md`
- 已创建：`SECURITY.md`
- 已创建：`docs/superpowers/specs/2026-07-27-coding-agent-harness-design.md`

**已完成提交：**

- `4aa7027 chore: prepare project baseline via Codex App`
- `2ac1fcb docs: record superpowers installation verification`
- `0a776fe docs: revise spec via superpowers brainstorming`
- `78f0418 docs: localize project documents to Chinese`

**下一门禁：**

- 本 PLAN 写完后，使用 Cursor 仅凭 `SPEC.md` + `PLAN.md` 做冷启动验证。

---

## Task 1：TypeScript 项目脚手架

**文件：**

- 创建：`package.json`
- 创建：`tsconfig.json`
- 创建：`vitest.config.ts`
- 创建：`src/core/actions.ts`
- 创建：`tests/core/actions.test.ts`

**接口：**

- 产出空导出文件 `src/core/actions.ts`，让后续 task 可以开始补接口。

- [ ] **Step 1：写失败测试**

在 `tests/core/actions.test.ts` 写入：

```ts
import { describe, expect, it } from "vitest";
import { parseAction } from "../../src/core/actions";

describe("parseAction scaffold", () => {
  it("exports parseAction", () => {
    expect(typeof parseAction).toBe("function");
  });
});
```

- [ ] **Step 2：运行并确认失败**

运行：`npm test -- tests/core/actions.test.ts`

预期：失败，错误包含 `Cannot find module` 或 `parseAction` 未导出。

- [ ] **Step 3：创建最小脚手架**

`package.json` 必须包含：

```json
{
  "name": "coding-agent-harness",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "vitest run",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "tsc -p tsconfig.json --noEmit",
    "demo:mechanisms": "tsx src/demo/mechanisms.ts"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.1",
    "commander": "^12.1.0",
    "dotenv": "^16.4.7",
    "js-yaml": "^4.1.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^22.10.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

`src/core/actions.ts` 先写：

```ts
export function parseAction(raw: string): unknown {
  return JSON.parse(raw);
}
```

- [ ] **Step 4：运行并确认通过**

运行：`npm test -- tests/core/actions.test.ts`

预期：1 个测试通过。

- [ ] **Step 5：提交**

```bash
git add package.json tsconfig.json vitest.config.ts src/core/actions.ts tests/core/actions.test.ts
git commit -m "chore: scaffold typescript project via subagent T1"
```

---

## Task 2：Action、Feedback、Guardrail 类型与 Parser

**文件：**

- 修改：`src/core/actions.ts`
- 创建：`src/core/feedback.ts`
- 创建：`src/runtime/guardrails.ts`
- 测试：`tests/core/actions.test.ts`

**接口：**

- 产出：`Action`、`parseAction(raw: string): { ok: true; action: Action } | { ok: false; feedback: Feedback }`
- 产出：`Feedback`
- 产出：`GuardrailDecision`

- [ ] **Step 1：写失败测试**

在 `tests/core/actions.test.ts` 增加：

```ts
import { describe, expect, it } from "vitest";
import { parseAction } from "../../src/core/actions";

describe("parseAction", () => {
  it("rejects invalid JSON as invalid_action feedback", () => {
    const result = parseAction("not json");
    expect(result).toEqual({
      ok: false,
      feedback: {
        source: "invalid_action",
        severity: "error",
        message: "LLM output is not valid JSON",
        payload: { raw: "not json" }
      }
    });
  });

  it("parses a valid run_command action", () => {
    const result = parseAction(JSON.stringify({
      type: "run_command",
      command: "npm test",
      reason: "verify tests"
    }));
    expect(result).toEqual({
      ok: true,
      action: {
        type: "run_command",
        command: "npm test",
        reason: "verify tests"
      }
    });
  });

  it.each([
    ["null", null],
    ["array", []],
    ["missing type", { command: "npm test", reason: "verify" }],
    ["unknown type", { type: "shell", command: "npm test", reason: "verify" }],
    ["wrong field type", { type: "run_command", command: 123, reason: "verify" }],
    ["extra field", { type: "finish", summary: "done", unexpected: true }]
  ])("rejects invalid action shape: %s", (_name, value) => {
    const result = parseAction(JSON.stringify(value));
    expect(result).toEqual({
      ok: false,
      feedback: {
        source: "invalid_action",
        severity: "error",
        message: "LLM action shape is invalid",
        payload: { reason: expect.any(String), raw: JSON.stringify(value) }
      }
    });
  });
});
```

- [ ] **Step 2：运行并确认失败**

运行：`npm test -- tests/core/actions.test.ts`

预期：失败，因为 `parseAction` 尚未返回 typed result。

- [ ] **Step 3：实现最小类型与 parser**

`src/core/feedback.ts` 导出固定 `Feedback` 类型。`src/core/actions.ts` 导出 `Action` union 和 `parseAction`。非法 JSON message 必须精确为 `LLM output is not valid JSON`。非法 action shape message 必须精确为 `LLM action shape is invalid`，payload 至少包含 `reason` 和 `raw`。v1 拒绝额外字段。

- [ ] **Step 4：运行并确认通过**

运行：`npm test -- tests/core/actions.test.ts`

预期：parser 测试通过。

- [ ] **Step 5：提交**

```bash
git add src/core/actions.ts src/core/feedback.ts src/runtime/guardrails.ts tests/core/actions.test.ts
git commit -m "feat: add action protocol and parser via subagent T2"
```

---

## Task 3：Workspace Registry 与 Guardrail Engine

**文件：**

- 创建：`src/runtime/workspace.ts`
- 修改：`src/runtime/guardrails.ts`
- 测试：`tests/runtime/workspace.test.ts`
- 测试：`tests/runtime/guardrails.test.ts`

**接口：**

```ts
export type WorkspaceConfig = {
  id: string;
  name: string;
  root: string;
  allowedCommands: string[];
};

export function resolveWorkspacePath(workspace: WorkspaceConfig, relativePath: string): { ok: true; absolutePath: string } | { ok: false; reason: string };

export function classifyAction(action: Action, workspace: WorkspaceConfig): GuardrailDecision;
```

- [ ] **Step 1：写失败测试**

`tests/runtime/guardrails.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { classifyAction } from "../../src/runtime/guardrails";

const workspace = {
  id: "demo-ts",
  name: "TypeScript Demo",
  root: process.cwd(),
  allowedCommands: ["npm test", "npm run build"]
};

describe("classifyAction", () => {
  it("blocks destructive delete commands", () => {
    expect(classifyAction({ type: "run_command", command: "rm -rf .", reason: "cleanup" }, workspace)).toEqual({
      decision: "block",
      reason: "Destructive delete commands are not allowed",
      ruleId: "command.destructive_delete"
    });
  });

  it("blocks commands outside the workspace allowlist", () => {
    expect(classifyAction({ type: "run_command", command: "git push", reason: "publish" }, workspace)).toEqual({
      decision: "block",
      reason: "Publish and deploy commands are not allowed in v1",
      ruleId: "command.publish_or_deploy"
    });
  });

  it("allows allowlisted commands", () => {
    expect(classifyAction({ type: "run_command", command: "npm test", reason: "verify" }, workspace)).toEqual({
      decision: "allow"
    });
  });
});
```

`tests/runtime/workspace.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { resolveWorkspacePath } from "../../src/runtime/workspace";

const workspace = {
  id: "demo",
  name: "Demo",
  root: process.cwd(),
  allowedCommands: []
};

describe("resolveWorkspacePath", () => {
  it("allows dot as the workspace root", () => {
    const result = resolveWorkspacePath(workspace, ".");
    expect(result.ok).toBe(true);
  });

  it("treats an empty path as the workspace root", () => {
    const result = resolveWorkspacePath(workspace, "");
    expect(result.ok).toBe(true);
  });

  it("rejects parent traversal", () => {
    expect(resolveWorkspacePath(workspace, "../outside")).toEqual({
      ok: false,
      reason: "Path escapes workspace root"
    });
  });
});
```

- [ ] **Step 2：运行并确认失败**

运行：`npm test -- tests/runtime/guardrails.test.ts`

预期：失败，因为 `classifyAction` 尚未实现。

- [ ] **Step 3：实现 workspace 与 guardrail**

实现 exact match allowlist、destructive delete block、publish/deploy block、secret access block、sensitive write block、path escape block。Guardrail 规则优先级必须与 `SPEC.md` 一致：destructive delete > secret access/sensitive write > path escape > publish/deploy > not allowlisted > allow。

- [ ] **Step 4：运行并确认通过**

运行：`npm test -- tests/runtime/guardrails.test.ts tests/runtime/workspace.test.ts`

预期：guardrail 与 workspace 测试通过。

- [ ] **Step 5：提交**

```bash
git add src/runtime/workspace.ts src/runtime/guardrails.ts tests/runtime/workspace.test.ts tests/runtime/guardrails.test.ts
git commit -m "feat: add workspace registry and guardrails via subagent T3"
```

---

## Task 4：Tool Dispatcher

**文件：**

- 创建：`src/runtime/tools.ts`
- 测试：`tests/runtime/tools.test.ts`

**接口：**

```ts
export type ToolResult = {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
};

export async function dispatchTool(action: Action, workspace: WorkspaceConfig): Promise<ToolResult>;
```

- [ ] **Step 1：写失败测试**

`tests/runtime/tools.test.ts`：

```ts
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dispatchTool } from "../../src/runtime/tools";

describe("dispatchTool", () => {
  it("writes and reads files inside workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-tools-"));
    const workspace = { id: "tmp", name: "Tmp", root, allowedCommands: [] };
    await dispatchTool({ type: "write_file", path: "a.txt", content: "hello", reason: "write" }, workspace);
    await expect(readFile(join(root, "a.txt"), "utf8")).resolves.toBe("hello");
  });

  it("rejects path traversal outside workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-tools-"));
    const workspace = { id: "tmp", name: "Tmp", root, allowedCommands: [] };
    const result = await dispatchTool({ type: "read_file", path: "../secret.txt", reason: "escape" }, workspace);
    expect(result).toEqual({ ok: false, error: "Path escapes workspace root" });
  });
});
```

- [ ] **Step 2：运行并确认失败**

运行：`npm test -- tests/runtime/tools.test.ts`

预期：失败，因为 `dispatchTool` 尚未实现。

- [ ] **Step 3：实现最小工具分发**

实现 `read_file`、`write_file`、`list_files`、`run_command`。`remember` 在本 task 中返回“需要 memory store”的结构化结果，实际 SQLite 写入由 Task 7 接入。`finish` 不触发工具执行。`run_command` 只执行 allowlist 命令。

- [ ] **Step 4：运行并确认通过**

运行：`npm test -- tests/runtime/tools.test.ts`

预期：文件工具和路径逃逸测试通过。

- [ ] **Step 5：提交**

```bash
git add src/runtime/tools.ts tests/runtime/tools.test.ts
git commit -m "feat: add bounded tool dispatcher via subagent T4"
```

---

## Task 5：Mock LLM、Context Builder 与 Agent Loop

**文件：**

- 创建：`src/core/providers.ts`
- 创建：`src/core/context.ts`
- 创建：`src/core/loop.ts`
- 测试：`tests/core/loop.test.ts`

**接口：**

```ts
export type LLMProvider = {
  complete(input: { task: string; context: string }): Promise<string>;
};

export async function runAgentLoop(input: {
  task: string;
  workspace: WorkspaceConfig;
  provider: LLMProvider;
  maxIterations: number;
}): Promise<{ status: "finished" | "blocked" | "max_iterations"; events: Array<Record<string, unknown>> }>;
```

- [ ] **Step 1：写失败测试**

`tests/core/loop.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { runAgentLoop } from "../../src/core/loop";
import { MockLLMProvider } from "../../src/core/providers";

describe("runAgentLoop", () => {
  it("stops when mock LLM returns finish", async () => {
    const provider = new MockLLMProvider([
      JSON.stringify({ type: "finish", summary: "done" })
    ]);
    const result = await runAgentLoop({
      task: "finish",
      workspace: { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: [] },
      provider,
      maxIterations: 3
    });
    expect(result.status).toBe("finished");
  });

  it("stops at max_iterations", async () => {
    const provider = new MockLLMProvider([
      JSON.stringify({ type: "list_files", path: ".", reason: "inspect" }),
      JSON.stringify({ type: "list_files", path: ".", reason: "inspect again" })
    ]);
    const result = await runAgentLoop({
      task: "loop",
      workspace: { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: [] },
      provider,
      maxIterations: 1
    });
    expect(result.status).toBe("max_iterations");
  });
});
```

- [ ] **Step 2：运行并确认失败**

运行：`npm test -- tests/core/loop.test.ts`

预期：失败，因为 provider 与 loop 未实现。

- [ ] **Step 3：实现 mock provider 与主循环**

`MockLLMProvider` 每次返回 scripted response。`runAgentLoop` 执行 parse -> guardrail -> dispatch -> feedback -> next/stop，并记录 event array。

- [ ] **Step 4：运行并确认通过**

运行：`npm test -- tests/core/loop.test.ts`

预期：loop 测试通过。

- [ ] **Step 5：提交**

```bash
git add src/core/providers.ts src/core/context.ts src/core/loop.ts tests/core/loop.test.ts
git commit -m "feat: add mock llm and agent loop via subagent T5"
```

---

## Task 6：Feedback Sensors 与自修正机制测试

**文件：**

- 修改：`src/core/feedback.ts`
- 修改：`src/core/context.ts`
- 修改：`src/core/loop.ts`
- 测试：`tests/core/feedback.test.ts`

**接口：**

```ts
export function feedbackFromCommandResult(result: ToolResult): Feedback;
export function feedbackFromGuardrail(decision: Exclude<GuardrailDecision, { decision: "allow" }>): Feedback;
export function buildContext(input: { task: string; feedback: Feedback[]; memories: string[] }): string;
```

- [ ] **Step 1：写失败测试**

`tests/core/feedback.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { feedbackFromCommandResult } from "../../src/core/feedback";
import { buildContext } from "../../src/core/context";

describe("feedback sensors", () => {
  it("classifies failing test output", () => {
    const feedback = feedbackFromCommandResult({
      ok: false,
      stdout: "1 failed, 2 passed",
      stderr: "",
      exitCode: 1
    });
    expect(feedback.source).toBe("test_failed");
    expect(feedback.severity).toBe("error");
  });

  it("injects feedback into the next context", () => {
    const context = buildContext({
      task: "fix tests",
      feedback: [{ source: "test_failed", severity: "error", message: "1 failed", payload: { exitCode: 1 } }],
      memories: []
    });
    expect(context).toContain("test_failed");
    expect(context).toContain("1 failed");
  });
});
```

- [ ] **Step 2：运行并确认失败**

运行：`npm test -- tests/core/feedback.test.ts`

预期：失败，因为 feedback helpers 未实现。

- [ ] **Step 3：实现 feedback sensor**

实现命令失败、测试失败、static check 失败、guardrail block、tool success、credential missing 的分类。

- [ ] **Step 4：运行并确认通过**

运行：`npm test -- tests/core/feedback.test.ts tests/core/loop.test.ts`

预期：feedback 与 loop 测试通过。

- [ ] **Step 5：提交**

```bash
git add src/core/feedback.ts src/core/context.ts src/core/loop.ts tests/core/feedback.test.ts
git commit -m "feat: add feedback sensors via subagent T6"
```

---

## Task 7：SQLite Event Store 与 Memory

**文件：**

- 创建：`src/store/schema.ts`
- 创建：`src/store/event-store.ts`
- 创建：`src/store/memory-store.ts`
- 修改：`src/core/loop.ts`
- 测试：`tests/store/event-store.test.ts`
- 测试：`tests/store/memory-store.test.ts`

**接口：**

```ts
export class EventStore {
  constructor(dbPath: string);
  createRun(input: { task: string; workspaceId: string; mode: string }): string;
  appendEvent(runId: string, kind: string, payload: Record<string, unknown>): void;
  listEvents(runId: string): Array<{ sequence: number; kind: string; payload: Record<string, unknown> }>;
}

export class MemoryStore {
  constructor(dbPath: string);
  remember(input: { workspaceId: string; scope: "workspace" | "global"; key: string; value: string }): void;
  recall(input: { workspaceId: string; scope: "workspace" | "global"; limit: number }): Array<{ key: string; value: string }>;
}
```

- [ ] **Step 1：写失败测试**

`tests/store/memory-store.test.ts`：

```ts
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../../src/store/memory-store";

describe("MemoryStore", () => {
  it("stores and recalls workspace-scoped memory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-memory-"));
    const store = new MemoryStore(join(dir, "test.sqlite"));
    store.remember({ workspaceId: "demo", scope: "workspace", key: "project.testCommand", value: "npm test" });
    expect(store.recall({ workspaceId: "demo", scope: "workspace", limit: 5 })).toEqual([
      { key: "project.testCommand", value: "npm test" }
    ]);
  });
});
```

- [ ] **Step 2：运行并确认失败**

运行：`npm test -- tests/store/memory-store.test.ts`

预期：失败，因为 store 未实现。

- [ ] **Step 3：实现 SQLite schema 与 store**

创建表：`runs`、`events`、`actions`、`feedback`、`memory_items`、`workspace_config_snapshots`。写入 payload 前调用 redaction helper，移除 key 名含 `secret`、`token`、`apiKey` 的值。

- [ ] **Step 4：运行并确认通过**

运行：`npm test -- tests/store/event-store.test.ts tests/store/memory-store.test.ts`

预期：SQLite store 测试通过。

- [ ] **Step 5：提交**

```bash
git add src/store/schema.ts src/store/event-store.ts src/store/memory-store.ts src/core/loop.ts tests/store/event-store.test.ts tests/store/memory-store.test.ts
git commit -m "feat: add sqlite event and memory stores via subagent T7"
```

---

## Task 8：Credential Manager

**文件：**

- 创建：`src/credentials/keychain-adapter.ts`
- 创建：`src/credentials/credential-manager.ts`
- 测试：`tests/credentials/credential-manager.test.ts`

**接口：**

```ts
export type KeychainAdapter = {
  get(service: string, account: string): Promise<string | undefined>;
  set(service: string, account: string, value: string): Promise<void>;
  delete(service: string, account: string): Promise<void>;
};

export class CredentialManager {
  constructor(adapter: KeychainAdapter, options?: { allowEnvFallback?: boolean });
  status(provider: string): Promise<{ provider: string; exists: boolean; source?: "keychain" | "env" }>;
  set(provider: string, value: string): Promise<void>;
  clear(provider: string): Promise<void>;
}
```

- [ ] **Step 1：写失败测试**

`tests/credentials/credential-manager.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { CredentialManager } from "../../src/credentials/credential-manager";
import { InMemoryKeychainAdapter } from "../../src/credentials/keychain-adapter";

describe("CredentialManager", () => {
  it("reports status without revealing secret value", async () => {
    const adapter = new InMemoryKeychainAdapter();
    const manager = new CredentialManager(adapter);
    await manager.set("openai-compatible", "sk-test-secret");
    await expect(manager.status("openai-compatible")).resolves.toEqual({
      provider: "openai-compatible",
      exists: true,
      source: "keychain"
    });
  });

  it("clears stored credentials", async () => {
    const adapter = new InMemoryKeychainAdapter();
    const manager = new CredentialManager(adapter);
    await manager.set("openai-compatible", "sk-test-secret");
    await manager.clear("openai-compatible");
    await expect(manager.status("openai-compatible")).resolves.toEqual({
      provider: "openai-compatible",
      exists: false
    });
  });
});
```

- [ ] **Step 2：运行并确认失败**

运行：`npm test -- tests/credentials/credential-manager.test.ts`

预期：失败，因为 credential manager 未实现。

- [ ] **Step 3：实现 fake adapter 与 manager**

实现 `InMemoryKeychainAdapter` 用于测试。真实 OS keychain adapter 可在 CLI 接入时实现；测试不依赖真实系统 keychain。

- [ ] **Step 4：运行并确认通过**

运行：`npm test -- tests/credentials/credential-manager.test.ts`

预期：credential 测试通过。

- [ ] **Step 5：提交**

```bash
git add src/credentials/keychain-adapter.ts src/credentials/credential-manager.ts tests/credentials/credential-manager.test.ts
git commit -m "feat: add credential manager via subagent T8"
```

---

## Task 9：CLI 与机制演示

**文件：**

- 创建：`src/cli/main.ts`
- 创建：`src/demo/mechanisms.ts`
- 修改：`package.json`
- 测试：`tests/cli/demo.test.ts`

**接口：**

- CLI 命令：
  - `harness demo`
  - `harness run --workspace <id> --provider mock --task <text>`
  - `harness credentials status --provider <name>`
  - `harness credentials set --provider <name>`
  - `harness credentials clear --provider <name>`
- npm script：`npm run demo:mechanisms`

- [ ] **Step 1：写失败测试**

`tests/cli/demo.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { runMechanismDemo } from "../../src/demo/mechanisms";

describe("mechanism demo", () => {
  it("shows guardrail block and feedback-driven correction", async () => {
    const result = await runMechanismDemo();
    expect(result.events.map((event) => event.kind)).toContain("guardrail.blocked");
    expect(result.events.map((event) => event.kind)).toContain("feedback.test_failed");
    expect(result.events.map((event) => event.kind)).toContain("action.write_file");
  });
});
```

- [ ] **Step 2：运行并确认失败**

运行：`npm test -- tests/cli/demo.test.ts`

预期：失败，因为 demo 未实现。

- [ ] **Step 3：实现 CLI 与 demo**

`runMechanismDemo()` 使用 `MockLLMProvider` scripted responses：先输出危险 `rm -rf .`，再运行 `npm test` 并注入失败 feedback，再输出 `write_file`，最后 `finish`。

- [ ] **Step 4：运行并确认通过**

运行：`npm test -- tests/cli/demo.test.ts && npm run demo:mechanisms`

预期：测试通过，demo 输出 timeline JSON。

- [ ] **Step 5：提交**

```bash
git add src/cli/main.ts src/demo/mechanisms.ts package.json tests/cli/demo.test.ts
git commit -m "feat: add cli and mechanism demo via subagent T9"
```

---

## Task 10：WebUI Run Control

**文件：**

- 创建：`src/web/server.ts`
- 创建：`src/web/views.ts`
- 创建：`config/harness.example.yaml`
- 测试：`tests/web/server.test.ts`

**接口：**

- `GET /`：返回 workspace list 与 run form HTML
- `GET /api/workspaces`：返回预注册 workspace list，不包含 secret
- `POST /api/runs`：body `{ "workspaceId": "demo-ts", "provider": "mock", "task": "fix tests" }`
- `GET /api/runs/:id`：返回 timeline

当前增强约束：

- 页面是简单模型前端，用于展示 workspace 边界、mock provider、harness run 和 timeline 机制。
- 首页展示 workspace id/name 与 allowlist commands。
- run 详情页使用可扫读标签展示模型响应、动作、护栏、工具结果、反馈和停止原因。
- 不引入前端框架，不实现完整代码编辑器，不使用 Open Design；Open Design 留到独立 UI 增强阶段。

后续 DeepSeek 接入约束：

- `deepseek-compatible` provider 使用 `https://api.deepseek.com/chat/completions`。
- 默认模型为 `deepseek-v4-flash`，`thinking` 为 `disabled`。
- API key 从 `DEEPSEEK_API_KEY` 读取，不写入 Git、SQLite、日志或 WebUI response。
- Provider 请求格式用 fake fetch 测试，不能让一键测试依赖真实 DeepSeek 网络。

- [ ] **Step 1：写失败测试**

`tests/web/server.test.ts`：

```ts
import { describe, expect, it } from "vitest";
import { createServer } from "../../src/web/server";

describe("web server", () => {
  it("rejects unregistered workspace ids", async () => {
    const app = createServer({
      workspaces: [{ id: "demo-ts", name: "Demo TS", root: process.cwd(), allowedCommands: ["npm test"] }]
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "unknown", provider: "mock", task: "run tests" }
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Unknown workspace id" });
  });
});
```

- [ ] **Step 2：运行并确认失败**

运行：`npm test -- tests/web/server.test.ts`

预期：失败，因为 WebUI server 未实现。

- [ ] **Step 3：实现最小 server**

使用 Node HTTP 或轻量 server library。若使用 Fastify，需要在 `package.json` 加入 `fastify` 并保持测试中的 `app.inject`；若不用 Fastify，测试要改为 Node HTTP request helper。选择 Fastify 时 `createServer()` 返回 Fastify instance。

- [ ] **Step 4：运行并确认通过**

运行：`npm test -- tests/web/server.test.ts`

预期：WebUI API 边界测试通过。

- [ ] **Step 5：提交**

```bash
git add src/web/server.ts src/web/views.ts config/harness.example.yaml package.json tests/web/server.test.ts
git commit -m "feat: add webui run control via subagent T10"
```

---

## Task 11：Docker、CI 与最终文档

**文件：**

- 创建：`Dockerfile`
- 创建：`docker-compose.yml`
- 修改：`.github/workflows/unit-test.yml`
- 修改：`.gitlab-ci.yml`
- 修改：`README.md`
- 修改：`SECURITY.md`

**接口：**

- Docker build：`docker build -t coding-agent-harness .`
- Docker run：`docker run --rm -p 3000:3000 coding-agent-harness`
- CI job 名称：`unit-test`

- [ ] **Step 1：写失败验证**

运行：`npm test && npm run build`

预期：在 Docker/CI 文件尚未补全前，build 或文档检查步骤缺失。

- [ ] **Step 2：补 Dockerfile 与 compose**

`Dockerfile` 使用 Node LTS，安装依赖，运行 `npm run build`，启动 WebUI server。`docker-compose.yml` 暴露 `3000:3000`，挂载 SQLite data volume。

- [ ] **Step 3：更新 CI**

GitHub Actions：

```yaml
name: unit-test
jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: docker build -t coding-agent-harness .
```

`.gitlab-ci.yml` 保持 job 名为 `unit-test`，执行 `npm ci`、`npm test`、`npm run build`。

- [ ] **Step 4：更新 README 与 SECURITY**

README 必须包含：项目简介、安装、运行、分发命令、目录结构、key 安全配置、WebUI 无 password 风险、Docker + Nginx 部署说明。

- [ ] **Step 5：运行并确认通过**

运行：`npm test && npm run build`

预期：测试与构建通过。若本机可用 Docker，再运行 `docker build -t coding-agent-harness .`。

- [ ] **Step 6：提交**

```bash
git add Dockerfile docker-compose.yml .github/workflows/unit-test.yml .gitlab-ci.yml README.md SECURITY.md
git commit -m "chore: add distribution and ci via subagent T11"
```

---

## Cursor 冷启动验证

在任何实现任务开始前，用 Cursor 新开 session，仅提供 `SPEC.md` 与本 `PLAN.md`。冷启动验证不提交代码，不要求留下可运行实现；目标是暴露 spec/plan 歧义。为了避免 T2/T3 依赖 T1 造成误解，冷启动目标固定为 **T1 + T2**。

> 你正在验证这个 AI4SE Project A 规约。请从 `PLAN.md` 中选择 T1 和 T2，并尝试用 TDD 实现它们。不要依赖任何先前对话或隐藏上下文。如果任何要求存在歧义，请停止并提问，不要猜测。请报告你遇到的所有歧义、不一致、缺失接口或非预期解读。冷启动验证阶段不要执行 git commit。

将结果写入 `SPEC_PROCESS.md`：

- Cursor 在哪里暂停提问
- 暴露了哪些 spec/plan 缺陷
- 哪些解释与你原意不同
- 产出与预期差距
- 因此对 `SPEC.md` / `PLAN.md` 做了哪些修订

---

## Worktree 与执行策略

推荐分支：

- `feature/core-loop`：Task 1、2、5、6
- `feature/guardrails-tools`：Task 3、4
- `feature/store-credentials`：Task 7、8
- `feature/cli-webui`：Task 9、10
- `feature/distribution-ci`：Task 11

每个 task 结束后：

1. 运行该 task 的验证命令。
2. 更新 `PLAN.md` 中对应 task 状态和 commit hash。
3. 更新 `AGENT_LOG.md`，记录 subagent、prompt/context、人工干预和 lesson。
4. 先做 spec compliance review，再做 code quality review。

---

## Plan 自查结果

- SPEC 中六类机制均有对应 task：decision（T5）、tools（T4）、memory（T7）、governance（T3）、feedback（T6）、configuration/workspace（T3/T10）。
- WebUI 真实 run 边界由 T10 覆盖。
- 凭据安全由 T8、T11 覆盖。
- Docker/CI/README 由 T11 覆盖。
- 一键测试入口 `npm test` 从 T1 开始建立，并贯穿全部 task。
- Cursor 冷启动验证必须在 Task 1 前完成。
