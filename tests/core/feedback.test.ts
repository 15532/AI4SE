import { describe, expect, it } from "vitest";
import {
  feedbackCredentialMissing,
  feedbackFromCommandResult,
  feedbackFromGuardrail
} from "../../src/core/feedback";
import { buildContext } from "../../src/core/context";
import { runAgentLoop } from "../../src/core/loop";
import { MockLLMProvider } from "../../src/core/providers";

describe("feedback sensors", () => {
  it("classifies ordinary command failures", () => {
    const feedback = feedbackFromCommandResult({
      ok: false,
      stdout: "",
      stderr: "command failed",
      exitCode: 1
    });

    expect(feedback.source).toBe("command_failed");
    expect(feedback.severity).toBe("error");
  });

  it("classifies failing test output", () => {
    const feedback = feedbackFromCommandResult({
      ok: false,
      stdout: "1 failed, 2 passed",
      stderr: "",
      exitCode: 1
    });

    expect(feedback.source).toBe("test_failed");
    expect(feedback.severity).toBe("error");
  });

  it("classifies static check failures", () => {
    const feedback = feedbackFromCommandResult({
      ok: false,
      stdout: "",
      stderr: "src/index.ts(4,2): error TS2322",
      exitCode: 2
    });

    expect(feedback.source).toBe("static_check_failed");
    expect(feedback.severity).toBe("error");
  });

  it("records successful tool results", () => {
    const feedback = feedbackFromCommandResult({ ok: true, stdout: "complete", exitCode: 0 });

    expect(feedback.source).toBe("tool_succeeded");
    expect(feedback.severity).toBe("info");
  });

  it("turns guardrail blocks and approvals into safety feedback", () => {
    expect(feedbackFromGuardrail({
      decision: "block",
      reason: "not allowed",
      ruleId: "command.blocked"
    })).toMatchObject({ source: "safety_blocked", severity: "error", payload: { ruleId: "command.blocked", decision: "block" } });
    expect(feedbackFromGuardrail({
      decision: "require_approval",
      reason: "needs approval",
      ruleId: "command.approval"
    })).toMatchObject({ source: "safety_blocked", severity: "warning", payload: { ruleId: "command.approval", decision: "require_approval" } });
  });

  it("reports missing credentials without exposing a secret", () => {
    const feedback = feedbackCredentialMissing("openai");

    expect(feedback).toMatchObject({ source: "credential_missing", severity: "error" });
    expect(JSON.stringify(feedback)).toContain("openai");
  });

  it("injects feedback into the next context", () => {
    const context = buildContext({
      task: "fix tests",
      feedback: [{ source: "test_failed", severity: "error", message: "1 failed", payload: { exitCode: 1 } }],
      memories: []
    });

    expect(context).toContain("test_failed");
    expect(context).toContain("1 failed");
  });

  it("feeds classified tool failures into the next loop context", async () => {
    const contexts: string[] = [];
    const responses = [
      JSON.stringify({ type: "run_command", command: "npm run missing-script", reason: "run check" }),
      JSON.stringify({ type: "finish", summary: "done" })
    ];
    const provider = new MockLLMProvider(responses);
    const complete = provider.complete.bind(provider);
    provider.complete = async (input) => {
      contexts.push(input.context);
      return complete(input);
    };

    await runAgentLoop({
      task: "run a command",
      workspace: {
        id: "demo",
        name: "Demo",
        root: process.cwd(),
        allowedCommands: ["npm run missing-script"]
      },
      provider,
      maxIterations: 2
    });

    expect(contexts[1]).toContain("command_failed");
  });
});
