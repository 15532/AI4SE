import type { Feedback } from "./feedback.js";

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

function unwrapMarkdownJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1] ?? raw;
}

function extractFirstJsonObject(raw: string): string | undefined {
  const start = raw.indexOf("{");
  if (start === -1) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = inString;
      continue;
    }

    if (char === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, index + 1);
      }
    }
  }

  return undefined;
}

function parseJsonActionCandidate(raw: string): unknown {
  try {
    return JSON.parse(unwrapMarkdownJson(raw));
  } catch {
    const extracted = extractFirstJsonObject(raw);
    if (extracted === undefined) {
      throw new Error("No JSON object found");
    }
    return JSON.parse(extracted);
  }
}

function normalizeProviderAction(value: unknown): unknown {
  if (!isRecord(value) || typeof value.type === "string" || typeof value.action !== "string") {
    return value;
  }
  const { action, ...rest } = value;
  return { type: action, ...rest };
}

export function parseAction(raw: string): ParseActionResult {
  let parsed: unknown;
  try {
    parsed = parseJsonActionCandidate(raw);
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
  const normalized = normalizeProviderAction(parsed);

  if (!isAction(normalized)) {
    return invalidShape(raw, "Action must be a supported object with the exact required fields");
  }

  return { ok: true, action: normalized };
}
