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
    const candidate = unwrapMarkdownJson(raw);
    const firstStart = candidate.indexOf("{");
    if (firstStart === -1) {
      throw new Error("No JSON object found");
    }
    const first = extractFirstJsonObject(candidate);
    if (first === undefined) {
      throw new Error("No JSON object found");
    }
    const remainder = candidate.slice(firstStart + first.length);
    const second = extractFirstJsonObject(remainder);
    if (second !== undefined) {
      try {
        const secondValue = JSON.parse(second) as Record<string, unknown>;
        if (typeof secondValue?.type === "string") {
          throw new Error("Multiple JSON objects found");
        }
      } catch (error) {
        if (error instanceof Error && error.message === "Multiple JSON objects found") {
          throw error;
        }
      }
    }
    return JSON.parse(first);
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
  } catch (error) {
    const multipleObjects = error instanceof Error && error.message === "Multiple JSON objects found";
    return {
      ok: false,
      feedback: {
        source: "invalid_action",
        severity: "error",
        message: multipleObjects
          ? "一次只能返回一个 JSON action；不要把多个动作拼接在同一个响应里。请先完成当前动作，再在下一轮返回下一个动作。"
          : "LLM output is not valid JSON",
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
