# Browser Editor V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 WebUI 中增加浏览器内轻量代码浏览与编辑能力。

**Architecture:** 新增 `workspace-editor` 作为安全保存文本文件的运行时入口，Web server 负责把文件浏览/编辑页面和保存 API 接到预注册 workspace。页面继续使用 server-rendered HTML，视觉风格采用用户确认的 Open Design 参考工作台。

**Tech Stack:** TypeScript、Node.js HTTP server、Vitest、SQLite 现有事件/记忆存储、server-rendered HTML/CSS。

## Global Constraints

- 新增文档和提交信息使用中文。
- 不自动 push。
- 不在用户确认前提交。
- WebUI 不能接收任意 root。
- 保存文件必须经过 workspace boundary、guardrail 和敏感信息规则。

---

### Task 1: Workspace Editor Runtime

**Files:**
- Create: `src/runtime/workspace-editor.ts`
- Test: `tests/runtime/workspace-editor.test.ts`

**Interfaces:**
- Consumes: `classifyAction(action, workspace)` and `dispatchTool(action, workspace)`
- Produces: `saveWorkspaceTextFile(workspace, relativePath, content): Promise<{ ok: true; path: string } | { ok: false; error: string; ruleId?: string }>`

- [ ] **Step 1: Write failing tests**

```ts
await expect(saveWorkspaceTextFile(workspace, "src/index.ts", "export const ok = true;\n"))
  .resolves.toEqual({ ok: true, path: "src/index.ts" });
await expect(saveWorkspaceTextFile(workspace, "../outside.ts", "x"))
  .resolves.toEqual({ ok: false, error: "Path escapes workspace root", ruleId: "path.escape_workspace" });
await expect(saveWorkspaceTextFile(workspace, ".env", "TOKEN=value"))
  .resolves.toEqual({ ok: false, error: "Sensitive files cannot be written", ruleId: "write.sensitive_file" });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/runtime/workspace-editor.test.ts`

- [ ] **Step 3: Implement runtime**

Construct a `write_file` action, classify it, dispatch it only when allowed, then read back portable path through `readWorkspaceTextFile`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/runtime/workspace-editor.test.ts`

### Task 2: Web Routes And Pages

**Files:**
- Modify: `src/web/server.ts`
- Modify: `src/web/views.ts`
- Test: `tests/web/server.test.ts`

**Interfaces:**
- Produces: `GET /workspaces/:id/files`
- Produces: `GET /workspaces/:id/files/<relativePath>`
- Produces: `POST /api/workspaces/:id/files/<relativePath>`
- Produces: `renderWorkspaceFiles(...)` and `renderWorkspaceFileEditor(...)`

- [ ] **Step 1: Write failing Web tests**

Test file browser renders `workspace-file-browser`, editor renders `workspace-editor`, form save updates file content, and unsafe saves return 400.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm.cmd test -- tests/web/server.test.ts`

- [ ] **Step 3: Implement routes and views**

Add server routes near existing `/api/workspaces/:id/files` handling. Reuse `listWorkspaceFiles`, `readWorkspaceTextFile`, `saveWorkspaceTextFile`, `listWorkspaceChanges`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm.cmd test -- tests/web/server.test.ts`

### Task 3: Docs And Verification

**Files:**
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `AGENT_LOG.md`
- Modify: `docs/FINAL_DELIVERY_CHECKLIST.md`

- [ ] **Step 1: Update docs**

Document browser editor routes, safety boundaries and Open Design referenced style.

- [ ] **Step 2: Run full verification**

Run: `npm.cmd test`

Run: `npm.cmd run build`

- [ ] **Step 3: Ask before commit**

Summarize implementation and wait for user confirmation.
