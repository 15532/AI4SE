import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAgentLoop } from "../core/loop.js";
import { MockLLMProvider } from "../core/providers.js";

type DemoEvent = Record<string, unknown>;

function actionTypesFrom(events: DemoEvent[]): string[] {
  return events
    .filter((event) => event.kind === "parsed_action" && event.ok === true)
    .map((event) => ((event.action as { type: string }).type));
}

function verificationStdoutFrom(events: DemoEvent[]): string {
  const event = events.find((candidate) =>
    candidate.kind === "tool_result"
    && (candidate.action as { type?: string }).type === "run_command"
  );
  return ((event?.result as { stdout?: string } | undefined)?.stdout ?? "").trim();
}

export async function runCodingTaskDemo(): Promise<{
  status: string;
  actionTypes: string[];
  finalSource: string;
  verificationStdout: string;
  events: DemoEvent[];
}> {
  const root = await mkdtemp(path.join(tmpdir(), "harness-coding-task-"));
  try {
    await writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ scripts: { test: "node test.js" } }, null, 2),
      "utf8"
    );
    await writeFile(
      path.join(root, "test.js"),
      [
        "const { add } = require('./src/add.js');",
        "const actual = add(1, 2);",
        "if (actual !== 3) {",
        "  console.error(`expected 3, got ${actual}`);",
        "  process.exit(1);",
        "}",
        "console.log('ok');",
        ""
      ].join("\n"),
      "utf8"
    );
    await mkdir(path.join(root, "src"), { recursive: true });
    await writeFile(
      path.join(root, "src", "add.js"),
      "exports.add = (a, b) => a - b;\n",
      "utf8"
    );

    const provider = new MockLLMProvider([
      JSON.stringify({ type: "list_files", path: ".", reason: "inspect project files" }),
      JSON.stringify({ type: "read_file", path: "src/add.js", reason: "inspect failing implementation" }),
      JSON.stringify({
        type: "write_file",
        path: "src/add.js",
        content: "exports.add = (a, b) => a + b;\n",
        reason: "fix addition implementation"
      }),
      JSON.stringify({ type: "run_command", command: "npm test", reason: "verify the fix" }),
      JSON.stringify({ type: "finish", summary: "Fixed add and verified with npm test" })
    ]);

    const result = await runAgentLoop({
      task: "Fix the failing add function and verify the project tests pass.",
      workspace: {
        id: "coding-task-demo",
        name: "Coding task demo",
        root,
        allowedCommands: ["npm test"]
      },
      provider,
      maxIterations: 5
    });

    return {
      status: result.status,
      actionTypes: actionTypesFrom(result.events),
      finalSource: await readFile(path.join(root, "src", "add.js"), "utf8"),
      verificationStdout: verificationStdoutFrom(result.events),
      events: result.events
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  void runCodingTaskDemo().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });
}
