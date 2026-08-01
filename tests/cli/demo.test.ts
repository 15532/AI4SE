import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/main";
import { runMechanismDemo } from "../../src/demo/mechanisms";
import { EventStore } from "../../src/store/event-store";

function outputBuffer(): { write(chunk: string): boolean; text(): string } {
  let value = "";
  return {
    write(chunk: string): boolean {
      value += chunk;
      return true;
    },
    text(): string {
      return value;
    }
  };
}

describe("mechanism demo", () => {
  it("shows guardrail block and feedback-driven correction", async () => {
    const result = await runMechanismDemo();
    const kinds = result.events.map((event) => event.kind);
    const testFailureIndex = kinds.indexOf("feedback.test_failed");
    const correctionIndex = kinds.indexOf("action.write_file");

    expect(kinds).toContain("guardrail.blocked");
    expect(testFailureIndex).toBeGreaterThan(-1);
    expect(correctionIndex).toBeGreaterThan(testFailureIndex);
    expect(result.correctionContextObserved).toBe(true);
  });

  it("does not include secret-shaped values in the timeline", async () => {
    const result = await runMechanismDemo();

    expect(JSON.stringify(result)).not.toMatch(/sk-[A-Za-z0-9_-]+/);
  });
});

describe("CLI", () => {
  it("publishes the compiled CLI entrypoint produced by the current build layout", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));

    expect(packageJson.bin.harness).toBe("dist/src/cli/main.js");
  });

  it("writes the demo timeline as JSON", async () => {
    const stdout = outputBuffer();
    const stderr = outputBuffer();

    await runCli(["demo"], { stdout, stderr, env: {} });

    expect(JSON.parse(stdout.text())).toMatchObject({ events: expect.any(Array) });
    expect(stderr.text()).toBe("");
  });

  it("loads its registry from YAML and persists runs to the configured SQLite database", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-cli-"));
    const configPath = join(dir, "harness.yaml");
    const dbPath = join(dir, "harness.sqlite");
    await writeFile(configPath, `
mode: cli-review
maxIterations: 4
providers:
  - id: local-mock
    type: mock
workspaces:
  - id: configured
    name: Configured workspace
    root: ./workspace
    allowedCommands: []
`, "utf8");
    const stdout = outputBuffer();

    await runCli([
      "run",
      "--workspace", "configured",
      "--provider", "local-mock",
      "--task", "finish from configured CLI"
    ], {
      stdout,
      stderr: outputBuffer(),
      env: { HARNESS_CONFIG_PATH: configPath, HARNESS_DB_PATH: dbPath }
    });

    const result = JSON.parse(stdout.text()) as { runId: string; status: string };
    const store = new EventStore(dbPath);
    expect(result).toMatchObject({ runId: expect.any(String), status: "finished" });
    expect(store.getRun(result.runId)).toMatchObject({
      workspaceId: "configured",
      mode: "cli-review",
      task: "finish from configured CLI"
    });
    expect(store.listEvents(result.runId).length).toBeGreaterThan(0);
  });

  it("preserves the executable shebang in compiled CLI output", async () => {
    const source = await readFile(new URL("../../src/cli/main.ts", import.meta.url), "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
    }).outputText;

    expect(output.startsWith("#!/usr/bin/env node\n")).toBe(true);
  });

  it("reports credential status without exposing the environment value", async () => {
    const stdout = outputBuffer();
    const secret = "sk-cli-status-secret";

    await runCli(["credentials", "status", "--provider", "openai"], {
      stdout,
      stderr: outputBuffer(),
      env: { OPENAI_API_KEY: secret }
    });

    expect(stdout.text()).toContain('"exists":true');
    expect(stdout.text()).toContain('"source":"env"');
    expect(stdout.text()).not.toContain(secret);
  });
});
