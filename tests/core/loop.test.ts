import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runAgentLoop } from "../../src/core/loop";
import { MockLLMProvider, type LLMProvider } from "../../src/core/providers";
import { EventStore } from "../../src/store/event-store";

describe("runAgentLoop", () => {
  it("stops when mock LLM returns finish", async () => {
    const provider = new MockLLMProvider([
      JSON.stringify({ type: "finish", summary: "done" })
    ]);
    const result = await runAgentLoop({
      task: "finish",
      workspace: { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: [] },
      provider,
      maxIterations: 3
    });
    expect(result.status).toBe("finished");
  });

  it("redacts secret-like finish summaries from returned events", async () => {
    const provider = new MockLLMProvider([
      JSON.stringify({ type: "finish", summary: "OPENAI_API_KEY=sk-finish123" })
    ]);
    const result = await runAgentLoop({
      task: "finish safely",
      workspace: { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: [] },
      provider,
      maxIterations: 1
    });

    const eventsJson = JSON.stringify(result.events);
    expect(eventsJson).not.toContain("sk-finish123");
    expect(eventsJson).toContain("[REDACTED]");
  });

  it("stops at max_iterations", async () => {
    const provider = new MockLLMProvider([
      JSON.stringify({ type: "list_files", path: ".", reason: "inspect" }),
      JSON.stringify({ type: "list_files", path: ".", reason: "inspect again" })
    ]);
    const result = await runAgentLoop({
      task: "loop",
      workspace: { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: [] },
      provider,
      maxIterations: 1
    });
    expect(result.status).toBe("max_iterations");
  });

  it("redacts secret-like provider responses from returned events", async () => {
    const provider = new MockLLMProvider(["OPENAI_API_KEY=sk-test123"]);
    const result = await runAgentLoop({
      task: "handle provider output",
      workspace: { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: [] },
      provider,
      maxIterations: 1
    });

    expect(JSON.stringify(result.events)).not.toContain("sk-test123");
    expect(JSON.stringify(result.events)).not.toContain("OPENAI_API_KEY=sk-test123");
  });

  it("includes successful tool output in the next provider context", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-loop-"));
    await writeFile(join(root, "note.txt"), "useful tool output", "utf8");
    const inputs: Array<{ task: string; context: string }> = [];
    const responses = [
      JSON.stringify({ type: "read_file", path: "note.txt", reason: "inspect note" }),
      JSON.stringify({ type: "finish", summary: "done" })
    ];
    const provider: LLMProvider = {
      async complete(input) {
        inputs.push(input);
        return responses[inputs.length - 1] ?? JSON.stringify({ type: "finish", summary: "done" });
      }
    };

    await runAgentLoop({
      task: "inspect note",
      workspace: { id: "demo", name: "Demo", root, allowedCommands: [] },
      provider,
      maxIterations: 2
    });

    expect(inputs).toHaveLength(2);
    expect(inputs[1].context).toContain("useful tool output");
  });

  it("includes recent run summaries from the same workspace in provider context", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-loop-store-"));
    const eventStore = new EventStore(join(dir, "harness.sqlite"));
    const workspace = { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: [] };

    await runAgentLoop({
      task: "first task",
      workspace,
      provider: new MockLLMProvider([JSON.stringify({ type: "finish", summary: "first summary" })]),
      maxIterations: 1,
      eventStore
    });

    const inputs: Array<{ task: string; context: string }> = [];
    await runAgentLoop({
      task: "second task",
      workspace,
      provider: {
        async complete(input) {
          inputs.push(input);
          return JSON.stringify({ type: "finish", summary: "second summary" });
        }
      },
      maxIterations: 1,
      eventStore
    });

    expect(inputs[0].context).toContain("Recent runs");
    expect(inputs[0].context).toContain("first task");
    expect(inputs[0].context).toContain("first summary");
  });

  it("blocks invalid JSON and records invalid_action feedback", async () => {
    const result = await runAgentLoop({
      task: "parse response",
      workspace: { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: [] },
      provider: new MockLLMProvider(["not json"]),
      maxIterations: 1
    });

    expect(result.status).toBe("blocked");
    expect(result.events).toContainEqual(expect.objectContaining({
      kind: "feedback",
      feedback: expect.objectContaining({ source: "invalid_action" })
    }));
  });

  it("feeds invalid actions back into the next iteration instead of stopping immediately", async () => {
    const inputs: Array<{ task: string; context: string }> = [];
    const provider: LLMProvider = {
      async complete(input) {
        inputs.push(input);
        return inputs.length === 1
          ? "not json"
          : JSON.stringify({ type: "finish", summary: "corrected" });
      }
    };

    const result = await runAgentLoop({
      task: "recover from invalid action",
      workspace: { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: [] },
      provider,
      maxIterations: 2
    });

    expect(result.status).toBe("finished");
    expect(inputs).toHaveLength(2);
    expect(inputs[1].context).toContain("invalid_action");
  });

  it("blocks guardrail-rejected actions and records the decision", async () => {
    const result = await runAgentLoop({
      task: "inspect outside workspace",
      workspace: { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: [] },
      provider: new MockLLMProvider([
        JSON.stringify({ type: "list_files", path: "../outside", reason: "inspect" })
      ]),
      maxIterations: 1
    });

    expect(result.status).toBe("blocked");
    expect(result.events).toContainEqual(expect.objectContaining({
      kind: "guardrail",
      decision: expect.objectContaining({ decision: "block" })
    }));
  });

  it("pauses for human approval when an allowlisted publish command is requested", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-loop-approval-"));
    const eventStore = new EventStore(join(dir, "harness.sqlite"));
    const result = await runAgentLoop({
      task: "publish",
      workspace: { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: ["git push"] },
      provider: new MockLLMProvider([
        JSON.stringify({ type: "run_command", command: "git push", reason: "publish" })
      ]),
      maxIterations: 3,
      eventStore
    });

    expect(result.status).toBe("pending_approval");
    expect(result.runId).toEqual(expect.any(String));
    expect(result.events).toContainEqual(expect.objectContaining({
      kind: "approval_required",
      approvalId: expect.any(String),
      decision: expect.objectContaining({ decision: "require_approval" })
    }));
    expect(result.events).toContainEqual(expect.objectContaining({
      kind: "stop",
      reason: "pending_approval"
    }));
    expect(eventStore.listPendingApprovals(result.runId ?? "")).toEqual([
      expect.objectContaining({
        workspaceId: "demo",
        status: "pending",
        action: { type: "run_command", command: "git push", reason: "publish" }
      })
    ]);
  });

  it("feeds guardrail blocks back into the next iteration instead of stopping immediately", async () => {
    const inputs: Array<{ task: string; context: string }> = [];
    const provider: LLMProvider = {
      async complete(input) {
        inputs.push(input);
        return inputs.length === 1
          ? JSON.stringify({ type: "run_command", command: "git push", reason: "publish" })
          : JSON.stringify({ type: "finish", summary: "used safer action" });
      }
    };

    const result = await runAgentLoop({
      task: "avoid unsafe publish",
      workspace: { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: [] },
      provider,
      maxIterations: 2
    });

    expect(result.status).toBe("finished");
    expect(inputs).toHaveLength(2);
    expect(inputs[1].context).toContain("safety_blocked");
  });

  it("does not dispatch finish actions", async () => {
    const result = await runAgentLoop({
      task: "finish immediately",
      workspace: { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: [] },
      provider: new MockLLMProvider([JSON.stringify({ type: "finish", summary: "done" })]),
      maxIterations: 1
    });

    expect(result.events.filter((event) => event.kind === "guardrail" || event.kind === "tool_result")).toEqual([]);
  });
});
