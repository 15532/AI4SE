import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../../src/store/memory-store";

describe("MemoryStore", () => {
  it("stores and recalls workspace-scoped memory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-memory-"));
    const store = new MemoryStore(join(dir, "test.sqlite"));

    store.remember({
      workspaceId: "demo",
      scope: "workspace",
      key: "project.testCommand",
      value: "npm test"
    });

    expect(store.recall({ workspaceId: "demo", scope: "workspace", limit: 5 })).toEqual([
      { key: "project.testCommand", value: "npm test" }
    ]);
  });

  it("updates an existing memory deterministically", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-memory-"));
    const store = new MemoryStore(join(dir, "test.sqlite"));

    store.remember({ workspaceId: "demo", scope: "global", key: "style", value: "concise" });
    store.remember({ workspaceId: "demo", scope: "global", key: "style", value: "detailed" });

    expect(store.recall({ workspaceId: "demo", scope: "global", limit: 5 })).toEqual([
      { key: "style", value: "detailed" }
    ]);
  });

  it("redacts secret-like memory keys before persistence", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-memory-"));
    const store = new MemoryStore(join(dir, "test.sqlite"));

    store.remember({ workspaceId: "demo", scope: "workspace", key: "apiKey", value: "sk-memory-secret" });

    expect(store.recall({ workspaceId: "demo", scope: "workspace", limit: 5 })).toEqual([
      { key: "apiKey", value: "[REDACTED]" }
    ]);
  });

  it("redacts secret-shaped memory values under benign keys", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-memory-"));
    const store = new MemoryStore(join(dir, "test.sqlite"));

    store.remember({ workspaceId: "demo", scope: "workspace", key: "note", value: "sk-real-key" });

    expect(store.recall({ workspaceId: "demo", scope: "workspace", limit: 5 })).toEqual([
      { key: "note", value: "[REDACTED]" }
    ]);
  });

  it.each(["password", "api_key", "credential"])("redacts values stored under the %s key", async (key) => {
    const dir = await mkdtemp(join(tmpdir(), "harness-memory-"));
    const store = new MemoryStore(join(dir, "test.sqlite"));

    store.remember({ workspaceId: "demo", scope: "workspace", key, value: `${key}-plain-secret` });

    expect(store.recall({ workspaceId: "demo", scope: "workspace", limit: 5 })).toEqual([
      { key, value: "[REDACTED]" }
    ]);
  });

  it("redacts secret assignments embedded in memory keys and values", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-memory-"));
    const store = new MemoryStore(join(dir, "test.sqlite"));

    store.remember({
      workspaceId: "demo",
      scope: "workspace",
      key: "note password=key-secret",
      value: "credential=value-secret"
    });

    const memoriesJson = JSON.stringify(store.recall({ workspaceId: "demo", scope: "workspace", limit: 5 }));
    expect(memoriesJson).not.toContain("key-secret");
    expect(memoriesJson).not.toContain("value-secret");
    expect(memoriesJson).toContain("[REDACTED]");
  });
});
