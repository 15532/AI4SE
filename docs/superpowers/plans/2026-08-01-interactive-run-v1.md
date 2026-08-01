# Interactive Run V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 WebUI 支持持久化 workspace session，并能在同一 session 下连续触发真实 harness run。

**Architecture:** 在 SQLite schema 和 `EventStore` 中新增 session 与 session-run 关联。Web server 通过普通 HTTP API 创建 session、读取 session、追加 run；视图层新增 session 页面。核心 `runAgentLoop()` 继续执行真实工具链路，只增加可选 `sessionId` 用于持久化关联与上下文选择。

**Tech Stack:** TypeScript、Node.js HTTP server、better-sqlite3、Vitest、server-rendered HTML/CSS。

## Global Constraints

- Session 必须持久化到 SQLite，不能依赖进程内 Map。
- 不引入 WebSocket、后台队列或前端框架。
- WebUI API 只能使用预注册 workspace id 和 provider id。
- 不暴露 workspace root、绝对路径或 secret-like 内容。
- 提交前运行 `npm test` 和 `npm run build`。

---

### Task 1: Session Store

**Files:**
- Modify: `src/store/schema.ts`
- Modify: `src/store/event-store.ts`
- Modify: `tests/store/event-store.test.ts`

**Interfaces:**
- `createSession(input: { workspaceId: string; provider: string; title?: string }): string`
- `getSession(sessionId: string): StoredSession | undefined`
- `listSessions(input?: { workspaceId?: string; limit?: number }): StoredSession[]`
- `listSessionRuns(sessionId: string, limit: number): RecentRun[]`
- `createRun(input: { task: string; workspaceId: string; mode: string; sessionId?: string }): string`

- [x] **Step 1: Write failing tests**

Add tests proving sessions persist, session titles are redacted, runs attach to sessions, and session runs are newest first.

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/store/event-store.test.ts`

Expected: FAIL because session APIs do not exist.

- [x] **Step 3: Implement store**

Add `sessions` and `session_runs` tables. Update `createRun()` so optional `sessionId` inserts into `session_runs` and updates `sessions.updated_at`.

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/store/event-store.test.ts`

Expected: PASS.

### Task 2: Web Session API

**Files:**
- Modify: `src/web/server.ts`
- Modify: `tests/web/server.test.ts`

**Interfaces:**
- `POST /api/sessions`
- `GET /api/sessions/:id`
- `POST /api/sessions/:id/runs`

- [x] **Step 1: Write failing tests**

Add tests for creating a session, continuing a session run, retrieving session run summaries, browser form redirect, and unknown session rejection.

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/web/server.test.ts`

Expected: FAIL because session APIs do not exist.

- [x] **Step 3: Implement server API**

Validate session workspace/provider against registry. Use session provider/workspace for continuation; do not accept replacement root/provider from request body.

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/web/server.test.ts`

Expected: PASS.

### Task 3: Session Page

**Files:**
- Modify: `src/web/views.ts`
- Modify: `src/web/server.ts`
- Modify: `tests/web/server.test.ts`

**Interfaces:**
- `renderSession(input)`
- `GET /sessions/:id`

- [x] **Step 1: Write failing tests**

Add tests that session pages contain `interactive-session`, a continue form, run summaries, memory panel and diff inspector.

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- tests/web/server.test.ts`

Expected: FAIL because session page does not exist.

- [x] **Step 3: Implement page**

Render session metadata, continuation form, run summary list, memory list and diff summary. Keep all paths relative and redacted.

- [x] **Step 4: Run tests to verify pass**

Run: `npm test -- tests/web/server.test.ts`

Expected: PASS.

### Task 4: Docs And Verification

**Files:**
- Modify: `README.md`
- Modify: `SPEC.md`
- Modify: `docs/FINAL_DELIVERY_CHECKLIST.md`
- Modify: `AGENT_LOG.md`

- [x] **Step 1: Update docs**

Document Interactive Run V1, server deployment implications, and next route: Approval V1.

- [x] **Step 2: Run verification**

Run:

```bash
npm test
npm run build
```

Expected: all tests and build pass.
