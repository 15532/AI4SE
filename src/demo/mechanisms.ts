import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAgentLoop } from "../core/loop.js";
import type { EventStore } from "../store/event-store.js";
import type { LLMProvider } from "../core/providers.js";

type DemoEvent = Record<string, unknown>;

const defaultAllowedCommands = ["npm test", "npm run test", "npm run lint", "npm run typecheck", "npm run build"];

function timelineFrom(events: DemoEvent[]): DemoEvent[] {
  return events.map((event) => {
    if (event.kind === "guardrail" && (event.decision as { decision?: string }).decision === "block") {
      return { kind: "guardrail.blocked", decision: event.decision };
    }
    if (event.kind === "feedback" && (event.feedback as { source?: string }).source === "test_failed") {
      return { kind: "feedback.test_failed", feedback: event.feedback };
    }
    if (event.kind === "tool_result" && (event.action as { type?: string }).type === "write_file") {
      return { kind: "action.write_file", action: event.action, result: event.result };
    }
    return event;
  });
}

export async function runMechanismDemo(options: {
  eventStore?: EventStore;
  existingRunId?: string;
  sessionId?: string;
} = {}): Promise<{
  events: Array<Record<string, unknown>>;
  correctionContextObserved: boolean;
}> {
  const { eventStore, existingRunId, sessionId } = options;
  const root = await mkdtemp(path.join(tmpdir(), "harness-mechanisms-"));
  try {
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ scripts: { test: "node -e \"console.log('1 failed, 2 passed'); process.exit(1)\"" } }),
      "utf8"
    );

    const workspace = {
      id: "mechanism-demo",
      name: "Mechanism demo",
      root,
      allowedCommands: defaultAllowedCommands
    };

    let providerCall = 0;
    let correctionContextObserved = false;
    const provider: LLMProvider = {
      async complete(input) {
        providerCall += 1;
        if (providerCall === 1) {
          return JSON.stringify({ type: "run_command", command: "rm -rf .", reason: "dangerous command demonstration" });
        }
        if (providerCall === 2) {
          return JSON.stringify({ type: "run_command", command: "npm test", reason: "run tests" });
        }
        if (providerCall === 3) {
          correctionContextObserved = input.context.includes("test_failed");
          return correctionContextObserved
            ? JSON.stringify({ type: "write_file", path: "fixed.txt", content: "fixed", reason: "apply correction from test feedback" })
            : JSON.stringify({ type: "finish", summary: "未检测到 test_failed 反馈，机制演示未完成" });
        }
        return JSON.stringify({ type: "finish", summary: "机制演示完成：护栏拦截了危险命令 rm -rf .，npm test 失败产生 test_failed 反馈，模型据此改为 write_file 修正动作；三项机制均已确定性复现。" });
      }
    };

    const result = await runAgentLoop({
      task: "机制演示：护栏拦截、失败反馈与修正动作",
      workspace,
      provider,
      maxIterations: 5,
      eventStore,
      existingRunId,
      sessionId
    });

    return {
      events: timelineFrom(result.events),
      correctionContextObserved
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  void runMechanismDemo().then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  });
}
