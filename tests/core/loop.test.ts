import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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

  it("adds final-iteration guidance before the model runs out of budget", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-loop-budget-"));
    await writeFile(join(root, "README.md"), "# Demo\n", "utf8");
    const inputs: Array<{ task: string; context: string }> = [];
    const provider: LLMProvider = {
      async complete(input) {
        inputs.push(input);
        return inputs.length === 1
          ? JSON.stringify({ type: "list_files", path: ".", reason: "inspect" })
          : JSON.stringify({ type: "finish", summary: "已完成检查，没有修改文件。" });
      }
    };

    await runAgentLoop({
      task: "inspect and finish",
      workspace: { id: "demo", name: "Demo", root, allowedCommands: [] },
      provider,
      maxIterations: 2
    });

    expect(inputs).toHaveLength(2);
    expect(inputs[0].context).toContain("剩余迭代次数：2");
    expect(inputs[1].context).toContain("这是最后一轮");
    expect(inputs[1].context).toContain("finish");
  });

  it("feeds repeated actions back into the next iteration", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-loop-repeat-"));
    await writeFile(join(root, "README.md"), "# Demo\n", "utf8");
    const inputs: Array<{ task: string; context: string }> = [];
    const repeatedAction = JSON.stringify({ type: "list_files", path: ".", reason: "inspect" });
    const provider: LLMProvider = {
      async complete(input) {
        inputs.push(input);
        return inputs.length <= 2
          ? repeatedAction
          : JSON.stringify({ type: "finish", summary: "已完成目录检查，未修改文件。" });
      }
    };

    const result = await runAgentLoop({
      task: "avoid repeating inspection",
      workspace: { id: "demo", name: "Demo", root, allowedCommands: [] },
      provider,
      maxIterations: 3
    });

    expect(result.status).toBe("finished");
    expect(inputs).toHaveLength(3);
    expect(inputs[2].context).toContain("duplicate_action");
    expect(inputs[2].context).toContain("不要连续重复同一个动作");
    expect(result.events.filter((event) => event.kind === "tool_result")).toHaveLength(1);
  });

  it("flags historical repeats even when another action happened in between", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-loop-historical-repeat-"));
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "index.js"), "export const a = 1;\n", "utf8");
    const inputs: Array<{ task: string; context: string }> = [];
    const provider: LLMProvider = {
      async complete(input) {
        inputs.push(input);
        if (inputs.length === 1) {
          return JSON.stringify({ type: "write_file", path: "src/index.js", content: "export const a = 2;\n", reason: "first write" });
        }
        if (inputs.length === 2) {
          return JSON.stringify({ type: "read_file", path: "package.json", reason: "inspect package" });
        }
        if (inputs.length === 3) {
          return JSON.stringify({ type: "write_file", path: "src/index.js", content: "export const a = 2;\n", reason: "repeat same content" });
        }
        return JSON.stringify({ type: "finish", summary: "done" });
      }
    };

    const result = await runAgentLoop({
      task: "avoid historical repeats",
      workspace: { id: "demo", name: "Demo", root, allowedCommands: ["npm test"] },
      provider,
      maxIterations: 4
    });

    expect(result.status).toBe("finished");
    expect(inputs).toHaveLength(4);
    expect(inputs[3].context).toContain("duplicate_action");
    expect(inputs[3].context).toContain("你之前已经执行过完全相同的动作");
    expect(result.events.filter((event) => event.kind === "tool_result" && (event.action as { type?: string })?.type === "write_file"))
      .toHaveLength(1);
  });

  it("rejects concatenated actions and lets the model retry in the next iteration", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-loop-multi-json-"));
    const inputs: Array<{ task: string; context: string }> = [];
    const provider: LLMProvider = {
      async complete(input) {
        inputs.push(input);
        if (inputs.length === 1) {
          return JSON.stringify({ type: "write_file", path: "a.txt", content: "x", reason: "write" })
            + JSON.stringify({ type: "run_command", command: "npm test", reason: "verify" });
        }
        return JSON.stringify({ type: "finish", summary: "completed after retry" });
      }
    };

    const result = await runAgentLoop({
      task: "reject concatenated actions",
      workspace: { id: "demo", name: "Demo", root, allowedCommands: [] },
      provider,
      maxIterations: 3
    });

    expect(result.status).toBe("finished");
    expect(inputs).toHaveLength(2);
    expect(inputs[1].context).toContain("一次只能返回一个 JSON action");
    expect(result.events).toContainEqual(expect.objectContaining({
      kind: "feedback",
      feedback: expect.objectContaining({
        source: "invalid_action",
        message: "一次只能返回一个 JSON action；不要把多个动作拼接在同一个响应里。请先完成当前动作，再在下一轮返回下一个动作。"
      })
    }));
  });

  it("rejects a finish that claims verification without running a verification command", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-loop-verify-claim-"));
    await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { build: "node --check src/index.js" } }), "utf8");
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "index.js"), "export const a = 1;\n", "utf8");
    const inputs: Array<{ task: string; context: string }> = [];
    const provider: LLMProvider = {
      async complete(input) {
        inputs.push(input);
        if (inputs.length === 1) {
          return JSON.stringify({ type: "write_file", path: "src/index.js", content: "export const a = 2;\n", reason: "update" });
        }
        if (inputs.length === 2) {
          return JSON.stringify({ type: "finish", summary: "已通过 npm run build 验证，测试通过。" });
        }
        if (inputs.length === 3) {
          return JSON.stringify({ type: "run_command", command: "npm run build", reason: "verify" });
        }
        return JSON.stringify({ type: "finish", summary: "已实际运行 npm run build 验证通过。" });
      }
    };

    const result = await runAgentLoop({
      task: "claim verification honestly",
      workspace: { id: "demo", name: "Demo", root, allowedCommands: ["npm run build"] },
      provider,
      maxIterations: 4
    });

    expect(result.status).toBe("finished");
    expect(inputs).toHaveLength(4);
    expect(inputs[2].context).toContain("verification_missing");
    expect(result.events.filter((event) => event.kind === "feedback" && (event.feedback as { source?: string })?.source === "verification_missing"))
      .toHaveLength(1);
    expect(result.events.filter((event) => event.kind === "tool_result" && (event.action as { type?: string })?.type === "run_command"))
      .toHaveLength(1);
  });

  it("does not reject an honest finish that reports failed or skipped verification", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-loop-honest-verify-"));
    await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { test: "node --test" } }), "utf8");
    const inputs: Array<{ task: string; context: string }> = [];
    const provider: LLMProvider = {
      async complete(input) {
        inputs.push(input);
        if (inputs.length === 1) {
          return JSON.stringify({ type: "run_command", command: "npm test", reason: "verify" });
        }
        return JSON.stringify({ type: "finish", summary: "npm test 运行失败，测试未通过；未运行 npm run build，因此不声明验证成功。" });
      }
    };

    const result = await runAgentLoop({
      task: "report verification honestly",
      workspace: { id: "demo", name: "Demo", root, allowedCommands: ["npm test"] },
      provider,
      maxIterations: 3
    });

    expect(result.status).toBe("finished");
    expect(inputs).toHaveLength(2);
    expect(result.events.filter((event) => event.kind === "feedback" && (event.feedback as { source?: string })?.source === "verification_missing"))
      .toHaveLength(0);
  });

  it("blocks rewriting the same file until a verification command has run", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-loop-write-guard-"));
    await writeFile(join(root, "package.json"), JSON.stringify({ scripts: { build: "node --check src/index.js" } }), "utf8");
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "index.js"), "export const a = 1;\n", "utf8");
    const inputs: Array<{ task: string; context: string }> = [];
    const provider: LLMProvider = {
      async complete(input) {
        inputs.push(input);
        if (inputs.length === 1) {
          return JSON.stringify({ type: "write_file", path: "src/index.js", content: "export const a = 2;\n", reason: "first write" });
        }
        if (inputs.length === 2) {
          return JSON.stringify({ type: "write_file", path: "src/index.js", content: "export const a = 3;\n", reason: "rewrite without verifying" });
        }
        if (inputs.length === 3) {
          return JSON.stringify({ type: "run_command", command: "npm run build", reason: "verify" });
        }
        if (inputs.length === 4) {
          return JSON.stringify({ type: "write_file", path: "src/index.js", content: "export const a = 4;\n", reason: "rewrite after verify" });
        }
        return JSON.stringify({ type: "finish", summary: "done" });
      }
    };

    const result = await runAgentLoop({
      task: "write-then-verify",
      workspace: { id: "demo", name: "Demo", root, allowedCommands: ["npm run build"] },
      provider,
      maxIterations: 5
    });

    expect(result.status).toBe("finished");
    expect(inputs).toHaveLength(5);
    expect(inputs[2].context).toContain("还没有运行任何验证命令");
    expect(result.events.filter((event) => event.kind === "feedback" && String((event.feedback as { message?: unknown })?.message).includes("还没有运行任何验证命令")))
      .toHaveLength(1);
    expect(result.events.filter((event) => event.kind === "tool_result" && (event.action as { type?: string })?.type === "write_file"))
      .toHaveLength(2);
    expect(await readFile(join(root, "src", "index.js"), "utf8")).toBe("export const a = 4;\n");
  });

  it("does not consume the effective iteration budget on repeated actions", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-loop-budget-repeat-"));
    const inputs: Array<{ task: string; context: string }> = [];
    const repeatedAction = JSON.stringify({ type: "list_files", path: ".", reason: "inspect" });
    const provider: LLMProvider = {
      async complete(input) {
        inputs.push(input);
        if (inputs.length <= 4) {
          return repeatedAction;
        }
        return JSON.stringify({ type: "finish", summary: "finished after repeated inspections" });
      }
    };

    const result = await runAgentLoop({
      task: "repeated inspections should not burn the budget",
      workspace: { id: "demo", name: "Demo", root, allowedCommands: [] },
      provider,
      maxIterations: 2
    });

    expect(result.status).toBe("finished");
    expect(inputs).toHaveLength(5);
    expect(result.events.filter((event) => event.kind === "tool_result")).toHaveLength(1);
    expect(result.events.filter((event) => event.kind === "feedback" && (event.feedback as { source?: string })?.source === "duplicate_action"))
      .toHaveLength(3);
  });

  it("allows re-reading a file after it was written", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-loop-read-after-write-"));
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "index.js"), "export const a = 1;\n", "utf8");
    const inputs: Array<{ task: string; context: string }> = [];
    const provider: LLMProvider = {
      async complete(input) {
        inputs.push(input);
        if (inputs.length === 1) {
          return JSON.stringify({ type: "write_file", path: "src/index.js", content: "export const a = 2;\n", reason: "update" });
        }
        if (inputs.length === 2) {
          return JSON.stringify({ type: "read_file", path: "src/index.js", reason: "verify after write" });
        }
        return JSON.stringify({ type: "finish", summary: "done" });
      }
    };

    const result = await runAgentLoop({
      task: "read after write",
      workspace: { id: "demo", name: "Demo", root, allowedCommands: [] },
      provider,
      maxIterations: 3
    });

    expect(result.status).toBe("finished");
    expect(result.events.filter((event) => event.kind === "tool_result" && (event.action as { type?: string })?.type === "read_file"))
      .toHaveLength(1);
    expect(result.events.filter((event) => event.kind === "feedback" && (event.feedback as { source?: string })?.source === "duplicate_action"))
      .toHaveLength(0);
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

  it("feeds transient provider errors back into the next iteration", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-loop-provider-error-"));
    await writeFile(join(root, "README.md"), "# Demo\n", "utf8");
    const inputs: Array<{ task: string; context: string }> = [];
    const provider: LLMProvider = {
      async complete(input) {
        inputs.push(input);
        if (inputs.length === 1) {
          return JSON.stringify({ type: "read_file", path: "README.md", reason: "inspect" });
        }
        if (inputs.length === 2) {
          throw new Error("Provider deepseek request failed with status 503");
        }
        return JSON.stringify({ type: "finish", summary: "recovered" });
      }
    };

    const result = await runAgentLoop({
      task: "recover from provider error",
      workspace: { id: "demo", name: "Demo", root, allowedCommands: [] },
      provider,
      maxIterations: 3
    });

    expect(result.status).toBe("finished");
    expect(inputs).toHaveLength(3);
    expect(inputs[2].context).toContain("provider_error");
    expect(result.events).toContainEqual(expect.objectContaining({
      kind: "feedback",
      feedback: expect.objectContaining({
        source: "provider_error",
        message: "Provider request failed"
      })
    }));
  });

  it("blocks when provider errors on the final iteration", async () => {
    const provider: LLMProvider = {
      async complete() {
        throw new Error("Provider deepseek request failed with status 503");
      }
    };

    const result = await runAgentLoop({
      task: "handle final provider error",
      workspace: { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: [] },
      provider,
      maxIterations: 1
    });

    expect(result.status).toBe("blocked");
    expect(result.events).toContainEqual(expect.objectContaining({
      kind: "feedback",
      feedback: expect.objectContaining({ source: "provider_error" })
    }));
    expect(result.events).toContainEqual(expect.objectContaining({
      kind: "stop",
      reason: "provider_error"
    }));
  });

  it("stops early with a Chinese summary after repeated provider errors", async () => {
    let attempts = 0;
    const provider: LLMProvider = {
      async complete() {
        attempts += 1;
        throw new Error("Provider deepseek request failed with status 503");
      }
    };

    const result = await runAgentLoop({
      task: "handle repeated provider errors",
      workspace: { id: "demo", name: "Demo", root: process.cwd(), allowedCommands: [] },
      provider,
      maxIterations: 10
    });

    expect(result.status).toBe("blocked");
    expect(attempts).toBe(3);
    expect(result.events.filter((event) => event.kind === "feedback")).toHaveLength(3);
    expect(result.events).toContainEqual(expect.objectContaining({
      kind: "stop",
      reason: "provider_error",
      summary: expect.stringContaining("模型服务")
    }));
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
