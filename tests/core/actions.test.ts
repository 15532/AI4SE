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

  it.each([
    ["null", null],
    ["array", []],
    ["missing type", { command: "npm test", reason: "verify" }],
    ["unknown type", { type: "shell", command: "npm test", reason: "verify" }],
    ["wrong field type", { type: "run_command", command: 123, reason: "verify" }],
    ["extra field", { type: "finish", summary: "done", unexpected: true }]
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
