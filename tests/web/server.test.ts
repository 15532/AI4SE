import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultServer, createServer } from "../../src/web/server";
import type { LLMProvider } from "../../src/core/providers";
import { EventStore } from "../../src/store/event-store";
import { MemoryStore } from "../../src/store/memory-store";

const workspaces = [
  { id: "demo-ts", name: "Demo TS", root: process.cwd(), allowedCommands: ["npm test"] },
  { id: "docs", name: "Docs", root: "C:\\registered-docs", allowedCommands: ["npm run build"] }
];

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
    expect(index.body).toContain('name="provider" value="web-mock"');
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
    expect(response.headers.location).toMatch(/^\/runs\/[0-9a-f-]+$/);
    const id = response.headers.location.slice("/runs/".length);
    const run = await app.inject({ method: "GET", url: `/api/runs/${id}` });
    expect(run.json()).toEqual(expect.objectContaining({ workspaceId: "demo-ts" }));
    expect(run.body).not.toContain("attacker");

    const page = await app.inject({ method: "GET", url: `/runs/${id}` });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("运行时间线");
    expect(page.body).toContain("finish");
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

  it("renders a workspace selection form", async () => {
    const app = createServer({ workspaces });
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("demo-ts");
    expect(response.body).toContain("docs");
    expect(response.body).toContain("<form");
    expect(response.body).not.toContain("registered-docs");
  });
});
