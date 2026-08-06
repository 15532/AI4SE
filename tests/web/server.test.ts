import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createDefaultServer, createServer, isDirectEntrypoint } from "../../src/web/server";
import type { LLMProvider } from "../../src/core/providers";
import { EventStore } from "../../src/store/event-store";
import { MemoryStore } from "../../src/store/memory-store";
import { HarnessRegistry } from "../../src/config/harness-config";
import { EncryptedFileKeychainAdapter } from "../../src/credentials/keychain-adapter";

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
  status: string,
  attempts = 30,
  delayMs = 10
): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await app.inject({ method: "GET", url: `/api/runs/${runId}/timeline` });
    const payload = response.json() as Record<string, unknown>;
    if (payload.status === status) return payload;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Timed out waiting for run ${runId} to reach ${status}`);
}

describe("web server", () => {
  it("recognizes standalone startup through a symlinked release path", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-web-entrypoint-"));
    const releaseDir = join(root, "releases", "one", "dist", "src", "web");
    await mkdir(releaseDir, { recursive: true });
    const realServerPath = join(releaseDir, "server.js");
    await writeFile(realServerPath, "console.log('server');\n", "utf8");
    await symlink(join(root, "releases", "one"), join(root, "current"), "junction");

    expect(
      isDirectEntrypoint(pathToFileURL(realServerPath).href, join(root, "current", "dist", "src", "web", "server.js"))
    ).toBe(true);
  });

  it("requires Basic Auth for WebUI pages when admin password is configured", async () => {
    const app = createServer({
      workspaces,
      webAuth: { username: "admin", password: "server-password" }
    });

    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(401);
    expect(response.headers["www-authenticate"]).toBe('Basic realm="AI4SE WebUI", charset="UTF-8"');
    expect(response.body).toContain("需要认证");
    expect(response.body).not.toContain("server-password");
  });

  it("rejects invalid Basic Auth credentials without leaking the configured password", async () => {
    const app = createServer({
      workspaces,
      webAuth: { username: "admin", password: "server-password" }
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/workspaces",
      headers: {
        authorization: `Basic ${Buffer.from("admin:wrong-password").toString("base64")}`
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).not.toContain("server-password");
    expect(response.body).not.toContain("wrong-password");
  });

  it("allows WebUI pages and APIs with valid Basic Auth credentials", async () => {
    const app = createServer({
      workspaces,
      webAuth: { username: "admin", password: "server-password" }
    });
    const headers = {
      authorization: `Basic ${Buffer.from("admin:server-password").toString("base64")}`
    };

    const page = await app.inject({ method: "GET", url: "/", headers });
    const api = await app.inject({ method: "GET", url: "/api/workspaces", headers });

    expect(page.statusCode).toBe(200);
    expect(api.statusCode).toBe(200);
    expect(api.json()).toEqual([
      { id: "demo-ts", name: "Demo TS", allowedCommands: ["npm test"] },
      { id: "docs", name: "Docs", allowedCommands: ["npm run build"] }
    ]);
    expect(page.body).not.toContain("server-password");
    expect(api.body).not.toContain("server-password");
  });

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
    expect(index.body).toContain('<option value="web-mock" selected>web-mock</option>');
    expect(index.body).not.toContain('<option value="mock">mock</option>');
    expect(index.body).toContain("mock-demo-form");
    expect(index.body).toContain('name="provider" value="mock"');
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

  it("serves the WebUI from a configured base path", async () => {
    const app = createServer({
      workspaces,
      basePath: "/ai4se",
      providerFactory: () => ({
        async complete() {
          return JSON.stringify({ type: "finish", summary: "done" });
        }
      })
    });

    const page = await app.inject({ method: "GET", url: "/ai4se/?workspaceId=demo-ts" });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('href="/ai4se/?workspaceId=demo-ts"');
    expect(page.body).toContain('action="/ai4se/api/runs/start"');
    expect(page.body).toContain('href="/ai4se/workspaces/demo-ts/files"');

    const submitted = await app.inject({
      method: "POST",
      url: "/ai4se/api/runs",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "workspaceId=demo-ts&provider=mock&task=run+tests"
    });

    expect(submitted.statusCode).toBe(303);
    expect(submitted.headers.location).toMatch(/^\/ai4se\/\?sessionId=[0-9a-f-]+&runId=[0-9a-f-]+$/);
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
      summary: "OPENAI_API_KEY=[REDACTED]",
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
    expect(page.body).toContain('class="chat-message chat-message-user"');
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
    expect(page.body).toContain("会话：");
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
    expect(response.body).toContain('data-sidebar-collapsed="false"');
    expect(response.body).toContain('data-inspector-closed="false"');
    expect(response.body).toContain("chat-sidebar");
    expect(response.body).toContain("chat-thread");
    expect(response.body).toContain("chat-message");
    expect(response.body).toContain(".chat-message-user");
    expect(response.body).toContain("justify-self: end");
    expect(response.body).toContain("grid-template-columns: minmax(0, 640px) 34px");
    expect(response.body).toContain("border-radius: 16px");
    expect(response.body).toContain(".chat-message-user .chat-bubble");
    expect(response.body).toContain("justify-self: end");
    expect(response.body).toContain("text-align: right");
    expect(response.body).toContain("background: #eef2ff");
    expect(response.body).toContain(".chat-bubble.chat-run-result");
    expect(response.body).toContain("background: transparent");
    expect(response.body).toContain("chat-composer");
    expect(response.body).toContain("chat-inspector");
    expect(response.body).toContain("task-composer");
    expect(response.body).toContain("mock-demo-form");
    expect(response.body).toContain('aria-label="运行 mock 机制演示"');
    expect(response.body).toContain('name="provider" value="mock"');
    expect(response.body).toContain("mock 机制演示");
    expect(response.body).toContain("护栏拦截、失败反馈和修正动作");
    expect(response.body).toContain('data-panel-toggle="sidebar"');
    expect(response.body).toContain('data-panel-toggle="inspector"');
    expect(response.body).toContain('data-close-icon="&lt;&lt;"');
    expect(response.body).toContain('data-open-icon="&gt;&gt;"');
    expect(response.body).toContain('data-close-icon="&gt;&gt;"');
    expect(response.body).toContain('data-open-icon="&lt;&lt;"');
    expect(response.body).toContain('aria-label="收起侧栏"');
    expect(response.body).toContain('aria-label="收起检查器"');
    expect(response.body).not.toContain("chat-panel-openers");
    expect(response.body).not.toContain("chat-panel-opener");
    expect(response.body).toContain('method="post" action="/api/runs/start"');
    expect(response.body).toContain('name="workspaceId"');
    expect(response.body).toContain('name="provider"');
    expect(response.body).toContain('name="task"');
    expect(response.body).toContain("demo-ts");
    expect(response.body).toContain("docs");
    expect(response.body).toContain("npm test");
    expect(response.body).toContain("npm run build");
    expect(response.body).toContain('<option value="deepseek" selected>deepseek</option>');
    expect(response.body).not.toContain('<option value="mock">mock</option>');
    expect(response.body).not.toContain("registered-docs");
  });

  it("runs the mock mechanism demo and persists the guardrail/feedback/correction timeline", async () => {
    const app = createServer({ workspaces });

    const response = await app.inject({
      method: "POST",
      url: "/api/runs/start",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "workspaceId=demo-ts&provider=mock&task=mock+%E6%9C%BA%E5%88%B6%E6%BC%94%E7%A4%BA%EF%BC%9A%E5%B1%95%E7%A4%BA%E6%8A%A4%E6%A0%8F%E6%8B%A6%E6%88%AA%E3%80%81%E5%A4%B1%E8%B4%A5%E5%8F%8D%E9%A6%88%E5%92%8C%E4%BF%AE%E6%AD%A3%E5%8A%A8%E4%BD%9C"
    });

    expect(response.statusCode).toBe(303);
    const location = new URL(response.headers.location, "http://localhost");
    const runId = location.searchParams.get("runId");
    expect(runId).toBeTruthy();

    const finished = await waitForRunStatus(app, runId!, "finished", 300, 50);
    const events = (finished.timeline as Array<{ kind: string; payload: Record<string, unknown> }>);
    const guardrailBlocked = events.some((event) =>
      event.kind === "guardrail"
      && (event.payload.decision as { decision?: string } | undefined)?.decision === "block"
    );
    expect(guardrailBlocked).toBe(true);

    const testFailureIndex = events.findIndex((event) =>
      event.kind === "feedback"
      && (event.payload.feedback as { source?: string } | undefined)?.source === "test_failed"
    );
    expect(testFailureIndex).toBeGreaterThan(-1);

    const correctionIndex = events.findIndex((event) =>
      event.kind === "tool_result"
      && (event.payload.action as { type?: string } | undefined)?.type === "write_file"
    );
    expect(correctionIndex).toBeGreaterThan(testFailureIndex);

    const stop = [...events].reverse().find((event) => event.kind === "stop");
    expect(stop?.payload.reason).toBe("finish");
    expect(String(stop?.payload.summary)).toContain("write_file");
    expect(String(stop?.payload.summary)).toContain("护栏");
  });

  it("clears history and resets the workspace to its template", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-cleanup-"));
    const templateRoot = join(dir, "templates");
    const workspaceRoot = join(dir, "workspace");
    await mkdir(join(templateRoot, "demo", "src"), { recursive: true });
    await writeFile(join(templateRoot, "demo", "README.md"), "# Template\n", "utf8");
    await writeFile(join(templateRoot, "demo", "src", "main.js"), "// template\n", "utf8");
    await mkdir(join(workspaceRoot, "src"), { recursive: true });
    await writeFile(join(workspaceRoot, "README.md"), "# Dirty\n", "utf8");
    await writeFile(join(workspaceRoot, "junk.txt"), "leftover\n", "utf8");

    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: workspaceRoot, allowedCommands: [] }],
      dbPath: join(dir, "harness.sqlite"),
      workspaceTemplateRoot: templateRoot
    });

    const sessionResponse = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "demo", provider: "mock", task: "cleanup me" }
    });
    expect(sessionResponse.statusCode).toBe(201);

    const response = await app.inject({ method: "POST", url: "/api/cleanup" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ cleared: true, workspaces: [{ workspaceId: "demo", ok: true, action: "reset" }] });

    const files = await readdir(workspaceRoot, { recursive: true });
    expect(files.map((f) => String(f).split(String.fromCharCode(92)).join("/")).sort()).toEqual([
      "README.md",
      "src",
      "src/main.js"
    ]);
    expect(await readFile(join(workspaceRoot, "README.md"), "utf8")).toBe("# Template\n");

    const index = await app.inject({ method: "GET", url: "/" });
    expect(index.body).not.toContain("cleanup me");
  });

  it("skips resetting workspaces without a template directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-cleanup-missing-template-"));
    const workspaceRoot = join(dir, "workspace");
    await mkdir(workspaceRoot, { recursive: true });
    await writeFile(join(workspaceRoot, "keep.txt"), "keep\n", "utf8");

    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: workspaceRoot, allowedCommands: [] }],
      dbPath: join(dir, "harness.sqlite"),
      workspaceTemplateRoot: join(dir, "templates")
    });

    const response = await app.inject({ method: "POST", url: "/api/cleanup" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      cleared: true,
      workspaces: [{ workspaceId: "demo", ok: false, error: expect.stringContaining("Template directory does not exist") }]
    });
    expect(await readFile(join(workspaceRoot, "keep.txt"), "utf8")).toBe("keep\n");
  });

  it("renders the cleanup button in the sidebar tools", async () => {
    const app = createServer({ workspaces });
    const index = await app.inject({ method: "GET", url: "/" });
    expect(index.body).toContain('action="/api/cleanup"');
    expect(index.body).toContain("清除历史对话与工作区");
    expect(index.body).toContain("清空历史并重置工作区");
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
    expect(page.body).toContain('<details class="chat-tool-call-list"');
    expect(page.body).toContain("<summary>工具调用 (3)</summary>");
    expect(page.body).toContain("chat-tool-card");
    expect(page.body).toContain("工具调用");
    expect(page.body).toContain("列出文件");
    expect(page.body).toContain("读取文件");
    expect(page.body).toContain("运行命令");
    expect(page.body).toContain("README.md");
    expect(page.body).toContain("node --version");
    expect(page.body).toContain("列出 1 个条目");
    expect(page.body).toContain("已读取 README.md");
    expect(page.body).toContain("命令已完成");
    expect(page.body).toContain("查看原始输出");
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
    expect(page.body).toContain('<details class="chat-card chat-change-panel"');
    expect(page.body).toContain("<summary>文件变更 (1)</summary>");
    expect(page.body).toContain("chat-change-card");
    expect(page.body).toContain("文件变更");
    expect(page.body).toContain("chat-run-detail-note");
    expect(page.body).toContain("工具调用：1 次");
    expect(page.body).toContain("文件变更：1 个");
    expect(page.body).toContain("modified");
    expect(page.body).toContain("README.md");
    expect(page.body).toContain("/?workspaceId=demo&amp;diff=README.md&amp;runId=");
    expect(page.body).toContain("/?workspaceId=demo&amp;file=README.md&amp;runId=");
  });

  it("explains missing summaries when the model reaches max iterations without finish", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-chat-max-iterations-"));
    await writeFile(join(dir, "README.md"), "# Demo\n", "utf8");
    const app = createServer({
      workspaces: [{ id: "demo", name: "Demo", root: dir, allowedCommands: [] }],
      providerFactory: () => ({
        async complete() {
          return JSON.stringify({ type: "list_files", path: ".", reason: "inspect before editing" });
        }
      })
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "demo", provider: "mock", task: "loop forever" }
    });
    const { id: runId } = created.json() as { id: string };
    const page = await app.inject({ method: "GET", url: `/?runId=${runId}` });

    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("max_iterations");
    expect(page.body).toContain("模型已达到最大迭代次数，但没有返回 finish action");
    expect(page.body).toContain("工具调用");
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
    expect(index.body).toContain('<details class="chat-nav-section chat-file-section" open>');
    expect(index.body).toContain('<summary class="chat-nav-title"><span>文件</span><span class="chat-section-toggle" aria-hidden="true"></span></summary>');
    expect(index.body).toContain("chat-file-list");
    expect(index.body).toContain('href="/?workspaceId=demo&amp;file=README.md"');
    expect(index.body).toContain("README.md");
    expect(index.body).not.toContain("/workspaces/demo/files/README.md");
    expect(index.body).not.toContain(dir);

    const preview = await app.inject({ method: "GET", url: "/?workspaceId=demo&file=README.md" });

    expect(preview.statusCode).toBe(200);
    expect(preview.body).toContain("chat-file-preview");
    expect(preview.body).toContain("chat-preview-close");
    expect(preview.body).toContain("chat-inspector-section-header");
    expect(preview.body).toContain('href="/?workspaceId=demo" aria-label="关闭文件预览" title="关闭文件预览">x</a>');
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
    expect(page.body).toContain("chat-preview-close");
    expect(page.body).toContain('href="/?workspaceId=demo&amp;runId=run-123" aria-label="关闭 diff 预览" title="关闭 diff 预览">x</a>');
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
    expect(response.body).toContain(".chat-app-shell { --sidebar-width: 260px; --inspector-width:");
    expect(response.body).toContain("width: 100%; max-width: none; height: 100vh;");
    expect(response.body).toContain('.chat-app-shell[data-sidebar-collapsed="true"]');
    expect(response.body).toContain('.chat-app-shell[data-inspector-closed="true"]');
    expect(response.body).toContain(".chat-sidebar { min-height: 0; overflow: hidden;");
    expect(response.body).toContain('.chat-app-shell[data-inspector-closed="true"] { --inspector-width: 52px;');
    expect(response.body).toContain('.chat-app-shell[data-inspector-closed="true"] .chat-inspector-card { display: none;');
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

  it("hides mock from the WebUI provider selector while defaulting to DeepSeek", async () => {
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
    expect(response.body).not.toContain('<option value="mock">mock</option>');
    expect(response.body).toContain('<option value="deepseek" selected>deepseek</option>');
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

  it("uses encrypted credentials for WebUI DeepSeek runs before environment fallback", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-web-credentials-"));
    const storePath = join(dir, "credentials.enc.json");
    const adapter = new EncryptedFileKeychainAdapter({
      storePath,
      masterPassword: "web-master-password"
    });
    await adapter.set("coding-agent-harness", "deepseek", "stored-web-secret");

    const previousStore = process.env.HARNESS_CREDENTIAL_STORE_PATH;
    const previousMaster = process.env.HARNESS_MASTER_PASSWORD;
    const previousEnvKey = process.env.HARNESS_TEST_WEB_DEEPSEEK_KEY;
    const previousFetch = globalThis.fetch;
    const requests: RequestInit[] = [];
    process.env.HARNESS_CREDENTIAL_STORE_PATH = storePath;
    process.env.HARNESS_MASTER_PASSWORD = "web-master-password";
    process.env.HARNESS_TEST_WEB_DEEPSEEK_KEY = "env-web-secret";
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requests.push(init ?? {});
      return new Response(JSON.stringify({
        choices: [{ message: { content: "{\"type\":\"finish\",\"summary\":\"credential ok\"}" } }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    try {
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
            apiKeyEnv: "HARNESS_TEST_WEB_DEEPSEEK_KEY",
            thinking: "disabled"
          }]
        })
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/runs",
        payload: { workspaceId: "demo-ts", provider: "deepseek", task: "finish" }
      });

      expect(response.statusCode).toBe(201);
      expect(requests[0].headers).toEqual(expect.objectContaining({
        authorization: "Bearer stored-web-secret"
      }));
      expect(response.body).not.toContain("stored-web-secret");
      expect(response.body).not.toContain("env-web-secret");
    } finally {
      if (previousStore === undefined) delete process.env.HARNESS_CREDENTIAL_STORE_PATH;
      else process.env.HARNESS_CREDENTIAL_STORE_PATH = previousStore;
      if (previousMaster === undefined) delete process.env.HARNESS_MASTER_PASSWORD;
      else process.env.HARNESS_MASTER_PASSWORD = previousMaster;
      if (previousEnvKey === undefined) delete process.env.HARNESS_TEST_WEB_DEEPSEEK_KEY;
      else process.env.HARNESS_TEST_WEB_DEEPSEEK_KEY = previousEnvKey;
      globalThis.fetch = previousFetch;
    }
  });

  it("returns a Chinese summary when provider errors repeat during a WebUI run", async () => {
    const app = createServer({
      workspaces,
      providerFactory: () => ({
        async complete() {
          throw new Error("Provider deepseek request failed with status 503");
        }
      })
    });

    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { workspaceId: "demo-ts", provider: "deepseek", task: "call provider" }
    });

    expect(created.statusCode).toBe(201);
    const { id } = created.json() as { id: string };
    const run = await app.inject({ method: "GET", url: `/api/runs/${id}` });
    const timeline = await app.inject({ method: "GET", url: `/api/runs/${id}/timeline` });

    expect(run.json()).toEqual(expect.objectContaining({
      status: "blocked",
      summary: expect.stringContaining("模型服务")
    }));
    expect(timeline.body.match(/provider_error/g)?.length).toBe(4);
    expect(timeline.body).toContain("模型服务连续 3 次请求失败");
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
    expect(page.body).toContain("运行检查器");
    expect(page.body).toContain("timeline-navigator");
    expect(page.body).toContain("event-detail-stack");
    expect(page.body).toContain("diff-inspector");
    expect(page.body).toContain("动作");
    expect(page.body).toContain("护栏");
    expect(page.body).toContain("反馈");
    expect(page.body).toContain("停止原因");
    expect(page.body).not.toContain("Run Inspector");
    expect(page.body).not.toContain("Stop Reason");
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
