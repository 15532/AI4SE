# Workspace Session V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 WebUI 具备持续 workspace session 的最小能力：代码只读查看、memory 可见、最近 run 摘要进入后续 context。

**Architecture:** 在现有 Node HTTP server 和 SQLite store 上增加只读 workspace explorer 与 recent run retrieval。Agent loop 仍由 `runAgentLoop` 驱动；context builder 新增 recent run summaries 输入。WebUI 继续 server-rendered，不引入前端框架。

**Tech Stack:** TypeScript、Node.js、Vitest、better-sqlite3、server-rendered HTML/CSS。

## Global Constraints

- 不引入前端框架。
- 不增加 WebUI 文件写入 API。
- 文件查看必须通过 workspace boundary。
- WebUI 不展示 workspace root、API key 或 secret-like 内容。
- 跳过 `.git`、`node_modules`、`dist`、`coverage`。
- 单文件查看大小上限为 200 KiB。
- 提交前运行 `npm test` 与 `npm run build`。

---

### Task 1: Workspace Explorer Runtime

**Files:**
- Create: `src/runtime/workspace-explorer.ts`
- Test: `tests/runtime/workspace-explorer.test.ts`

**Interfaces:**
- `listWorkspaceFiles(workspace: WorkspaceConfig, options?: { limit?: number }): Promise<Array<{ path: string; kind: "file" | "directory" }>>`
- `readWorkspaceTextFile(workspace: WorkspaceConfig, relativePath: string, options?: { maxBytes?: number }): Promise<{ ok: true; path: string; content: string } | { ok: false; error: string }>`

- [x] **Step 1: Write failing tests**

Create tests for:
- lists files under workspace root.
- skips `node_modules`.
- rejects `../outside`.
- reads UTF-8 text file.
- rejects files larger than `maxBytes`.

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/runtime/workspace-explorer.test.ts`

Expected: FAIL because module does not exist.

- [x] **Step 3: Implement runtime**

Use `resolveWorkspacePath` plus realpath ancestor checks from existing runtime patterns. Sort paths alphabetically. Return relative POSIX-style paths.

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/runtime/workspace-explorer.test.ts`

Expected: PASS.

### Task 2: Store Recent Run Summaries

**Files:**
- Modify: `src/store/event-store.ts`
- Test: `tests/store/event-store.test.ts`

**Interfaces:**
- `listRecentRuns(workspaceId: string, limit: number): Array<{ id: string; task: string; createdAt: string }>`
- `summarizeRun(runId: string): { id: string; task: string; status: string; summary?: string } | undefined`

- [x] **Step 1: Write failing tests**

Add tests proving recent runs are ordered newest first and summarize `finish` / `stop` events.

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/store/event-store.test.ts`

Expected: FAIL because methods do not exist.

- [x] **Step 3: Implement methods**

Use existing `runs` and `events` tables. Derive status from latest stop event.

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/store/event-store.test.ts`

Expected: PASS.

### Task 3: Context Session Inheritance

**Files:**
- Modify: `src/core/context.ts`
- Modify: `src/core/loop.ts`
- Test: `tests/core/context.test.ts`
- Test: `tests/core/loop.test.ts`

**Interfaces:**
- `buildContext(input)` accepts `recentRuns?: string[]`.
- `runAgentLoop(input)` loads recent run summaries from `eventStore` before provider call.

- [x] **Step 1: Write failing tests**

Add context test that expects `# Recent runs` and prior summary text.
Add loop test where a second run sees the first run summary in provider context.

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/core/context.test.ts tests/core/loop.test.ts`

Expected: FAIL because recent runs are not included.

- [x] **Step 3: Implement context inheritance**

Format recent runs as compact lines: `<status>: <task> - <summary>`.

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/core/context.test.ts tests/core/loop.test.ts`

Expected: PASS.

### Task 4: WebUI Session Panels And File APIs

**Files:**
- Modify: `src/web/server.ts`
- Modify: `src/web/views.ts`
- Test: `tests/web/server.test.ts`

**Interfaces:**
- `GET /api/workspaces/:id/files`
- `GET /api/workspaces/:id/files/<relativePath>`
- Index page contains `code-viewer`, `memory-panel`, `recent-runs`.

- [x] **Step 1: Write failing tests**

Add tests for file list API, file content API, path traversal rejection, and index panels.

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/web/server.test.ts`

Expected: FAIL because APIs and panels do not exist.

- [x] **Step 3: Implement APIs and panels**

Expose only relative file paths and content. Render memory/recent run summaries for each workspace.

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/web/server.test.ts`

Expected: PASS.

### Task 5: Docs And Verification

**Files:**
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `docs/FINAL_DELIVERY_CHECKLIST.md`
- Modify: `AGENT_LOG.md`

- [x] **Step 1: Update docs**

Document Workspace Session V1, code viewer, memory panel, recent runs, and next route: Diff Inspector V1.

- [x] **Step 2: Run verification**

Run:

```bash
npm test
npm run build
```

Expected: all tests and build pass.
