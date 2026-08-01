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
});
