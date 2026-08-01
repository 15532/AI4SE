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
});
