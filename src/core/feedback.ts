export type Feedback = {
  source:
    | "invalid_action"
    | "safety_blocked"
    | "command_failed"
    | "test_failed"
    | "static_check_failed"
    | "tool_succeeded"
    | "credential_missing";
  severity: "info" | "warning" | "error";
  message: string;
  payload?: Record<string, unknown>;
};

import type { GuardrailDecision } from "../runtime/guardrails.js";
import type { ToolResult } from "../runtime/tools.js";

const testFailurePattern = /\b(?:\d+\s+(?:failed|failing)|tests?\s+failed|test\s+failure|vitest|jest)\b/i;
const staticCheckFailurePattern = /\b(?:TS\d{4}|eslint|typecheck|lint|static\s+check)\b/i;

function resultPayload(result: ToolResult): Record<string, unknown> {
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    error: result.error
  };
}

export function feedbackFromCommandResult(result: ToolResult): Feedback {
  if (result.ok) {
    return {
      source: "tool_succeeded",
      severity: "info",
      message: "Tool completed successfully",
      payload: resultPayload(result)
    };
  }

  const output = [result.stdout, result.stderr, result.error].filter(Boolean).join("\n");
  if (testFailurePattern.test(output)) {
    return {
      source: "test_failed",
      severity: "error",
      message: "Test command failed",
      payload: resultPayload(result)
    };
  }
  if (staticCheckFailurePattern.test(output)) {
    return {
      source: "static_check_failed",
      severity: "error",
      message: "Static check failed",
      payload: resultPayload(result)
    };
  }
  return {
    source: "command_failed",
    severity: "error",
    message: result.error ?? "Command failed",
    payload: resultPayload(result)
  };
}

export function feedbackFromGuardrail(
  decision: Exclude<GuardrailDecision, { decision: "allow" }>
): Feedback {
  return {
    source: "safety_blocked",
    severity: decision.decision === "block" ? "error" : "warning",
    message: decision.reason,
    payload: { ruleId: decision.ruleId, decision: decision.decision }
  };
}

export function feedbackCredentialMissing(provider: string): Feedback {
  return {
    source: "credential_missing",
    severity: "error",
    message: `Credential is missing for ${provider}`,
    payload: { provider }
  };
}
