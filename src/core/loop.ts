import { parseAction } from "./actions";
import { buildContext } from "./context";
import type { Feedback } from "./feedback";
import type { LLMProvider } from "./providers";
import { classifyAction } from "../runtime/guardrails";
import { dispatchTool } from "../runtime/tools";
import type { WorkspaceConfig } from "../runtime/workspace";

type AgentStatus = "finished" | "blocked" | "max_iterations";
type AgentEvent = Record<string, unknown>;

const credentialAssignmentPattern = /\b(?:openai_api_key|api[_-]?key|secret|token|password|private[_-]?key)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,}\]]+)/gi;
const apiKeyPattern = /\bsk-[A-Za-z0-9_-]+\b/g;

function redactString(value: string): string {
  return value
    .replace(credentialAssignmentPattern, (match) => {
      const separatorIndex = Math.max(match.indexOf("="), match.indexOf(":"));
      return `${match.slice(0, separatorIndex + 1)}[REDACTED]`;
    })
    .replace(apiKeyPattern, "[REDACTED]");
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, redactValue(nestedValue)]));
  }
  return value;
}

function redactFeedback(feedback: Feedback): Feedback {
  return redactValue(feedback) as Feedback;
}

function toolFeedback(actionType: string, result: Awaited<ReturnType<typeof dispatchTool>>): Feedback {
  const payload = redactValue({
    action: actionType,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    error: result.error
  }) as Record<string, unknown>;

  return result.ok
    ? {
        source: "tool_succeeded",
        severity: "info",
        message: "Tool completed successfully",
        payload
      }
    : {
        source: "command_failed",
        severity: "error",
        message: redactString(result.error ?? "Tool failed"),
        payload
      };
}

export async function runAgentLoop(input: {
  task: string;
  workspace: WorkspaceConfig;
  provider: LLMProvider;
  maxIterations: number;
}): Promise<{ status: AgentStatus; events: AgentEvent[] }> {
  const events: AgentEvent[] = [];
  const feedback: Feedback[] = [];
  const memories: string[] = [];

  for (let iteration = 0; iteration < input.maxIterations; iteration += 1) {
    const context = buildContext({ task: input.task, feedback, memories });
    const response = await input.provider.complete({ task: input.task, context });
    events.push({ kind: "llm_response", iteration, response: redactString(response) });

    const parsed = parseAction(response);
    if (!parsed.ok) {
      const invalidFeedback = redactFeedback(parsed.feedback);
      feedback.push(invalidFeedback);
      events.push({ kind: "parsed_action", iteration, ok: false });
      events.push({ kind: "feedback", iteration, feedback: invalidFeedback });
      events.push({ kind: "stop", iteration, reason: "invalid_action" });
      return { status: "blocked", events };
    }

    const { action } = parsed;
    events.push({ kind: "parsed_action", iteration, ok: true, action: redactValue(action) });

    if (action.type === "finish") {
      events.push({ kind: "stop", iteration, reason: "finish", summary: action.summary });
      return { status: "finished", events };
    }

    const guardrail = classifyAction(action, input.workspace);
    events.push({ kind: "guardrail", iteration, decision: guardrail });
    if (guardrail.decision !== "allow") {
      const blockedFeedback: Feedback = {
        source: "safety_blocked",
        severity: "error",
        message: guardrail.reason,
        payload: { ruleId: guardrail.ruleId }
      };
      feedback.push(blockedFeedback);
      events.push({ kind: "feedback", iteration, feedback: blockedFeedback });
      events.push({ kind: "stop", iteration, reason: "guardrail_blocked" });
      return { status: "blocked", events };
    }

    const result = await dispatchTool(action, input.workspace);
    events.push({ kind: "tool_result", iteration, action: redactValue(action), result: redactValue(result) });
    const nextFeedback = toolFeedback(action.type, result);
    feedback.push(nextFeedback);
    events.push({ kind: "feedback", iteration, feedback: nextFeedback });
  }

  events.push({ kind: "stop", reason: "max_iterations" });
  return { status: "max_iterations", events };
}
