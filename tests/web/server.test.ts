import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
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
    expect(response.body).toContain("智能 IDE 工作台");
    expect(response.body).toContain("workspace-rail");
    expect(response.body).toContain("task-composer");
    expect(response.body).toContain("run-inspector");
    expect(response.body).toContain("code-viewer");
    expect(response.body).toContain("memory-panel");
    expect(response.body).toContain("recent-runs");
    expect(response.body).toContain("可用命令");
    expect(response.body).toContain("demo-ts");
    expect(response.body).toContain("docs");
    expect(response.body).toContain("npm test");
    expect(response.body).toContain("npm run build");
    expect(response.body).toContain('name="provider"');
    expect(response.body).toContain('<option value="mock">mock</option>');
    expect(response.body).toContain("<form");
    expect(response.body).not.toContain("registered-docs");
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
    expect(page.body).toContain("command.publish_or_deploy");
  });
});
