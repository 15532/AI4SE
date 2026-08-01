# 简单模型前端 V1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 WebUI 从最小表单增强为可演示 harness 机制的简单模型前端。

**Architecture:** 继续使用现有 Node HTTP server 与 `src/web/views.ts` 服务端 HTML 渲染，不引入前端框架或复杂 IDE 组件。页面只展示 workspace、allowed commands、provider、task 输入和 run timeline 的关键机制分区。

**Tech Stack:** TypeScript、Node.js HTTP server、Vitest、现有 SQLite event timeline。

## Global Constraints

- 当前阶段只使用 mock provider，不接真实 LLM API。
- 当前阶段只做功能性前端，不使用 Open Design；Open Design 和 IDE 化体验放到核心功能稳定后的增强阶段。
- WebUI 只能选择预注册 workspace id，不能接收或展示任意服务器 root。
- WebUI 必须沿用 CLI 相同的 guardrail、allowlist、feedback 和 event store。
- 不自动提交；提交前必须先向用户确认。

---

### Task 1: 首页工作区控制台

**Files:**
- Modify: `src/web/views.ts`
- Test: `tests/web/server.test.ts`

**Interfaces:**
- Consumes: `renderIndex(workspaces: PublicWorkspace[], providerId?: string): string`
- Produces: 首页展示 workspace id、workspace name、allowed commands、provider hidden input 和 task form。

- [ ] **Step 1: Write the failing test**

```ts
it("renders a simple harness console with workspace command boundaries", async () => {
  const app = createServer({ workspaces });
  const response = await app.inject({ method: "GET", url: "/" });

  expect(response.statusCode).toBe(200);
  expect(response.body).toContain("简单模型前端");
  expect(response.body).toContain("可用命令");
  expect(response.body).toContain("npm test");
  expect(response.body).toContain("npm run build");
  expect(response.body).toContain('name="provider" value="mock"');
  expect(response.body).not.toContain("registered-docs");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/web/server.test.ts`

Expected: FAIL because current index does not render simple frontend copy or allowed command cards.

- [ ] **Step 3: Write minimal implementation**

Update `renderIndex` to render:
- title `简单模型前端`
- workspace cards listing `allowedCommands`
- the existing POST form
- no workspace root

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/web/server.test.ts`

Expected: PASS.

### Task 2: Timeline 机制分区展示

**Files:**
- Modify: `src/web/views.ts`
- Test: `tests/web/server.test.ts`

**Interfaces:**
- Consumes: `renderRun(input): string`
- Produces: run 详情页按 event kind 展示 `Action`、`Guardrail`、`Tool Result`、`Feedback`、`Stop Reason` 标签。

- [ ] **Step 1: Write the failing test**

```ts
it("renders timeline events as harness mechanism sections", async () => {
  const app = createServer({
    workspaces,
    providerFactory: () => ({
      async complete() {
        return JSON.stringify({ type: "run_command", command: "git push", reason: "publish" });
      }
    })
  });

  const created = await app.inject({
    method: "POST",
    url: "/api/runs",
    payload: { workspaceId: "demo-ts", provider: "mock", task: "try publish" }
  });
  const { id } = created.json() as { id: string };
  const page = await app.inject({ method: "GET", url: `/runs/${id}` });

  expect(page.body).toContain("动作 Action");
  expect(page.body).toContain("护栏 Guardrail");
  expect(page.body).toContain("反馈 Feedback");
  expect(page.body).toContain("停止 Stop Reason");
  expect(page.body).toContain("command.publish_or_deploy");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/web/server.test.ts`

Expected: FAIL because current timeline page only renders raw event kind headings.

- [ ] **Step 3: Write minimal implementation**

Add a small event label helper in `src/web/views.ts` and use it in `renderRun`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/web/server.test.ts`

Expected: PASS.

### Task 3: 文档边界更新

**Files:**
- Modify: `SPEC.md`
- Modify: `PLAN.md`
- Modify: `README.md`

**Interfaces:**
- Produces: 文档明确当前 WebUI 是功能性最小前端，Open Design 和 IDE 化界面为后续增强。

- [ ] **Step 1: Update docs**

Add the current-stage boundary:
- v1 WebUI is a simple model frontend for harness demonstration.
- It is not a VS Code replacement.
- Open Design will be adopted after core function completion.

- [ ] **Step 2: Run verification**

Run:
- `npm test`
- `npm run build`

Expected: all tests and build pass.
