# Chat-first WebUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 WebUI 首页升级为以 AI 对话为主体的 Codex-like 工作台。

**Architecture:** 继续使用 `src/web/views.ts` 中的 server-rendered HTML/CSS。`renderIndex` 输出新的 chat-first 首页，`server.ts` 的 `/` 路由和 `/api/runs` 行为不变，已有文件编辑器保留为辅助工具页。

**Tech Stack:** TypeScript、Node.js HTTP server、Vitest、server-rendered HTML/CSS。

## Global Constraints

- 新增文档和提交信息使用中文。
- 不自动 push。
- 不在用户确认前提交。
- 不引入 React、Monaco 或客户端路由。
- 首页提交任务必须继续走真实 harness run 和现有 guardrail。

---

### Task 1: Chat-first Homepage Tests

**Files:**
- Modify: `tests/web/server.test.ts`

**Interfaces:**
- Consumes: `GET /` rendered by `renderIndex(...)`
- Produces: failing tests for chat-first shell classes and composer fields

- [ ] **Step 1: Add homepage shell assertions**

Add assertions:

```ts
expect(response.body).toContain("chat-app-shell");
expect(response.body).toContain("chat-sidebar");
expect(response.body).toContain("chat-thread");
expect(response.body).toContain("chat-message");
expect(response.body).toContain("chat-composer");
expect(response.body).toContain("chat-inspector");
```

- [ ] **Step 2: Add composer compatibility assertions**

Assert the same page still contains:

```ts
expect(response.body).toContain('method="post" action="/api/runs"');
expect(response.body).toContain('name="workspaceId"');
expect(response.body).toContain('name="provider"');
expect(response.body).toContain('name="task"');
```

- [ ] **Step 3: Run test to verify failure**

Run: `npm.cmd test -- tests/web/server.test.ts`

### Task 2: Implement Chat-first Homepage

**Files:**
- Modify: `src/web/views.ts`

**Interfaces:**
- Produces: `renderIndex(...)` chat-first HTML while preserving form names and existing route targets

- [ ] **Step 1: Add chat shell CSS**

Add styles for `.chat-app-shell`, `.chat-sidebar`, `.chat-thread`, `.chat-message`, `.chat-composer`, `.chat-inspector`.

- [ ] **Step 2: Replace `renderIndex` markup**

Render a Codex-like layout:

```html
<main class="chat-app-shell">
  <aside class="chat-sidebar">...</aside>
  <section class="chat-main">
    <div class="chat-thread">...</div>
    <form class="chat-composer task-composer" method="post" action="/api/runs">...</form>
  </section>
  <aside class="chat-inspector">...</aside>
</main>
```

- [ ] **Step 3: Preserve compatibility**

Keep provider/workspace options and task field names exactly unchanged.

- [ ] **Step 4: Run focused tests**

Run: `npm.cmd test -- tests/web/server.test.ts`

### Task 3: Verification And Preview

**Files:**
- Verify only unless README needs a short note.

- [ ] **Step 1: Run full tests**

Run: `npm.cmd test`

- [ ] **Step 2: Run build**

Run: `npm.cmd run build`

- [ ] **Step 3: Start preview smoke check**

Start WebUI on a new local port with a temporary SQLite database and request `/`.

- [ ] **Step 4: Ask before commit**

Summarize implementation and wait for user confirmation.

