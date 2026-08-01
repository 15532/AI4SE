import { parseAction } from "./actions";
import { buildContext } from "./context";
import type { Feedback } from "./feedback";
import type { LLMProvider } from "./providers";
import { classifyAction } from "../runtime/guardrails";
import { dispatchTool } from "../runtime/tools";
import type { WorkspaceConfig } from "../runtime/workspace";

type AgentStatus = "finished" | "blocked" | "max_iterations";
type AgentEvent = Record<string, unknown>;

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
    events.push({ kind: "llm_response", iteration, response });

    const parsed = parseAction(response);
    if (!parsed.ok) {
      feedback.push(parsed.feedback);
      events.push({ kind: "parsed_action", iteration, ok: false });
      events.push({ kind: "feedback", iteration, feedback: parsed.feedback });
      events.push({ kind: "stop", iteration, reason: "invalid_action" });
      return { status: "blocked", events };
    }

    const { action } = parsed;
    events.push({ kind: "parsed_action", iteration, ok: true, action });

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
    events.push({ kind: "tool_result", iteration, action, result });
    const toolFeedback: Feedback = result.ok
      ? { source: "tool_succeeded", severity: "info", message: "Tool completed successfully" }
      : {
          source: "command_failed",
          severity: "error",
          message: result.error ?? "Tool failed",
          payload: { action: action.type }
        };
    feedback.push(toolFeedback);
    events.push({ kind: "feedback", iteration, feedback: toolFeedback });
  }

  events.push({ kind: "stop", reason: "max_iterations" });
  return { status: "max_iterations", events };
}
