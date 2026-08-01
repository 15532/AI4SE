import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAgentLoop } from "../core/loop.js";
import { MockLLMProvider, type LLMProvider } from "../core/providers.js";

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

export async function runMechanismDemo(): Promise<{
  events: Array<Record<string, unknown>>;
  correctionContextObserved: boolean;
}> {
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
    const guardrailPhase = await runAgentLoop({
      task: "Demonstrate guardrail blocking",
      workspace,
      provider: new MockLLMProvider([
        JSON.stringify({ type: "run_command", command: "rm -rf .", reason: "dangerous command demonstration" })
      ]),
      maxIterations: 1
    });

    let providerCall = 0;
    let correctionContextObserved = false;
    const correctionProvider: LLMProvider = {
      async complete(input) {
        providerCall += 1;
        if (providerCall === 1) {
          return JSON.stringify({ type: "run_command", command: "npm test", reason: "run tests" });
        }
        if (providerCall === 2) {
          correctionContextObserved = input.context.includes("test_failed");
          return correctionContextObserved
            ? JSON.stringify({ type: "write_file", path: "fixed.txt", content: "fixed", reason: "apply correction from test feedback" })
            : JSON.stringify({ type: "finish", summary: "No test failure feedback was available" });
        }
        return JSON.stringify({ type: "finish", summary: "Correction completed" });
      }
    };
    const correctionPhase = await runAgentLoop({
      task: "Run tests and correct the failure",
      workspace,
      provider: correctionProvider,
      maxIterations: 3
    });

    return {
      events: timelineFrom([...guardrailPhase.events, ...correctionPhase.events]),
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
