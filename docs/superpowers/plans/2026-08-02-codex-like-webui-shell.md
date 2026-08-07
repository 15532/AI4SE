# Codex-like WebUI Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Browser Editor V1 改造成更接近 Codex 桌面端的现代全屏工作台。

**Architecture:** 继续使用现有 server-rendered HTML/CSS。`src/web/views.ts` 负责 app shell 结构和样式，`src/runtime/workspace-explorer.ts` 负责文件树降噪，`src/web/server.ts` 继续负责路由和数据注入。

**Tech Stack:** TypeScript、Node.js HTTP server、Vitest、server-rendered HTML/CSS。

## Global Constraints

- 新增文档和提交信息使用中文。
- 不自动 push。
- 不在用户确认前提交。
- 不引入新的前端框架或复杂构建链。
- WebUI 保存文件继续复用 workspace boundary、guardrail 和敏感信息规则。

---

### Task 1: Modern Shell Tests

**Files:**
- Modify: `tests/web/server.test.ts`
- Modify: `tests/runtime/workspace-explorer.test.ts`

**Interfaces:**
- Consumes: `renderWorkspaceFiles(...)`、`renderWorkspaceFileEditor(...)`、`listWorkspaceFiles(...)`
- Produces: failing tests for modern shell classes and file tree noise filtering

- [ ] **Step 1: Write failing WebUI shell assertions**

在工作区文件浏览和编辑页测试中断言 HTML 包含：

```ts
expect(response.body).toContain("codex-app-shell");
expect(response.body).toContain("codex-app-bar");
expect(response.body).toContain("codex-sidebar");
expect(response.body).toContain("codex-editor-main");
expect(response.body).toContain("codex-agent-panel");
```

- [ ] **Step 2: Write failing file tree noise test**

创建 `.git` 文件、`node_modules` 目录和可见源码文件，断言 `listWorkspaceFiles` 不返回噪声条目。

- [ ] **Step 3: Run tests to verify failure**

Run: `npm.cmd test -- tests/web/server.test.ts tests/runtime/workspace-explorer.test.ts`

### Task 2: Implement Modern Shell

**Files:**
- Modify: `src/web/views.ts`
- Modify: `src/runtime/workspace-explorer.ts`

**Interfaces:**
- Produces: modern shell HTML classes and quieter file tree entries

- [ ] **Step 1: Update file explorer filtering**

Skip `.git`, `node_modules`, `dist`, `coverage` regardless of whether the entry is a directory or a file.

- [ ] **Step 2: Replace workspace file pages with app shell**

Refactor `renderWorkspaceFiles` and `renderWorkspaceFileEditor` to share full-screen app shell classes:

```html
<main class="codex-app-shell workspace-editor">
  <header class="codex-app-bar">...</header>
  <aside class="codex-sidebar">...</aside>
  <section class="codex-editor-main">...</section>
  <aside class="codex-agent-panel">...</aside>
</main>
```

- [ ] **Step 3: Update CSS**

Add app-shell layout styles, modern file row states, editor tab/header/status bar, and compact Agent panel cards.

- [ ] **Step 4: Run focused tests**

Run: `npm.cmd test -- tests/web/server.test.ts tests/runtime/workspace-explorer.test.ts`

### Task 3: Verification And Preview

**Files:**
- Verify only unless documentation needs a route note.

- [ ] **Step 1: Run full test suite**

Run: `npm.cmd test`

- [ ] **Step 2: Run build**

Run: `npm.cmd run build`

- [ ] **Step 3: Start preview smoke check**

Start WebUI on an alternate port with a temporary SQLite database and request:

```text
/workspaces/demo-ts/files
/workspaces/demo-ts/files/README.md
```

- [ ] **Step 4: Ask before commit**

Summarize implementation and wait for user confirmation.

