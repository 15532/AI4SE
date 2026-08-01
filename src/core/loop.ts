import { parseAction } from "./actions.js";
import { buildContext } from "./context.js";
import { feedbackFromCommandResult, feedbackFromGuardrail, type Feedback } from "./feedback.js";
import type { LLMProvider } from "./providers.js";
import { classifyAction } from "../runtime/guardrails.js";
import { dispatchTool } from "../runtime/tools.js";
import type { WorkspaceConfig } from "../runtime/workspace.js";
import type { EventStore } from "../store/event-store.js";
import type { MemoryStore } from "../store/memory-store.js";

type AgentStatus = "finished" | "blocked" | "max_iterations" | "pending_approval";
type AgentEvent = Record<string, unknown>;

const credentialAssignmentPattern = /\b(?:openai_api_key|api[_-]?key|secret|token|password|private[_-]?key)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,}\]]+)/gi;
const apiKeyPattern = /\bsk-[A-Za-z0-9_-]+\b/g;

function redactString(value: string): string {
  return value
    .replace(credentialAssignmentPattern, (match) => {
      if (match.includes("[REDACTED")) return match;
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

export async function runAgentLoop(input: {
  task: string;
  workspace: WorkspaceConfig;
  provider: LLMProvider;
  maxIterations: number;
  eventStore?: EventStore;
  memoryStore?: MemoryStore;
  mode?: string;
  sessionId?: string;
}): Promise<{ runId?: string; status: AgentStatus; events: AgentEvent[] }> {
  const events: AgentEvent[] = [];
  const feedback: Feedback[] = [];
  const memories = input.memoryStore === undefined
    ? []
    : [
      ...input.memoryStore.recall({ workspaceId: input.workspace.id, scope: "workspace", limit: 50 }),
      ...input.memoryStore.recall({ workspaceId: input.workspace.id, scope: "global", limit: 50 })
    ].map((memory) => `${memory.key}: ${memory.value}`);
  const runId = input.eventStore?.createRun({
    task: input.task,
    workspaceId: input.workspace.id,
    mode: input.mode ?? "default",
    sessionId: input.sessionId
  });
  const recentRuns = input.eventStore === undefined
    ? []
    : input.eventStore.listRecentRuns(input.workspace.id, 6)
      .filter((run) => run.id !== runId)
      .slice(0, 5)
      .map((run) => {
        const summary = input.eventStore?.summarizeRun(run.id);
        const status = summary?.status ?? "unknown";
        const suffix = summary?.summary === undefined ? "" : ` - ${summary.summary}`;
        return `${status}: ${run.task}${suffix}`;
      });

  const record = (event: AgentEvent): void => {
    events.push(event);
    if (runId !== undefined && typeof event.kind === "string") {
      input.eventStore?.appendEvent(runId, event.kind, event);
    }
  };

  for (let iteration = 0; iteration < input.maxIterations; iteration += 1) {
    const isLastIteration = iteration === input.maxIterations - 1;
    const context = buildContext({
      task: input.task,
      feedback,
      memories,
      recentRuns,
      workspace: { id: input.workspace.id, name: input.workspace.name },
      allowedCommands: input.workspace.allowedCommands
    });
    const response = await input.provider.complete({ task: input.task, context });
    record({ kind: "llm_response", iteration, response: redactString(response) });

    const parsed = parseAction(response);
    if (!parsed.ok) {
      const invalidFeedback = redactFeedback(parsed.feedback);
      feedback.push(invalidFeedback);
      record({ kind: "parsed_action", iteration, ok: false });
      record({ kind: "feedback", iteration, feedback: invalidFeedback });
      if (!isLastIteration) {
        continue;
      }
      record({ kind: "stop", iteration, reason: "invalid_action" });
      return { runId, status: "blocked", events };
    }

    const { action } = parsed;
    record({ kind: "parsed_action", iteration, ok: true, action: redactValue(action) });

    if (action.type === "finish") {
      record({ kind: "stop", iteration, reason: "finish", summary: redactString(action.summary) });
      return { runId, status: "finished", events };
    }

    const guardrail = classifyAction(action, input.workspace);
    record({ kind: "guardrail", iteration, decision: guardrail });
    if (guardrail.decision === "require_approval") {
      const approvalId = runId === undefined
        ? undefined
        : input.eventStore?.createApproval({
          runId,
          workspaceId: input.workspace.id,
          action,
          ruleId: guardrail.ruleId,
          reason: guardrail.reason
        });
      record({
        kind: "approval_required",
        iteration,
        approvalId,
        action: redactValue(action),
        decision: guardrail
      });
      record({ kind: "stop", iteration, reason: "pending_approval", approvalId });
      return { runId, status: "pending_approval", events };
    }

    if (guardrail.decision !== "allow") {
      const blockedFeedback = redactFeedback(feedbackFromGuardrail(guardrail));
      feedback.push(blockedFeedback);
      record({ kind: "feedback", iteration, feedback: blockedFeedback });
      if (!isLastIteration) {
        continue;
      }
      record({ kind: "stop", iteration, reason: "guardrail_blocked" });
      return { runId, status: "blocked", events };
    }

    if (action.type === "remember" && input.memoryStore !== undefined) {
      input.memoryStore.remember({
        workspaceId: input.workspace.id,
        scope: action.scope,
        key: action.key,
        value: action.value
      });
      const result = { ok: true };
      record({ kind: "tool_result", iteration, action: redactValue(action), result });
      const nextFeedback = redactFeedback(feedbackFromCommandResult(result));
      feedback.push(nextFeedback);
      record({ kind: "feedback", iteration, feedback: nextFeedback });
      continue;
    }

    const result = await dispatchTool(action, input.workspace);
    record({ kind: "tool_result", iteration, action: redactValue(action), result: redactValue(result) });
    const nextFeedback = redactFeedback(feedbackFromCommandResult(result));
    feedback.push(nextFeedback);
    record({ kind: "feedback", iteration, feedback: nextFeedback });
  }

  record({ kind: "stop", reason: "max_iterations" });
  return { runId, status: "max_iterations", events };
}
