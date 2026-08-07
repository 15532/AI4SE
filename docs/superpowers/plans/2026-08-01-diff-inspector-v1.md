# Diff Inspector V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 WebUI 能查看 workspace 中的 git 文件变更和单文件 unified diff。

**Architecture:** 新增独立 runtime 模块封装 git status/diff。Web server 只调用 runtime 并返回 JSON，视图层只渲染 diff 入口和变更摘要。所有路径都保持 workspace 相对路径，并复用 workspace boundary 校验。

**Tech Stack:** TypeScript、Node.js、Vitest、Git、server-rendered HTML/CSS。

## Global Constraints

- 不引入前端框架。
- 不新增写文件、回滚、accept/reject API。
- 不暴露 workspace root 或绝对路径。
- 单个 diff 预览上限为 200 KiB。
- 提交前运行 `npm test` 和 `npm run build`。

---

### Task 1: Diff Inspector Runtime

**Files:**
- Create: `src/runtime/diff-inspector.ts`
- Test: `tests/runtime/diff-inspector.test.ts`

**Interfaces:**
- `listWorkspaceChanges(workspace: WorkspaceConfig): Promise<{ ok: true; changes: WorkspaceChange[] } | { ok: false; error: string }>`
- `readWorkspaceDiff(workspace: WorkspaceConfig, relativePath: string, options?: { maxBytes?: number }): Promise<{ ok: true; path: string; diff: string } | { ok: false; error: string }>`

- [x] **Step 1: Write failing tests**

Create tests that initialize a temporary git repo, modify a tracked file, add an untracked file, reject traversal, and reject non-git workspaces.

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/runtime/diff-inspector.test.ts`

Expected: FAIL because `diff-inspector.ts` does not exist.

- [x] **Step 3: Implement runtime**

Use `git -C <root> status --porcelain=v1` for changes and `git -C <root> diff -- <path>` for tracked file diffs. Generate a small virtual diff for untracked text files.

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/runtime/diff-inspector.test.ts`

Expected: PASS.

### Task 2: Web API And Run View

**Files:**
- Modify: `src/web/server.ts`
- Modify: `src/web/views.ts`
- Test: `tests/web/server.test.ts`

**Interfaces:**
- `GET /api/workspaces/:id/changes`
- `GET /api/workspaces/:id/changes/<relativePath>`
- `renderRun(input)` accepts optional `changes`.

- [x] **Step 1: Write failing tests**

Add tests for change list API, single file diff API, traversal rejection, and run page `diff-inspector` section.

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/web/server.test.ts`

Expected: FAIL because APIs and view are missing.

- [x] **Step 3: Implement API and view**

Wire the runtime into `createServer()`. For run pages, load changes for the run workspace and pass them to `renderRun()`.

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/web/server.test.ts`

Expected: PASS.

### Task 3: Docs And Verification

**Files:**
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `docs/FINAL_DELIVERY_CHECKLIST.md`
- Modify: `AGENT_LOG.md`

- [x] **Step 1: Update docs**

Document Diff Inspector V1 API, UI entry, limits, and next route: Interactive Run V1.

- [x] **Step 2: Run verification**

Run:

```bash
npm test
npm run build
```

Expected: all tests and build pass.
