import type { Feedback } from "./feedback";

export type Action =
  | { type: "read_file"; path: string; reason: string }
  | { type: "write_file"; path: string; content: string; reason: string }
  | { type: "list_files"; path: string; reason: string }
  | { type: "run_command"; command: string; reason: string }
  | { type: "remember"; key: string; value: string; scope: "workspace" | "global"; reason: string }
  | { type: "finish"; summary: string };

export type ParseActionResult =
  | { ok: true; action: Action }
  | { ok: false; feedback: Feedback };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => actualKeys.includes(key));
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isAction(value: unknown): value is Action {
  if (!isRecord(value) || !isString(value.type)) {
    return false;
  }

  switch (value.type) {
    case "read_file":
    case "list_files":
      return hasExactKeys(value, ["type", "path", "reason"])
        && isString(value.path)
        && isString(value.reason);
    case "write_file":
      return hasExactKeys(value, ["type", "path", "content", "reason"])
        && isString(value.path)
        && isString(value.content)
        && isString(value.reason);
    case "run_command":
      return hasExactKeys(value, ["type", "command", "reason"])
        && isString(value.command)
        && isString(value.reason);
    case "remember":
      return hasExactKeys(value, ["type", "key", "value", "scope", "reason"])
        && isString(value.key)
        && isString(value.value)
        && (value.scope === "workspace" || value.scope === "global")
        && isString(value.reason);
    case "finish":
      return hasExactKeys(value, ["type", "summary"]) && isString(value.summary);
    default:
      return false;
  }
}

function invalidShape(raw: string, reason: string): ParseActionResult {
  return {
    ok: false,
    feedback: {
      source: "invalid_action",
      severity: "error",
      message: "LLM action shape is invalid",
      payload: { reason, raw }
    }
  };
}

export function parseAction(raw: string): ParseActionResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      feedback: {
        source: "invalid_action",
        severity: "error",
        message: "LLM output is not valid JSON",
        payload: { raw }
      }
    };
  }

  if (!isAction(parsed)) {
    return invalidShape(raw, "Action must be a supported object with the exact required fields");
  }

  return { ok: true, action: parsed };
}
