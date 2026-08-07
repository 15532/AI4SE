import { parseAction } from "./actions.js";
import { buildContext } from "./context.js";
import {
  feedbackFromCommandResult,
  feedbackFromGuardrail,
  feedbackFromProviderError,
  type Feedback
} from "./feedback.js";
import type { LLMProvider } from "./providers.js";
import type { Action } from "./actions.js";
import { classifyAction } from "../runtime/guardrails.js";
import { dispatchTool } from "../runtime/tools.js";
import type { WorkspaceConfig } from "../runtime/workspace.js";
import type { EventStore } from "../store/event-store.js";
import type { MemoryStore } from "../store/memory-store.js";

type AgentStatus = "finished" | "blocked" | "max_iterations" | "pending_approval";
type AgentEvent = Record<string, unknown>;

const credentialAssignmentPattern = /\b(?:openai_api_key|api[_-]?key|secret|token|password|private[_-]?key)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,}\]]+)/gi;
const apiKeyPattern = /\bsk-[A-Za-z0-9_-]+\b/g;
const maxConsecutiveProviderErrors = 3;
const totalIterationCapMultiplier = 3;

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

function actionSignature(action: Action): string {
  switch (action.type) {
    case "list_files":
    case "read_file":
      return `${action.type}:${action.path}`;
    case "write_file":
      return `${action.type}:${action.path}:${action.content}`;
    case "run_command":
      return `${action.type}:${action.command}`;
    case "remember":
      return `${action.type}:${action.scope}:${action.key}:${action.value}`;
    case "finish":
      return "finish";
  }
}

function buildLoopControl(input: { iteration: number; maxIterations: number }): string {
  const remaining = input.maxIterations - input.iteration;
  const lines = [
    "# Loop control",
    `剩余迭代次数：${remaining}`,
    "- 每一轮只返回一个 JSON action。"
  ];

  if (remaining === 1) {
    lines.push(
      "- 这是最后一轮：如果已有足够信息完成任务，必须返回 finish，并用中文说明修改内容、跳过原因或验证结果。",
      "- 如果仍无法完成，也请返回 finish，总结阻塞原因与已经尝试过的步骤，不要再继续探索。"
    );
  } else if (remaining <= 2) {
    lines.push("- 迭代次数即将用完；优先验证并返回 finish，不要重复已经完成的查看动作。");
  }

  return lines.join("\n");
}

function duplicateActionFeedback(action: Action, historical = false): Feedback {
  const nextStep = action.type === "list_files"
    ? "请改为 read_file 读取具体文件，或直接 write_file / run_command 推进任务，然后 finish。"
    : action.type === "read_file"
      ? "请基于已读内容直接 write_file / run_command 推进任务，然后 finish。"
      : "请基于已有工具结果选择一个新的有效动作，或直接 finish。";
  return {
    source: "duplicate_action",
    severity: "warning",
    message: historical
      ? `你之前已经执行过完全相同的动作（相同路径/相同内容），不要重复执行。${nextStep}`
      : `不要连续重复同一个动作；请根据已有工具结果选择下一步。${nextStep}`,
    payload: { actionType: action.type, ...(historical ? { repeated: true } : {}) }
  };
}

function isMissingCredentialError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("Missing API key for provider ");
}

function providerErrorSummary(consecutiveErrors: number): string {
  return `模型服务连续 ${consecutiveErrors} 次请求失败，本次任务尚未完成。请稍后重试或检查模型服务状态；已完成的工具结果和错误信息已保留在时间线中。`;
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
  existingRunId?: string;
}): Promise<{ runId?: string; status: AgentStatus; events: AgentEvent[] }> {
  const events: AgentEvent[] = [];
  const feedback: Feedback[] = [];
  const memories = input.memoryStore === undefined
    ? []
    : [
      ...input.memoryStore.recall({ workspaceId: input.workspace.id, scope: "workspace", limit: 50 }),
      ...input.memoryStore.recall({ workspaceId: input.workspace.id, scope: "global", limit: 50 })
    ].map((memory) => `${memory.key}: ${memory.value}`);
  const runId = input.existingRunId ?? input.eventStore?.createRun({
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
  let lastActionSignature: string | undefined;
  const executedSignatures = new Set<string>();
  const writtenPaths = new Set<string>();
  const pathsNeedingVerification = new Set<string>();
  const successfulCommands = new Set<string>();
  let consecutiveProviderErrors = 0;
  let verificationWarnings = 0;

  const record = (event: AgentEvent): void => {
    events.push(event);
    if (runId !== undefined && typeof event.kind === "string") {
      input.eventStore?.appendEvent(runId, event.kind, event);
    }
  };

  const totalIterationCap = input.maxIterations * totalIterationCapMultiplier;
  let iteration = 0;
  let effectiveIterations = 0;
  while (effectiveIterations < input.maxIterations && iteration < totalIterationCap) {
    iteration += 1;
    const isLastIteration = effectiveIterations === input.maxIterations - 1;
    const baseContext = buildContext({
      task: input.task,
      feedback,
      memories,
      recentRuns,
      workspace: { id: input.workspace.id, name: input.workspace.name },
      allowedCommands: input.workspace.allowedCommands
    });
    const context = [
      baseContext,
      "",
      buildLoopControl({ iteration: effectiveIterations, maxIterations: input.maxIterations })
    ].join("\n");
    let response: string;
    try {
      response = await input.provider.complete({ task: input.task, context });
    } catch (error) {
      if (isMissingCredentialError(error)) {
        throw error;
      }
      consecutiveProviderErrors += 1;
      const providerFeedback = redactFeedback(feedbackFromProviderError(error));
      feedback.push(providerFeedback);
      record({ kind: "feedback", iteration, feedback: providerFeedback });
      if (!isLastIteration && consecutiveProviderErrors < maxConsecutiveProviderErrors) {
        continue;
      }
      record({
        kind: "stop",
        iteration,
        reason: "provider_error",
        summary: providerErrorSummary(consecutiveProviderErrors)
      });
      return { runId, status: "blocked", events };
    }
    consecutiveProviderErrors = 0;
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
    const currentActionSignature = actionSignature(action);

    if (action.type === "finish") {
      const claimsVerification = /npm (?:test|run (?:build|test))|node --check|验证(?:通过|成功)|测试(?:通过|成功)|运行成功/i.test(action.summary);
      if (claimsVerification && successfulCommands.size === 0 && verificationWarnings < 2) {
        verificationWarnings += 1;
        const verificationFeedback = redactFeedback({
          source: "verification_missing",
          severity: "error",
          message: "你的 finish.summary 声称验证命令成功，但本次运行并没有实际执行任何成功的验证命令（run_command）。请先通过 run_command 真正运行 npm test / npm run build / node --check 并观察结果，再 finish；如果没有运行验证，请在摘要中如实说明未验证。",
          payload: { summary: action.summary }
        });
        feedback.push(verificationFeedback);
        record({ kind: "feedback", iteration, feedback: verificationFeedback });
        continue;
      }
      record({ kind: "stop", iteration, reason: "finish", summary: redactString(action.summary) });
      return { runId, status: "finished", events };
    }

    const isConsecutiveRepeat = currentActionSignature === lastActionSignature;
    const isHistoricalRepeat = (
      (action.type === "write_file" || action.type === "list_files")
      && executedSignatures.has(currentActionSignature)
    ) || (
      action.type === "read_file"
      && executedSignatures.has(currentActionSignature)
      && !writtenPaths.has(action.path)
    );
    if (isConsecutiveRepeat || isHistoricalRepeat) {
      const repeatFeedback = redactFeedback(duplicateActionFeedback(action, !isConsecutiveRepeat));
      feedback.push(repeatFeedback);
      record({ kind: "feedback", iteration, feedback: repeatFeedback });
      continue;
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

    if (
      action.type === "write_file"
      && writtenPaths.has(action.path)
      && pathsNeedingVerification.has(action.path)
    ) {
      const verifyFirstFeedback = redactFeedback({
        source: "duplicate_action",
        severity: "warning",
        message: "该文件在本轮已经写入过，并且写入后还没有运行任何验证命令。请先通过 run_command 运行 npm test / npm run build 验证当前实现，再决定是否需要继续修改；不要反复重写同一个文件而不验证。",
        payload: { actionType: action.type, path: action.path, repeated: true }
      });
      feedback.push(verifyFirstFeedback);
      record({ kind: "feedback", iteration, feedback: verifyFirstFeedback });
      continue;
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
      executedSignatures.add(currentActionSignature);
      lastActionSignature = currentActionSignature;
      effectiveIterations += 1;
      continue;
    }

    const result = await dispatchTool(action, input.workspace);
    record({ kind: "tool_result", iteration, action: redactValue(action), result: redactValue(result) });
    const nextFeedback = redactFeedback(feedbackFromCommandResult(result));
    feedback.push(nextFeedback);
    record({ kind: "feedback", iteration, feedback: nextFeedback });
    executedSignatures.add(currentActionSignature);
    if (action.type === "write_file") {
      writtenPaths.add(action.path);
      pathsNeedingVerification.add(action.path);
    }
    if (action.type === "run_command") {
      pathsNeedingVerification.clear();
      if (result.ok) successfulCommands.add(action.command);
    }
    lastActionSignature = currentActionSignature;
    effectiveIterations += 1;
  }

  record({ kind: "stop", reason: "max_iterations", iteration });
  return { runId, status: "max_iterations", events };
}
