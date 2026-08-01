import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAgentLoop } from "../core/loop.js";
import { MockLLMProvider } from "../core/providers.js";

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

export async function runMechanismDemo(): Promise<{ events: Array<Record<string, unknown>> }> {
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
    const phases = await Promise.all([
      runAgentLoop({
        task: "Demonstrate guardrail blocking",
        workspace,
        provider: new MockLLMProvider([
          JSON.stringify({ type: "run_command", command: "rm -rf .", reason: "dangerous command demonstration" })
        ]),
        maxIterations: 1
      }),
      runAgentLoop({
        task: "Demonstrate test failure feedback",
        workspace,
        provider: new MockLLMProvider([
          JSON.stringify({ type: "run_command", command: "npm test", reason: "run tests" }),
          JSON.stringify({ type: "finish", summary: "Test feedback observed" })
        ]),
        maxIterations: 2
      }),
      runAgentLoop({
        task: "Demonstrate corrective file action",
        workspace,
        provider: new MockLLMProvider([
          JSON.stringify({ type: "write_file", path: "fixed.txt", content: "fixed", reason: "apply correction" }),
          JSON.stringify({ type: "finish", summary: "Correction completed" })
        ]),
        maxIterations: 2
      })
    ]);

    return { events: timelineFrom(phases.flatMap((phase) => phase.events)) };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  void runMechanismDemo().then((result) => {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  });
}
