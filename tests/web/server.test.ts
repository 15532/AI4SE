import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createDefaultServer, createServer } from "../../src/web/server";
import type { LLMProvider } from "../../src/core/providers";
import { EventStore } from "../../src/store/event-store";
import { MemoryStore } from "../../src/store/memory-store";
import { HarnessRegistry } from "../../src/config/harness-config";

const execFileAsync = promisify(execFile);

const workspaces = [
  { id: "demo-ts", name: "Demo TS", root: process.cwd(), allowedCommands: ["npm test"] },
  { id: "docs", name: "Docs", root: "C:\\registered-docs", allowedCommands: ["npm run build"] }
];

async function git(root: string, args: string[]): Promise<void> {
  await execFileAsync("git", ["-C", root, ...args]);
}

async function createGitWebWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "harness-web-diff-"));
  await git(root, ["init"]);
  await git(root, ["config", "user.email", "test@example.com"]);
  await git(root, ["config", "user.name", "Harness Test"]);
  await writeFile(join(root, "README.md"), "hello\n", "utf8");
  await git(root, ["add", "README.md"]);
  await git(root, ["commit", "-m", "initial"]);
  return { id: "demo", name: "Demo", root, allowedCommands: [] };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function waitForRunStatus(
  app: ReturnType<typeof createServer>,
  runId: string,
  status: string
): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await app.inject({ method: "GET", url: `/api/runs/${runId}/timeline` });
    const payload = response.json() as Record<string, unknown>;
    if (payload.status === status) return payload;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for run ${runId} to reach ${status}`);
}

describe("web server", () => {
  it("loads the default WebUI registry from YAML without exposing workspace roots", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-config-"));
    const configPath = join(dir, "harness.yaml");
    const dbPath = join(dir, "data", "harness.sqlite");
    await writeFile(configPath, `
mode: web-review
maxIterations: 6
providers:
  - id: web-mock
    type: mock
workspaces:
  - id: configured-web
    name: Configured Web workspace
    root: ./private-root
    allowedCommands:
      - npm test
`, "utf8");
    const app = createDefaultServer({ configPath, dbPath });
    const response = await app.inject({ method: "GET", url: "/api/workspaces" });

    expect(response.json()).toEqual([{
      id: "configured-web",
      name: "Configured Web workspace",
      allowedCommands: ["npm test"]
    }]);
    expect(response.body).not.toContain("private-root");

    const index = await app.inject({ method: "GET", url: "/" });
    expect(index.body).toContain('<option value="web-mock">web-mock</option>');
    expect(index.body).not.toContain('name="provider" value="mock"');
  });

  it("rejects unregistered workspace ids", async () => {
    const app = createServer({ workspaces });
    const response = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "unknown", provider: "mock", task: "run tests" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Unknown workspace id" });
  });

  it("lists registered workspaces without their roots", async () => {
    const app = createServer({ workspaces });
    const response = await app.inject({ method: "GET", url: "/api/workspaces" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { id: "demo-ts", name: "Demo TS", allowedCommands: ["npm test"] },
      { id: "docs", name: "Docs", allowedCommands: ["npm run build"] }
    ]);
    expect(response.body).not.toContain("registered-docs");
  });

  it("runs the real agent loop for a registered workspace and returns its timeline", async () => {
    let completeCalls = 0;
    const provider: LLMProvider = {
      async complete() {
        completeCalls += 1;
        return JSON.stringify({ type: "finish", summary: "OPENAI_API_KEY=sk-web-secret" });
      }
    };
    const app = createServer({
      workspaces,
      providerFactory: (name) => {
        expect(name).toBe("mock");
        return provider;
      }
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: {
        workspaceId: "docs",
        provider: "mock",
        task: "finish safely",
        root: "C:\\attacker-controlled",
        allowedCommands: ["anything"]
      }
    });

    expect(created.statusCode).toBe(201);
    expect(completeCalls).toBe(1);
    expect(created.json()).toEqual({ id: expect.any(String) });

    const { id } = created.json() as { id: string };
    const run = await app.inject({ method: "GET", url: `/api/runs/${id}` });
    expect(run.statusCode).toBe(200);
    expect(run.json()).toEqual({
      id,
      workspaceId: "docs",
      status: "finished",
      timeline: expect.any(Array)
    });
    expect(run.body).not.toContain("sk-web-secret");
    expect(run.body).not.toContain("attacker-controlled");
  });

  it("accepts browser-style urlencoded form submissions", async () => {
    let completeCalls = 0;
    const app = createServer({
      workspaces,
      providerFactory: () => ({
        async complete() {
          completeCalls += 1;
          return JSON.stringify({ type: "finish", summary: "done" });
        }
      })
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/runs",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "workspaceId=demo-ts&provider=mock&task=run+tests&root=C%3A%5Cattacker&allowedCommands=anything"
    });

    expect(response.statusCode).toBe(303);
    expect(completeCalls).toBe(1);
    expect(response.headers.location).toMatch(/^\/\?sessionId=[0-9a-f-]+&runId=[0-9a-f-]+$/);
    const id = response.headers.location.split("&runId=")[1];
    const run = await app.inject({ method: "GET", url: `/api/runs/${id}` });
    expect(run.json()).toEqual(expect.objectContaining({ workspaceId: "demo-ts" }));
    expect(run.body).not.toContain("attacker");

    const page = await app.inject({ method: "GET", url: response.headers.location });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("chat-session-thread");
    expect(page.body).toContain("chat-run-result");
    expect(page.body).toContain("run tests");
    expect(page.body).toContain("done");
    expect(page.body).toContain(`/runs/${id}`);
    expect(page.body).toContain("finish");
  });

  it("continues browser chat submissions in one inline conversation thread", async () => {
    const responses = [
      JSON.stringify({ type: "finish", summary: "first done" }),
      JSON.stringify({ type: "finish", summary: "second done" })
    ];
    let responseIndex = 0;
    const app = createServer({
      workspaces,
      providerFactory: () => ({
        async complete() {
          const response = responses[responseIndex];
          responseIndex += 1;
          return response;
        }
      })
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/runs",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "workspaceId=demo-ts&provider=mock&task=first+task"
    });
    const firstLocation = first.headers.location;
    const sessionId = firstLocation.match(/sessionId=([^&]+)/)?.[1];

    expect(first.statusCode).toBe(303);
    expect(sessionId).toEqual(expect.any(String));
    expect(firstLocation).toMatch(/^\/\?sessionId=[0-9a-f-]+&runId=[0-9a-f-]+$/);

    const second = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/runs`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "task=second+task&workspaceId=docs&provider=deepseek"
    });

    expect(second.statusCode).toBe(303);
    expect(second.headers.location).toMatch(new RegExp(`^/\\?sessionId=${sessionId}&runId=[0-9a-f-]+$`));
    const page = await app.inject({ method: "GET", url: second.headers.location });

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("chat-session-thread");
    expect(page.body).toContain(`action="/api/sessions/${sessionId}/runs/start"`);
    expect(page.body).toContain("first task");
    expect(page.body).toContain("first done");
    expect(page.body).toContain("second task");
    expect(page.body).toContain("second done");
    expect(page.body).toContain("Session:");
  });

  it("starts browser chat runs asynchronously and exposes a pollable timeline", async () => {
    const release = deferred<string>();
    let providerStarted = false;
    const app = createServer({
      workspaces,
      providerFactory: () => ({
        async complete() {
          providerStarted = true;
          return release.promise;
        }
      })
    });

    const started = await app.inject({
      method: "POST",
      url: "/api/runs/start",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "workspaceId=demo-ts&provider=mock&task=live+task"
    });

    expect(started.statusCode).toBe(303);
    expect(started.headers.location).toMatch(/^\/\?sessionId=[0-9a-f-]+&runId=[0-9a-f-]+$/);
    expect(providerStarted).toBe(true);

    const runId = started.headers.location.split("&runId=")[1];
    const running = await app.inject({ method: "GET", url: `/api/runs/${runId}/timeline` });
    expect(running.statusCode).toBe(200);
    expect(running.json()).toEqual({
      id: runId,
      status: "running",
      approvals: [],
      timeline: [expect.objectContaining({
        sequence: 1,
        kind: "run_started",
        payload: expect.objectContaining({ kind: "run_started", task: "live task" })
      })]
    });

    release.resolve(JSON.stringify({ type: "finish", summary: "live done" }));
    const finished = await waitForRunStatus(app, runId, "finished");
    expect(finished).toEqual(expect.objectContaining({
      id: runId,
      status: "finished",
      timeline: expect.arrayContaining([
        expect.objectContaining({ kind: "llm_response" }),
        expect.objectContaining({
          kind: "stop",
          payload: expect.objectContaining({ reason: "finish", summary: "live done" })
        })
      ])
    }));
  });

  it("persists WebUI runs, events, and remember actions in SQLite", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-store-"));
    const dbPath = join(dir, "harness.sqlite");
    const responses = [
      JSON.stringify({ type: "remember", key: "test.command", value: "npm test", scope: "workspace", reason: "retain command" }),
      JSON.stringify({ type: "finish", summary: "done" })
    ];
    let responseIndex = 0;
    const app = createServer({
      workspaces,
      dbPath,
      providerFactory: () => ({
        async complete() {
          const response = responses[responseIndex];
          responseIndex += 1;
          return response;
        }
      })
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "demo-ts", provider: "mock", task: "remember test command" }
    });
    const { id } = created.json() as { id: string };
    const eventStore = new EventStore(dbPath);
    const memoryStore = new MemoryStore(dbPath);

    expect(eventStore.getRun(id)).toMatchObject({ workspaceId: "demo-ts", mode: "webui" });
    expect(eventStore.listEvents(id).length).toBeGreaterThan(0);
    expect(memoryStore.recall({ workspaceId: "demo-ts", scope: "workspace", limit: 5 })).toEqual([
      { key: "test.command", value: "npm test" }
    ]);
  });

  it("creates persistent interactive sessions without exposing workspace roots", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-session-"));
    const dbPath = join(dir, "harness.sqlite");
    const app = createServer({ workspaces, dbPath });

    const created = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { workspaceId: "demo-ts", provider: "mock", title: "debug password=session-secret" }
    });

    expect(created.statusCode).toBe(201);
    const { id } = created.json() as { id: string };
    const session = await app.inject({ method: "GET", url: `/api/sessions/${id}` });
    expect(session.statusCode).toBe(200);
    expect(session.json()).toEqual({
      id,
      workspaceId: "demo-ts",
      provider: "mock",
      title: "debug password=[REDACTED]",
      runs: []
    });
    expect(session.body).not.toContain("session-secret");
    expect(session.body).not.toContain(process.cwd());
  });

  it("continues an interactive session by creating real harness runs under the session workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-session-"));
    const dbPath = join(dir, "harness.sqlite");
    let providerName = "";
    const app = createServer({
      workspaces,
      dbPath,
      providerFactory: (name) => {
        providerName = name;
        return {
          async complete() {
            return JSON.stringify({ type: "finish", summary: "continued safely" });
          }
        };
      }
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { workspaceId: "docs", provider: "mock", title: "Docs session" }
    });
    const { id: sessionId } = created.json() as { id: string };

    const continued = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/runs`,
      payload: {
        task: "continue task",
        workspaceId: "demo-ts",
        provider: "deepseek",
        root: "C:\\attacker-controlled"
      }
    });

    expect(continued.statusCode).toBe(201);
    expect(providerName).toBe("mock");
    const { id: runId } = continued.json() as { id: string };
    const session = await app.inject({ method: "GET", url: `/api/sessions/${sessionId}` });
    expect(session.json()).toEqual({
      id: sessionId,
      workspaceId: "docs",
      provider: "mock",
      title: "Docs session",
      runs: [{
        id: runId,
        task: "continue task",
        workspaceId: "docs",
        status: "finished",
        summary: "continued safely"
      }]
    });
    expect(session.body).not.toContain("attacker-controlled");
  });

  it("accepts browser-style form submissions for interactive sessions", async () => {
    let completeCalls = 0;
    const app = createServer({
      workspaces,
      providerFactory: () => ({
        async complete() {
          completeCalls += 1;
          return JSON.stringify({ type: "finish", summary: "done" });
        }
      })
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/sessions",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "workspaceId=demo-ts&provider=mock&title=Interactive"
    });

    expect(created.statusCode).toBe(303);
    expect(created.headers.location).toMatch(/^\/sessions\/[0-9a-f-]+$/);
    const sessionId = created.headers.location.slice("/sessions/".length);
    const continued = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/runs`,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "task=follow+up&provider=deepseek&root=C%3A%5Cattacker"
    });

    expect(continued.statusCode).toBe(303);
    expect(continued.headers.location).toMatch(new RegExp(`^/\\?sessionId=${sessionId}&runId=[0-9a-f-]+$`));
    expect(completeCalls).toBe(1);
  });

  it("returns 404 for unknown interactive sessions", async () => {
    const app = createServer({ workspaces });

    const session = await app.inject({ method: "GET", url: "/api/sessions/missing" });
    const continued = await app.inject({
      method: "POST",
      url: "/api/sessions/missing/runs",
      payload: { task: "continue" }
    });

    expect(session.statusCode).toBe(404);
    expect(session.json()).toEqual({ error: "Unknown session id" });
    expect(continued.statusCode).toBe(404);
    expect(continued.json()).toEqual({ error: "Unknown session id" });
  });

  it("renders an interactive session page with continuation form and session context", async () => {
    const responses = [
      JSON.stringify({ type: "remember", key: "project.testCommand", value: "npm test", scope: "workspace", reason: "remember command" }),
      JSON.stringify({ type: "finish", summary: "session step done" })
    ];
    let responseIndex = 0;
    const app = createServer({
      workspaces,
      providerFactory: () => ({
        async complete() {
          const response = responses[responseIndex];
          responseIndex += 1;
          return response;
        }
      })
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { workspaceId: "demo-ts", provider: "mock", title: "Interactive Demo" }
    });
    const { id: sessionId } = created.json() as { id: string };
    await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/runs`,
      payload: { task: "remember and finish" }
    });

    const page = await app.inject({ method: "GET", url: `/sessions/${sessionId}` });

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("interactive-session");
    expect(page.body).toContain(`action="/api/sessions/${sessionId}/runs"`);
    expect(page.body).toContain("session-run-list");
    expect(page.body).toContain("remember and finish");
    expect(page.body).toContain("session step done");
    expect(page.body).toContain("memory-panel");
    expect(page.body).toContain("project.testCommand");
    expect(page.body).toContain("diff-inspector");
    expect(page.body).not.toContain(process.cwd());
  });

  it("rejects non-mock providers", async () => {
    const app = createServer({ workspaces });
    const response = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "demo-ts", provider: "openai", task: "run tests" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Unsupported provider" });
  });

  it("returns 404 for unknown runs", async () => {
    const app = createServer({ workspaces });
    const response = await app.inject({ method: "GET", url: "/api/runs/missing" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Unknown run id" });
  });

  it("renders a chat-first workspace console", async () => {
    const app = createServer({ workspaces });
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("chat-app-shell");
    expect(response.body).toContain("chat-sidebar");
    expect(response.body).toContain("chat-thread");
    expect(response.body).toContain("chat-message");
    expect(response.body).toContain("chat-composer");
    expect(response.body).toContain("chat-inspector");
    expect(response.body).toContain("task-composer");
    expect(response.body).toContain('method="post" action="/api/runs/start"');
    expect(response.body).toContain('name="workspaceId"');
    expect(response.body).toContain('name="provider"');
    expect(response.body).toContain('name="task"');
    expect(response.body).toContain("demo-ts");
    expect(response.body).toContain("docs");
    expect(response.body).toContain("npm test");
    expect(response.body).toContain("npm run build");
    expect(response.body).toContain('<option value="mock">mock</option>');
    expect(response.body).not.toContain("registered-docs");
  });

  it("renders recent run links in the chat sidebar without leaving the conversation page", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-recent-runs-"));
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: [] }],
      providerFactory: () => ({
        async complete() {
          return JSON.stringify({ type: "finish", summary: "recent done" });
        }
      })
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "demo", provider: "mock", task: "recent task" }
    });
    const { id: runId } = created.json() as { id: string };
    const page = await app.inject({ method: "GET", url: "/" });

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("chat-recent-run-list");
    expect(page.body).toContain('data-nav-section="recent-runs"');
    expect(page.body).toContain(`href="/?workspaceId=demo&amp;runId=${runId}"`);
    expect(page.body).toContain('aria-label="打开最近对话 recent task"');
    expect(page.body).toContain("recent task");
    expect(page.body).toContain("finished");
    expect(page.body).not.toContain(dir);
  });

  it("renders recent interactive sessions as chat threads in the sidebar", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-recent-sessions-"));
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: [] }],
      providerFactory: () => ({
        async complete() {
          return JSON.stringify({ type: "finish", summary: "thread done" });
        }
      })
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/sessions",
      payload: { workspaceId: "demo", provider: "mock", title: "Fix sidebar thread" }
    });
    const { id: sessionId } = created.json() as { id: string };
    const run = await app.inject({
      method: "POST",
      url: `/api/sessions/${sessionId}/runs`,
      payload: { task: "continue thread" }
    });
    const { id: runId } = run.json() as { id: string };
    const page = await app.inject({ method: "GET", url: "/" });

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("chat-session-list");
    expect(page.body).toContain('data-nav-section="sessions"');
    expect(page.body).toContain(`href="/?workspaceId=demo&amp;sessionId=${sessionId}&amp;runId=${runId}"`);
    expect(page.body).toContain('aria-label="打开对话 Fix sidebar thread"');
    expect(page.body).toContain("Fix sidebar thread");
    expect(page.body).toContain("finished");
    expect(page.body).not.toContain(dir);
  });

  it("renders live polling hooks on the active chat run", async () => {
    const release = deferred<string>();
    const app = createServer({
      workspaces,
      providerFactory: () => ({
        async complete() {
          return release.promise;
        }
      })
    });

    const started = await app.inject({
      method: "POST",
      url: "/api/runs/start",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "workspaceId=demo-ts&provider=mock&task=watch+me"
    });
    const runId = started.headers.location.split("&runId=")[1];
    const page = await app.inject({ method: "GET", url: started.headers.location });

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("chat-live-indicator");
    expect(page.body).toContain(`data-live-run-id="${runId}"`);
    expect(page.body).toContain(`data-live-after="1"`);
    expect(page.body).toContain(`/api/runs/${runId}/timeline`);

    release.resolve(JSON.stringify({ type: "finish", summary: "watched" }));
    await waitForRunStatus(app, runId, "finished");
  });

  it("renders tool calls as readable cards inside the chat conversation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-tool-cards-"));
    await writeFile(join(dir, "README.md"), "# Demo\n\nReadable tool cards\n", "utf8");
    const responses = [
      JSON.stringify({ type: "list_files", path: ".", reason: "inspect files" }),
      JSON.stringify({ type: "read_file", path: "README.md", reason: "read docs" }),
      JSON.stringify({ type: "run_command", command: "node --version", reason: "verify runtime" }),
      JSON.stringify({ type: "finish", summary: "inspected and verified" })
    ];
    let responseIndex = 0;
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: ["node --version"] }],
      providerFactory: () => ({
        async complete() {
          const response = responses[responseIndex];
          responseIndex += 1;
          return response;
        }
      })
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "demo", provider: "mock", task: "inspect project" }
    });
    const { id: runId } = created.json() as { id: string };
    const page = await app.inject({ method: "GET", url: `/?runId=${runId}` });

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("chat-tool-call-list");
    expect(page.body).toContain("chat-tool-card");
    expect(page.body).toContain("工具调用");
    expect(page.body).toContain("列出文件");
    expect(page.body).toContain("读取文件");
    expect(page.body).toContain("运行命令");
    expect(page.body).toContain("README.md");
    expect(page.body).toContain("node --version");
    expect(page.body).toContain("Readable tool cards");
    expect(page.body).toContain("成功");
    expect(page.body).toContain("chat-event-summary-list");
    expect(page.body).toContain('data-event-kind="tool_result"');
    expect(page.body).toContain('data-event-kind="stop"');
    expect(page.body).toContain('<details class="chat-timeline-details">');
    expect(page.body).toContain('<ol class="chat-timeline-list">');
  });

  it("links file tool calls to the in-chat preview panel and guarded editor", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-tool-file-links-"));
    await writeFile(join(dir, "README.md"), "# Demo\n\nOriginal preview\n", "utf8");
    const responses = [
      JSON.stringify({ type: "read_file", path: "README.md", reason: "inspect readme" }),
      JSON.stringify({ type: "write_file", path: "README.md", content: "Updated from tool\n", reason: "update readme" }),
      JSON.stringify({ type: "finish", summary: "updated readme" })
    ];
    let responseIndex = 0;
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: [] }],
      providerFactory: () => ({
        async complete() {
          const response = responses[responseIndex];
          responseIndex += 1;
          return response;
        }
      })
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "demo", provider: "mock", task: "inspect and update readme" }
    });
    const { id: runId } = created.json() as { id: string };
    const page = await app.inject({ method: "GET", url: `/?runId=${runId}` });

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("chat-tool-actions");
    expect(page.body).toContain(`href="/?workspaceId=demo&amp;file=README.md&amp;runId=${runId}"`);
    expect(page.body).toContain('href="/workspaces/demo/files/README.md"');

    const preview = await app.inject({
      method: "GET",
      url: `/?workspaceId=demo&file=README.md&runId=${runId}`
    });

    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain("chat-run-result");
    expect(preview.body).toContain("chat-file-preview");
    expect(preview.body).toContain("inspect and update readme");
    expect(preview.body).toContain("Updated from tool");
    expect(preview.body).not.toContain(dir);
  });

  it("preserves session context when linking file tool calls to the chat preview", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-session-tool-file-links-"));
    await writeFile(join(dir, "README.md"), "# Demo\n\nSession preview\n", "utf8");
    const responses = [
      JSON.stringify({ type: "read_file", path: "README.md", reason: "read session file" }),
      JSON.stringify({ type: "finish", summary: "read session file" })
    ];
    let responseIndex = 0;
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: [] }],
      providerFactory: () => ({
        async complete() {
          const response = responses[responseIndex];
          responseIndex += 1;
          return response;
        }
      })
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "workspaceId=demo&provider=mock&task=session+file"
    });
    const location = created.headers.location;
    expect(location).toEqual(expect.any(String));
    const sessionId = location.match(/sessionId=([^&]+)/)?.[1];
    const runId = location.match(/runId=([^&]+)/)?.[1];
    expect(sessionId).toEqual(expect.any(String));
    expect(runId).toEqual(expect.any(String));

    const page = await app.inject({ method: "GET", url: location });

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("chat-session-thread");
    expect(page.body).toContain(
      `href="/?workspaceId=demo&amp;file=README.md&amp;runId=${runId}&amp;sessionId=${sessionId}"`
    );
  });

  it("renders workspace changes as reviewable cards inside the chat conversation", async () => {
    const workspace = await createGitWebWorkspace();
    const responses = [
      JSON.stringify({
        type: "write_file",
        path: "README.md",
        content: "hello changed\n",
        reason: "update docs"
      }),
      JSON.stringify({ type: "finish", summary: "updated docs" })
    ];
    let responseIndex = 0;
    const app = createServer({
      workspaces: [workspace],
      providerFactory: () => ({
        async complete() {
          const response = responses[responseIndex];
          responseIndex += 1;
          return response;
        }
      })
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "demo", provider: "mock", task: "update readme" }
    });
    const { id: runId } = created.json() as { id: string };
    const page = await app.inject({ method: "GET", url: `/?runId=${runId}` });

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("chat-change-panel");
    expect(page.body).toContain("chat-change-card");
    expect(page.body).toContain("文件变更");
    expect(page.body).toContain("modified");
    expect(page.body).toContain("README.md");
    expect(page.body).toContain("/?workspaceId=demo&amp;diff=README.md&amp;runId=");
    expect(page.body).toContain("/?workspaceId=demo&amp;file=README.md&amp;runId=");
  });

  it("renders pending approvals as actionable cards inside the chat conversation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-chat-approval-"));
    const dbPath = join(dir, "harness.sqlite");
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: ["git push"] }],
      dbPath,
      providerFactory: () => ({
        async complete() {
          return JSON.stringify({ type: "run_command", command: "git push", reason: "publish release" });
        }
      })
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "demo", provider: "mock", task: "publish" }
    });
    const { id: runId } = created.json() as { id: string };
    const approvalId = new EventStore(dbPath).listPendingApprovals(runId)[0]?.id;
    const page = await app.inject({ method: "GET", url: `/?runId=${runId}` });

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("chat-approval-list");
    expect(page.body).toContain("chat-approval-card");
    expect(page.body).toContain("chat-context-attachments");
    expect(page.body).toContain('data-attachment-kind="approval"');
    expect(page.body).toContain("1 个待审批");
    expect(page.body).toContain("等待审批");
    expect(page.body).toContain("git push");
    expect(page.body).toContain("publish release");
    expect(page.body).toContain("批准执行");
    expect(page.body).toContain("拒绝");
    expect(page.body).toContain(`/api/approvals/${approvalId}/approve`);
    expect(page.body).toContain(`/api/approvals/${approvalId}/reject`);
  });

  it("keeps file navigation inside the chat workspace with a preview panel", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-chat-files-"));
    await writeFile(join(dir, "README.md"), "# Demo\n\nChat preview\n", "utf8");
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: ["npm test"] }]
    });

    const index = await app.inject({ method: "GET", url: "/" });

    expect(index.statusCode).toBe(200);
    expect(index.body).toContain("chat-file-list");
    expect(index.body).toContain('href="/?workspaceId=demo&amp;file=README.md"');
    expect(index.body).toContain("README.md");
    expect(index.body).not.toContain("/workspaces/demo/files/README.md");
    expect(index.body).not.toContain(dir);

    const preview = await app.inject({ method: "GET", url: "/?workspaceId=demo&file=README.md" });

    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain("chat-file-preview");
    expect(preview.body).toContain("README.md");
    expect(preview.body).toContain("Chat preview");
    expect(preview.body).toContain("/workspaces/demo/files/README.md");
    expect(preview.body).not.toContain(dir);
  });

  it("renders the chat file preview as an inline code panel with line metadata and diff access", async () => {
    const workspace = await createGitWebWorkspace();
    await writeFile(join(workspace.root, "README.md"), "first line\nsecond line\n", "utf8");
    const app = createServer({ workspaces: [workspace] });

    const preview = await app.inject({ method: "GET", url: "/?workspaceId=demo&file=README.md" });

    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain("chat-code-preview");
    expect(preview.body).toContain("chat-context-attachments");
    expect(preview.body).toContain('data-attachment-kind="file"');
    expect(preview.body).toContain("README.md");
    expect(preview.body).toContain("2 行");
    expect(preview.body).toContain("/?workspaceId=demo&amp;diff=README.md");
    expect(preview.body).toContain('data-lines="2"');
    expect(preview.body).toContain('data-change-status="modified"');
    expect(preview.body).toContain('<span class="chat-code-line-number">1</span>');
    expect(preview.body).toContain('<span class="chat-code-line-number">2</span>');
    expect(preview.body).toContain("first line");
    expect(preview.body).toContain("second line");
    expect(preview.body).toContain("/?workspaceId=demo&amp;diff=README.md");
    expect(preview.body).not.toContain(workspace.root);
  });

  it("renders a readable diff review panel inside the chat inspector", async () => {
    const workspace = await createGitWebWorkspace();
    await writeFile(join(workspace.root, "README.md"), "hello changed\nnew line\n", "utf8");
    const app = createServer({ workspaces: [workspace] });

    const page = await app.inject({ method: "GET", url: "/?workspaceId=demo&diff=README.md&runId=run-123" });

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("chat-diff-review");
    expect(page.body).toContain("chat-context-attachments");
    expect(page.body).toContain('data-attachment-kind="diff"');
    expect(page.body).toContain("README.md");
    expect(page.body).toContain("modified");
    expect(page.body).toContain('data-diff-path="README.md"');
    expect(page.body).toContain('data-diff-status="modified"');
    expect(page.body).toContain("diff --git a/README.md b/README.md");
    expect(page.body).toContain('<span class="chat-diff-line-number">1</span>');
    expect(page.body).toContain('<span class="chat-diff-line deletion">-hello</span>');
    expect(page.body).toContain('<span class="chat-diff-line addition">+hello changed</span>');
    expect(page.body).toContain('<span class="chat-diff-line addition">+new line</span>');
    expect(page.body).toContain("/?workspaceId=demo&amp;file=README.md&amp;runId=run-123");
    expect(page.body).not.toContain(workspace.root);
  });

  it("renders an inline guarded editor inside the chat file preview panel", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-chat-inline-editor-"));
    await writeFile(join(dir, "README.md"), "editable from chat\n", "utf8");
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: [] }]
    });

    const preview = await app.inject({ method: "GET", url: "/?workspaceId=demo&file=README.md&runId=run-123&sessionId=session-456" });

    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain("chat-inline-editor");
    expect(preview.body).toContain('method="post" action="/api/workspaces/demo/files/README.md"');
    expect(preview.body).toContain('name="content"');
    expect(preview.body).toContain('name="returnTo"');
    expect(preview.body).toContain(encodeURIComponent("/?workspaceId=demo&file=README.md&sessionId=session-456&runId=run-123"));
    expect(preview.body).toContain("editable from chat");
    expect(preview.body).not.toContain(dir);
  });

  it("saves inline chat edits and redirects back to the same chat preview", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-chat-inline-save-"));
    await writeFile(join(dir, "README.md"), "old chat text\n", "utf8");
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: [] }]
    });
    const returnTo = "/?workspaceId=demo&file=README.md&runId=run-123";

    const saved = await app.inject({
      method: "POST",
      url: "/api/workspaces/demo/files/README.md",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `content=${encodeURIComponent("new chat text\n")}&returnTo=${encodeURIComponent(returnTo)}`
    });

    expect(saved.statusCode).toBe(303);
    expect(saved.headers.location).toBe(`${returnTo}&saved=1`);
    await expect(readFile(join(dir, "README.md"), "utf8")).resolves.toBe("new chat text\n");

    const blockedRedirect = await app.inject({
      method: "POST",
      url: "/api/workspaces/demo/files/README.md",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `content=${encodeURIComponent("still safe\n")}&returnTo=${encodeURIComponent("https://example.com/phish")}`
    });

    expect(blockedRedirect.statusCode).toBe(303);
    expect(blockedRedirect.headers.location).toBe("/workspaces/demo/files/README.md?saved=1");
  });

  it("shows an inline saved state after chat file edits return to the conversation", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-chat-saved-state-"));
    await writeFile(join(dir, "README.md"), "saved from chat\n", "utf8");
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: [] }]
    });

    const preview = await app.inject({ method: "GET", url: "/?workspaceId=demo&file=README.md&saved=1" });

    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain("chat-save-status");
    expect(preview.body).toContain("已保存");
    expect(preview.body).toContain("saved from chat");
    expect(preview.body).not.toContain(dir);
  });

  it("uses panel-level scrolling instead of global page scrolling in the chat workspace", async () => {
    const app = createServer({ workspaces });
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('<body class="chat-body">');
    expect(response.body).toContain(".chat-body { height: 100vh; overflow: hidden;");
    expect(response.body).toContain(".chat-app-shell { width: 100%; max-width: none; height: 100vh;");
    expect(response.body).toContain(".chat-sidebar { min-height: 0; overflow: hidden;");
    expect(response.body).toContain(".chat-nav { display: grid; gap: 6px; min-height: 0; overflow: auto;");
    expect(response.body).toContain(".chat-main { min-width: 0; min-height: 0; overflow: hidden;");
    expect(response.body).toContain(".chat-thread { min-height: 0; overflow: auto;");
    expect(response.body).toContain(".chat-inspector { min-height: 0; overflow: auto;");
  });

  it("keeps the chat file panel concise for demonstrations", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-chat-showcase-"));
    await mkdir(join(dir, ".superpowers", "sdd"), { recursive: true });
    await mkdir(join(dir, "data"), { recursive: true });
    await mkdir(join(dir, "docs", "superpowers", "plans"), { recursive: true });
    await mkdir(join(dir, "src"), { recursive: true });
    await mkdir(join(dir, "tests"), { recursive: true });
    await writeFile(join(dir, "README.md"), "# Demo\n", "utf8");
    await writeFile(join(dir, "package.json"), "{}\n", "utf8");
    await writeFile(join(dir, "src", "index.ts"), "export {};\n", "utf8");
    await writeFile(join(dir, "tests", "index.test.ts"), "test('ok', () => {});\n", "utf8");
    await writeFile(join(dir, ".superpowers", "sdd", "task.md"), "noise\n", "utf8");
    await writeFile(join(dir, "data", "harness.sqlite"), "noise\n", "utf8");
    await writeFile(join(dir, "docs", "superpowers", "plans", "plan.md"), "noise\n", "utf8");
    for (let index = 1; index <= 40; index += 1) {
      await writeFile(join(dir, `extra-${String(index).padStart(2, "0")}.md`), "extra\n", "utf8");
    }
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: [] }]
    });

    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("chat-file-list");
    expect(response.body).toContain("README.md");
    expect(response.body).toContain("package.json");
    expect(response.body).toContain("src/index.ts");
    expect(response.body).toContain("tests/index.test.ts");
    expect(response.body).not.toContain(".superpowers/sdd/task.md");
    expect(response.body).not.toContain("data/harness.sqlite");
    expect(response.body).not.toContain("docs/superpowers/plans/plan.md");
    expect(response.body).not.toContain("extra-40.md");
  });

  it("lists files for a registered workspace without exposing its root", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-files-"));
    await writeFile(join(dir, "README.md"), "# Demo\n", "utf8");
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: [] }]
    });

    const response = await app.inject({ method: "GET", url: "/api/workspaces/demo/files" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ path: "README.md", kind: "file" }]);
    expect(response.body).not.toContain(dir);
  });

  it("reads a file for a registered workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-files-"));
    await writeFile(join(dir, "README.md"), "# Demo\n", "utf8");
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: [] }]
    });

    const response = await app.inject({ method: "GET", url: "/api/workspaces/demo/files/README.md" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ path: "README.md", content: "# Demo\n" });
  });

  it("renders a workspace file browser without exposing roots", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-editor-"));
    await writeFile(join(dir, "README.md"), "# Demo\n", "utf8");
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: ["npm test"] }]
    });

    const response = await app.inject({ method: "GET", url: "/workspaces/demo/files" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("codex-app-shell");
    expect(response.body).toContain("codex-app-bar");
    expect(response.body).toContain("codex-sidebar");
    expect(response.body).toContain("codex-editor-main");
    expect(response.body).toContain("codex-agent-panel");
    expect(response.body).toContain("workspace-file-browser");
    expect(response.body).toContain("README.md");
    expect(response.body).toContain("/workspaces/demo/files/README.md");
    expect(response.body).not.toContain(dir);
  });

  it("renders a workspace file editor with integrated IDE styling", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-editor-"));
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(join(dir, "src", "index.ts"), "export const answer = 42;\n", "utf8");
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: ["npm test"] }]
    });

    const response = await app.inject({ method: "GET", url: "/workspaces/demo/files/src%2Findex.ts" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("codex-app-shell");
    expect(response.body).toContain("codex-app-bar");
    expect(response.body).toContain("codex-sidebar");
    expect(response.body).toContain("codex-editor-main");
    expect(response.body).toContain("codex-agent-panel");
    expect(response.body).toContain("codex-editor-tab");
    expect(response.body).toContain("workspace-editor");
    expect(response.body).toContain("workspace-editor-shell");
    expect(response.body).toContain('name="content"');
    expect(response.body).toContain("export const answer = 42;");
    expect(response.body).toContain("保存");
    expect(response.body).not.toContain(dir);
  });

  it("saves edited workspace files through the WebUI guardrails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-editor-"));
    await mkdir(join(dir, "src"), { recursive: true });
    await writeFile(join(dir, "src", "index.ts"), "old\n", "utf8");
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: ["npm test"] }]
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/workspaces/demo/files/src%2Findex.ts",
      payload: { content: "new\n", root: "C:\\attacker" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ path: "src/index.ts", saved: true });
    await expect(readFile(join(dir, "src", "index.ts"), "utf8")).resolves.toBe("new\n");
    expect(response.body).not.toContain("attacker");
  });

  it("rejects unsafe workspace file saves", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-editor-"));
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: [] }]
    });

    const escaped = await app.inject({
      method: "POST",
      url: "/api/workspaces/demo/files/..%2Foutside.ts",
      payload: { content: "x" }
    });
    const secret = await app.inject({
      method: "POST",
      url: "/api/workspaces/demo/files/src%2Fconfig.ts",
      payload: { content: "api_key=plain-secret" }
    });

    expect(escaped.statusCode).toBe(400);
    expect(escaped.json()).toEqual({ error: "Path escapes workspace root", ruleId: "path.escape_workspace" });
    expect(secret.statusCode).toBe(400);
    expect(secret.json()).toEqual({ error: "Sensitive files cannot be written", ruleId: "write.sensitive_file" });
    expect(secret.body).not.toContain("plain-secret");
  });

  it("rejects file preview paths that escape the workspace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-files-"));
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: [] }]
    });

    const response = await app.inject({ method: "GET", url: "/api/workspaces/demo/files/..%2Foutside.txt" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Path escapes workspace root" });
  });

  it("lists git changes for a registered workspace", async () => {
    const workspace = await createGitWebWorkspace();
    await writeFile(join(workspace.root, "README.md"), "hello changed\n", "utf8");
    const app = createServer({ workspaces: [workspace] });

    const response = await app.inject({ method: "GET", url: "/api/workspaces/demo/changes" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ path: "README.md", status: "modified" }]);
    expect(response.body).not.toContain(workspace.root);
  });

  it("reads a git diff for a registered workspace", async () => {
    const workspace = await createGitWebWorkspace();
    await writeFile(join(workspace.root, "README.md"), "hello changed\n", "utf8");
    const app = createServer({ workspaces: [workspace] });

    const response = await app.inject({ method: "GET", url: "/api/workspaces/demo/changes/README.md" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      path: "README.md",
      diff: expect.stringContaining("+hello changed")
    });
    expect(response.body).not.toContain(workspace.root);
  });

  it("rejects diff paths that escape a registered workspace", async () => {
    const workspace = await createGitWebWorkspace();
    const app = createServer({ workspaces: [workspace] });

    const response = await app.inject({ method: "GET", url: "/api/workspaces/demo/changes/..%2Foutside.txt" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Path escapes workspace root" });
  });

  it("renders all configured providers as selectable options", async () => {
    const app = createServer({
      registry: new HarnessRegistry({
        mode: "webui",
        maxIterations: 3,
        workspaces,
        providers: [
          { id: "mock", type: "mock" as const },
          {
            id: "deepseek",
            type: "deepseek-compatible" as const,
            baseUrl: "https://api.deepseek.com",
            model: "deepseek-v4-flash",
            apiKeyEnv: "DEEPSEEK_API_KEY",
            thinking: "disabled"
          }
        ]
      })
    });

    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.body).toContain('name="provider"');
    expect(response.body).toContain('<option value="mock">mock</option>');
    expect(response.body).toContain('<option value="deepseek">deepseek</option>');
  });

  it("returns a structured error when DeepSeek API key is missing", async () => {
    const app = createServer({
      registry: new HarnessRegistry({
        mode: "webui",
        maxIterations: 3,
        workspaces,
        providers: [{
          id: "deepseek",
          type: "deepseek-compatible",
          baseUrl: "https://api.deepseek.com",
          model: "deepseek-v4-flash",
          apiKeyEnv: "HARNESS_TEST_MISSING_DEEPSEEK_KEY",
          thinking: "disabled"
        }]
      })
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "demo-ts", provider: "deepseek", task: "finish" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Missing API key for provider deepseek" });
    expect(response.body).not.toContain("HARNESS_TEST_MISSING_DEEPSEEK_KEY");
  });

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

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("Run Inspector");
    expect(page.body).toContain("timeline-navigator");
    expect(page.body).toContain("event-detail-stack");
    expect(page.body).toContain("diff-inspector");
    expect(page.body).toContain("动作 Action");
    expect(page.body).toContain("护栏 Guardrail");
    expect(page.body).toContain("反馈 Feedback");
    expect(page.body).toContain("停止 Stop Reason");
    expect(page.body).toContain("command.not_allowlisted");
  });

  it("renders pending approvals and executes approved actions through the WebUI", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-approval-"));
    const dbPath = join(dir, "harness.sqlite");
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: ["git push"] }],
      dbPath,
      providerFactory: () => ({
        async complete() {
          return JSON.stringify({ type: "run_command", command: "git push", reason: "publish" });
        }
      })
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "demo", provider: "mock", task: "publish" }
    });
    const { id: runId } = created.json() as { id: string };
    const page = await app.inject({ method: "GET", url: `/?runId=${runId}` });
    const approvalId = new EventStore(dbPath).listPendingApprovals(runId)[0]?.id;

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("chat-run-result");
    expect(page.body).toContain("approval-panel");
    expect(page.body).toContain("chat-approval-panel");
    expect(page.body).toContain("command.publish_or_deploy");
    expect(approvalId).toEqual(expect.any(String));

    const approved = await app.inject({
      method: "POST",
      url: `/api/approvals/${approvalId}/approve`
    });

    expect(approved.statusCode).toBe(303);
    expect(approved.headers.location).toBe(`/?runId=${runId}`);
    expect((await app.inject({ method: "GET", url: `/api/runs/${runId}` })).json()).toEqual(expect.objectContaining({
      status: "approval_executed"
    }));
    const events = new EventStore(dbPath).listEvents(runId);
    expect(events).toContainEqual(expect.objectContaining({
      kind: "approval_decision",
      payload: expect.objectContaining({ decision: "approved", approvalId })
    }));
    expect(events).toContainEqual(expect.objectContaining({
      kind: "tool_result",
      payload: expect.objectContaining({
        action: { type: "run_command", command: "git push", reason: "publish" }
      })
    }));
  });

  it("records rejected approvals without executing the pending action", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-approval-"));
    const dbPath = join(dir, "harness.sqlite");
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: ["git push"] }],
      dbPath,
      providerFactory: () => ({
        async complete() {
          return JSON.stringify({ type: "run_command", command: "git push", reason: "publish" });
        }
      })
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "demo", provider: "mock", task: "publish" }
    });
    const { id: runId } = created.json() as { id: string };
    const approvalId = new EventStore(dbPath).listPendingApprovals(runId)[0]?.id;

    const rejected = await app.inject({
      method: "POST",
      url: `/api/approvals/${approvalId}/reject`
    });

    expect(rejected.statusCode).toBe(303);
    expect(rejected.headers.location).toBe(`/?runId=${runId}`);
    expect((await app.inject({ method: "GET", url: `/api/runs/${runId}` })).json()).toEqual(expect.objectContaining({
      status: "approval_rejected"
    }));
    const events = new EventStore(dbPath).listEvents(runId);
    expect(events).toContainEqual(expect.objectContaining({
      kind: "approval_decision",
      payload: expect.objectContaining({ decision: "rejected", approvalId })
    }));
    expect(events.filter((event) => event.kind === "tool_result")).toEqual([]);
  });
});
