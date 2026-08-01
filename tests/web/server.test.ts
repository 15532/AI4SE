import { describe, expect, it } from "vitest";
import { createServer } from "../../src/web/server";
import type { LLMProvider } from "../../src/core/providers";

const workspaces = [
  { id: "demo-ts", name: "Demo TS", root: process.cwd(), allowedCommands: ["npm test"] },
  { id: "docs", name: "Docs", root: "C:\\registered-docs", allowedCommands: ["npm run build"] }
];

describe("web server", () => {
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

    expect(response.statusCode).toBe(201);
    expect(completeCalls).toBe(1);
    const { id } = response.json() as { id: string };
    const run = await app.inject({ method: "GET", url: `/api/runs/${id}` });
    expect(run.json()).toEqual(expect.objectContaining({ workspaceId: "demo-ts" }));
    expect(run.body).not.toContain("attacker");
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
