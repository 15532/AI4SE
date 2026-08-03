import { describe, expect, it } from "vitest";
import { parseAction } from "../../src/core/actions";

describe("parseAction", () => {
  it("rejects invalid JSON as invalid_action feedback", () => {
    const result = parseAction("not json");
    expect(result).toEqual({
      ok: false,
      feedback: {
        source: "invalid_action",
        severity: "error",
        message: "LLM output is not valid JSON",
        payload: { raw: "not json" }
      }
    });
  });

  it("parses a valid run_command action", () => {
    const result = parseAction(JSON.stringify({
      type: "run_command",
      command: "npm test",
      reason: "verify tests"
    }));
    expect(result).toEqual({
      ok: true,
      action: {
        type: "run_command",
        command: "npm test",
        reason: "verify tests"
      }
    });
  });

  it("normalizes a provider response that uses action instead of type", () => {
    const result = parseAction(JSON.stringify({
      action: "finish",
      summary: "DeepSeek connected"
    }));

    expect(result).toEqual({
      ok: true,
      action: {
        type: "finish",
        summary: "DeepSeek connected"
      }
    });
  });

  it("parses a strict JSON action wrapped in a markdown json code block", () => {
    const result = parseAction([
      "```json",
      JSON.stringify({ type: "read_file", path: "README.md", reason: "inspect docs" }),
      "```"
    ].join("\n"));

    expect(result).toEqual({
      ok: true,
      action: {
        type: "read_file",
        path: "README.md",
        reason: "inspect docs"
      }
    });
  });

  it("normalizes a legacy action wrapped in a markdown json code block", () => {
    const result = parseAction([
      "```json",
      JSON.stringify({ action: "finish", summary: "wrapped legacy action" }),
      "```"
    ].join("\n"));

    expect(result).toEqual({
      ok: true,
      action: {
        type: "finish",
        summary: "wrapped legacy action"
      }
    });
  });

  it.each([
    ["null", null],
    ["array", []],
    ["missing type", { command: "npm test", reason: "verify" }],
    ["unknown type", { type: "shell", command: "npm test", reason: "verify" }],
    ["wrong field type", { type: "run_command", command: 123, reason: "verify" }],
    ["extra field", { type: "finish", summary: "done", unexpected: true }],
    ["legacy action extra field", { action: "finish", summary: "done", unexpected: true }]
  ])("rejects invalid action shape: %s", (_name, value) => {
    const result = parseAction(JSON.stringify(value));
    expect(result).toEqual({
      ok: false,
      feedback: {
        source: "invalid_action",
        severity: "error",
        message: "LLM action shape is invalid",
        payload: { reason: expect.any(String), raw: JSON.stringify(value) }
      }
    });
  });
});
