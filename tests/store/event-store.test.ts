import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EventStore } from "../../src/store/event-store";

describe("EventStore", () => {
  it("creates runs and returns their events in increasing sequence order", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-events-"));
    const store = new EventStore(join(dir, "test.sqlite"));
    const runId = store.createRun({ task: "inspect", workspaceId: "demo", mode: "default" });

    store.appendEvent(runId, "first", { order: 1 });
    store.appendEvent(runId, "second", { order: 2 });

    expect(runId).toEqual(expect.any(String));
    expect(store.listEvents(runId)).toEqual([
      { sequence: 1, kind: "first", payload: { order: 1 } },
      { sequence: 2, kind: "second", payload: { order: 2 } }
    ]);
  });

  it("redacts secret-like payload fields before persistence", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-events-"));
    const store = new EventStore(join(dir, "test.sqlite"));
    const runId = store.createRun({ task: "inspect", workspaceId: "demo", mode: "default" });

    store.appendEvent(runId, "provider", {
      nested: { apiKey: "sk-secret-value", token: "token-value" },
      secretValue: "do-not-store",
      publicValue: "safe"
    });

    const eventsJson = JSON.stringify(store.listEvents(runId));
    expect(eventsJson).not.toContain("sk-secret-value");
    expect(eventsJson).not.toContain("token-value");
    expect(eventsJson).not.toContain("do-not-store");
    expect(eventsJson).toContain("[REDACTED]");
    expect(eventsJson).toContain("safe");
  });

  it("redacts secret-shaped payload values under benign keys", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-events-"));
    const store = new EventStore(join(dir, "test.sqlite"));
    const runId = store.createRun({ task: "inspect", workspaceId: "demo", mode: "default" });

    store.appendEvent(runId, "provider", { note: "sk-real-key" });

    expect(store.listEvents(runId)).toEqual([
      { sequence: 1, kind: "provider", payload: { note: "[REDACTED]" } }
    ]);
  });

  it("redacts secret assignments in run tasks before persistence", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-events-"));
    const store = new EventStore(join(dir, "test.sqlite"));
    const runId = store.createRun({
      task: "debug password=plain-secret api_key=also-secret credential=third-secret",
      workspaceId: "demo",
      mode: "default"
    });

    const runJson = JSON.stringify(store.getRun(runId));
    expect(runJson).not.toContain("plain-secret");
    expect(runJson).not.toContain("also-secret");
    expect(runJson).not.toContain("third-secret");
    expect(runJson).toContain("[REDACTED]");
  });

  it("redacts JSON-shaped secret assignments in run tasks", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-events-"));
    const store = new EventStore(join(dir, "test.sqlite"));
    const runId = store.createRun({
      task: 'debug {"password":"json-secret","api_key":"second-secret"}',
      workspaceId: "demo",
      mode: "default"
    });

    const runJson = JSON.stringify(store.getRun(runId));
    expect(runJson).not.toContain("json-secret");
    expect(runJson).not.toContain("second-secret");
  });

  it("redacts password api_key and credential event fields", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-events-"));
    const store = new EventStore(join(dir, "test.sqlite"));
    const runId = store.createRun({ task: "inspect", workspaceId: "demo", mode: "default" });

    store.appendEvent(runId, "provider", {
      password: "plain-secret",
      api_key: "also-secret",
      credential: "third-secret"
    });

    const eventsJson = JSON.stringify(store.listEvents(runId));
    expect(eventsJson).not.toContain("plain-secret");
    expect(eventsJson).not.toContain("also-secret");
    expect(eventsJson).not.toContain("third-secret");
  });

  it("lists recent runs for a workspace newest first", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-events-"));
    const store = new EventStore(join(dir, "test.sqlite"));
    const first = store.createRun({ task: "first task", workspaceId: "demo", mode: "default" });
    const second = store.createRun({ task: "second task", workspaceId: "demo", mode: "default" });
    store.createRun({ task: "other workspace", workspaceId: "docs", mode: "default" });

    expect(store.listRecentRuns("demo", 5).map((run) => run.id)).toEqual([second, first]);
    expect(store.listRecentRuns("demo", 1)).toEqual([
      expect.objectContaining({ id: second, task: "second task", workspaceId: "demo" })
    ]);
  });

  it("summarizes run status and finish summary from stored events", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-events-"));
    const store = new EventStore(join(dir, "test.sqlite"));
    const runId = store.createRun({ task: "fix tests", workspaceId: "demo", mode: "default" });

    store.appendEvent(runId, "stop", { kind: "stop", reason: "finish", summary: "fixed and verified" });

    expect(store.summarizeRun(runId)).toEqual({
      id: runId,
      task: "fix tests",
      workspaceId: "demo",
      status: "finished",
      summary: "fixed and verified"
    });
  });

  it("creates persistent sessions without leaking secret-like titles", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-events-"));
    const dbPath = join(dir, "test.sqlite");
    const store = new EventStore(dbPath);

    const sessionId = store.createSession({
      workspaceId: "demo",
      provider: "deepseek",
      title: "debug api_key=secret-value"
    });
    const reopened = new EventStore(dbPath);

    expect(reopened.getSession(sessionId)).toEqual({
      id: sessionId,
      workspaceId: "demo",
      provider: "deepseek",
      title: "debug api_key=[REDACTED]",
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });
    expect(JSON.stringify(reopened.getSession(sessionId))).not.toContain("secret-value");
  });

  it("attaches runs to sessions and lists session runs newest first", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-events-"));
    const store = new EventStore(join(dir, "test.sqlite"));
    const sessionId = store.createSession({ workspaceId: "demo", provider: "mock", title: "Demo session" });
    const first = store.createRun({ task: "first", workspaceId: "demo", mode: "webui", sessionId });
    const second = store.createRun({ task: "second", workspaceId: "demo", mode: "webui", sessionId });
    store.createRun({ task: "outside", workspaceId: "demo", mode: "webui" });

    expect(store.listSessionRuns(sessionId, 5).map((run) => run.id)).toEqual([second, first]);
    expect(store.listSessionRuns(sessionId, 1)).toEqual([
      expect.objectContaining({ id: second, task: "second", workspaceId: "demo" })
    ]);
  });

  it("lists recent sessions newest first with optional workspace filtering", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-events-"));
    const store = new EventStore(join(dir, "test.sqlite"));
    const first = store.createSession({ workspaceId: "demo", provider: "mock", title: "First" });
    const second = store.createSession({ workspaceId: "demo", provider: "mock", title: "Second" });
    store.createSession({ workspaceId: "docs", provider: "mock", title: "Docs" });

    expect(store.listSessions({ workspaceId: "demo", limit: 5 }).map((session) => session.id)).toEqual([second, first]);
    expect(store.listSessions({ limit: 1 })).toHaveLength(1);
  });

  it("orders recent sessions by latest activity instead of creation time", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-events-"));
    const store = new EventStore(join(dir, "test.sqlite"));
    const first = store.createSession({ workspaceId: "demo", provider: "mock", title: "First" });
    const second = store.createSession({ workspaceId: "demo", provider: "mock", title: "Second" });
    (store as unknown as { db: { prepare(sql: string): { run(...args: unknown[]): unknown } } }).db
      .prepare("UPDATE sessions SET updated_at = ? WHERE id = ?")
      .run("2099-01-01 00:00:00", first);

    expect(store.listSessions({ workspaceId: "demo", limit: 1 }).map((session) => session.id)).toEqual([first]);
    expect(store.listSessions({ workspaceId: "demo", limit: 5 }).map((session) => session.id)).toEqual([first, second]);
  });

  it("creates and decides approval records without leaking secret-like action content", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-events-"));
    const store = new EventStore(join(dir, "test.sqlite"));
    const runId = store.createRun({ task: "publish", workspaceId: "demo", mode: "webui" });

    const approvalId = store.createApproval({
      runId,
      workspaceId: "demo",
      action: { type: "run_command", command: "git push", reason: "publish token=plain-secret" },
      ruleId: "command.publish_or_deploy",
      reason: "Publish and deploy commands require human approval"
    });

    expect(store.listPendingApprovals(runId)).toEqual([
      expect.objectContaining({
        id: approvalId,
        runId,
        workspaceId: "demo",
        status: "pending",
        ruleId: "command.publish_or_deploy",
        action: { type: "run_command", command: "git push", reason: "publish token=[REDACTED]" }
      })
    ]);
    expect(JSON.stringify(store.getApproval(approvalId))).not.toContain("plain-secret");

    expect(store.decideApproval(approvalId, "approved")).toEqual(expect.objectContaining({
      id: approvalId,
      status: "approved"
    }));
    expect(store.listPendingApprovals(runId)).toEqual([]);

    const rejectedId = store.createApproval({
      runId,
      workspaceId: "demo",
      action: { type: "run_command", command: "npm publish", reason: "publish" },
      ruleId: "command.publish_or_deploy",
      reason: "Publish and deploy commands require human approval"
    });
    expect(store.decideApproval(rejectedId, "rejected")).toEqual(expect.objectContaining({
      id: rejectedId,
      status: "rejected"
    }));
  });
});
