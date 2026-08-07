# Coding Agent Usable Loop V1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 harness 从“能运行 action 的测试/演示核心”升级为能完成小型代码开发任务的可用 coding agent 链路。

**Architecture:** 保留现有严格 JSON Action、tool dispatcher、guardrail、feedback 和 SQLite timeline。增强 context builder 与 provider prompt，让真实 LLM 知道可用工具、工作策略、allowed commands 和最近反馈；修改 loop，让 invalid action / guardrail block 可以作为反馈继续迭代；新增确定性端到端演示证明 agent 可以读文件、写修复、跑测试并 finish。

**Tech Stack:** TypeScript、Node.js、Vitest、DeepSeek provider、mock/stub LLM。

## Global Constraints

- 不放宽 `parseAction`，错误 schema 不能被静默兼容。
- 不绕过 guardrail 或 workspace boundary。
- 真实 DeepSeek 只替换决策来源，所有工具执行仍由 harness 代码完成。
- 一键测试必须不依赖真实 LLM 或网络。
- 方案 B 的 IDE UI 增强暂不实现，只在文档中记录为后续阶段。
- 不自动提交；提交前必须先向用户确认。

---

### Task 1: 可用 coding agent 上下文

**Files:**
- Modify: `src/core/context.ts`
- Modify: `src/core/providers.ts`
- Test: `tests/core/context.test.ts`
- Test: `tests/core/providers.test.ts`

**Interfaces:**
- `buildContext(input: { task, feedback, memories, workspace?, allowedCommands?, recentEvents? }): string`
- Provider system prompt 必须包含 action schema、工作策略、禁止过早 finish、反馈修正规则。

- [x] **Step 1: Write failing tests**

`tests/core/context.test.ts`：

```ts
expect(context).toContain("Available actions");
expect(context).toContain("list_files");
expect(context).toContain("read_file");
expect(context).toContain("write_file");
expect(context).toContain("run_command");
expect(context).toContain("Allowed commands");
expect(context).toContain("npm test");
expect(context).toContain("Do not finish before");
```

`tests/core/providers.test.ts`：

```ts
expect(system).toContain("inspect the workspace before editing");
expect(system).toContain("after writing code, run an allowed verification command");
expect(system).toContain("if feedback reports invalid_action, return a corrected JSON action");
```

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/core/context.test.ts tests/core/providers.test.ts`

Expected: FAIL because current context is raw JSON and prompt lacks coding workflow.

- [x] **Step 3: Implement minimal context/prompt**

Render readable sections:
- Task
- Workspace
- Available actions with exact JSON examples
- Allowed commands
- Memories
- Recent feedback
- Operating rules

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/core/context.test.ts tests/core/providers.test.ts`

Expected: PASS.

### Task 2: Loop feedback continuation

**Files:**
- Modify: `src/core/loop.ts`
- Test: `tests/core/loop.test.ts`

**Interfaces:**
- `runAgentLoop` keeps existing return shape.
- Invalid action and guardrail block append feedback and continue while iterations remain.
- If no valid action arrives before max iterations, stop with `max_iterations`.
- `finish` remains immediate success.

- [x] **Step 1: Write failing tests**

Add tests:
- provider first returns invalid JSON, second returns finish; result status is `finished` and second context contains `invalid_action`.
- provider first returns blocked `git push`, second returns finish; result status is `finished` and second context contains `safety_blocked`.

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/core/loop.test.ts`

Expected: FAIL because current loop stops immediately on invalid action or guardrail block.

- [x] **Step 3: Implement continuation**

Change invalid action and guardrail branches from immediate return to `continue`, unless current iteration is last.

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/core/loop.test.ts`

Expected: PASS.

### Task 3: 端到端代码开发演示

**Files:**
- Create: `src/demo/coding-task.ts`
- Test: `tests/demo/coding-task.test.ts`
- Modify: `package.json` if adding a new demo script is needed.

**Interfaces:**
- Demo must use mock/stub LLM to perform:
  1. `list_files`
  2. `read_file`
  3. `write_file`
  4. `run_command`
  5. `finish`
- It must run against a temporary workspace, not the real repo.

- [x] **Step 1: Write failing test**

Create `tests/demo/coding-task.test.ts`:

```ts
expect(actionTypes).toEqual(expect.arrayContaining(["list_files", "read_file", "write_file", "run_command", "finish"]));
expect(result.status).toBe("finished");
expect(finalFile).toContain("return a + b");
```

- [x] **Step 2: Run test to verify failure**

Run: `npm test -- tests/demo/coding-task.test.ts`

Expected: FAIL before demo/helper exists.

- [x] **Step 3: Implement deterministic coding task**

Use a scripted provider and temporary workspace:
- create `src/add.js` with wrong implementation
- create `package.json` and `test.js`
- allowed command: `npm test`
- scripted actions inspect, edit, test, finish

- [x] **Step 4: Run test to verify pass**

Run: `npm test -- tests/demo/coding-task.test.ts`

Expected: PASS.

### Task 4: 文档更新与方案 B 排队

**Files:**
- Modify: `SPEC.md`
- Modify: `README.md`
- Modify: `AGENT_LOG.md`
- Modify: `docs/FINAL_DELIVERY_CHECKLIST.md`

- [x] **Step 1: Update docs**

Document:
- Usable Loop V1 can perform small coding tasks.
- Real development path: inspect -> edit -> verify -> feedback -> finish.
- Scheme B is next: IDE-like WebUI with file tree/diff/task panel.

- [x] **Step 2: Run verification**

Run:
- `npm test`
- `npm run build`

Expected: all tests and build pass.
