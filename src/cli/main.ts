#!/usr/bin/env node

import { Command } from "commander";
import { loadHarnessRegistry } from "../config/harness-config.js";
import { CredentialManager } from "../credentials/credential-manager.js";
import { InMemoryKeychainAdapter } from "../credentials/keychain-adapter.js";
import { runMechanismDemo } from "../demo/mechanisms.js";
import { runAgentLoop } from "../core/loop.js";
import { MockLLMProvider } from "../core/providers.js";
import { EventStore } from "../store/event-store.js";
import { MemoryStore } from "../store/memory-store.js";

type Output = { write(chunk: string): unknown };
type CliOptions = {
  stdout?: Output;
  stderr?: Output;
  env?: NodeJS.ProcessEnv;
};

function writeJson(output: Output, value: unknown): void {
  output.write(`${JSON.stringify(value)}\n`);
}

async function withEnvironment<T>(env: NodeJS.ProcessEnv | undefined, operation: () => Promise<T>): Promise<T> {
  if (env === undefined) return operation();

  const previous = new Map(Object.keys(env).map((key) => [key, process.env[key]]));
  Object.assign(process.env, env);
  try {
    return await operation();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

export function createProgram(options: CliOptions = {}): Command {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const credentials = new CredentialManager(new InMemoryKeychainAdapter(), { allowEnvFallback: true });
  const program = new Command();

  program
    .name("harness")
    .exitOverride()
    .configureOutput({ writeOut: (text) => stdout.write(text), writeErr: (text) => stderr.write(text) });

  program.command("demo").action(async () => {
    writeJson(stdout, await runMechanismDemo());
  });

  program
    .command("run")
    .requiredOption("--workspace <id>")
    .requiredOption("--provider <name>")
    .requiredOption("--task <text>")
    .action(async (commandOptions: { workspace: string; provider: string; task: string }) => {
      const registry = loadHarnessRegistry(process.env.HARNESS_CONFIG_PATH ?? "config/harness.example.yaml");
      const workspace = registry.getWorkspace(commandOptions.workspace);
      if (workspace === undefined) throw new Error(`Unknown workspace: ${commandOptions.workspace}`);
      const providerConfig = registry.getProvider(commandOptions.provider);
      if (providerConfig === undefined || providerConfig.type !== "mock") {
        throw new Error(`Unsupported provider: ${commandOptions.provider}`);
      }
      const dbPath = process.env.HARNESS_DB_PATH ?? "data/harness.sqlite";
      const eventStore = new EventStore(dbPath);
      const memoryStore = new MemoryStore(dbPath);
      const result = await runAgentLoop({
        task: commandOptions.task,
        workspace,
        provider: new MockLLMProvider([JSON.stringify({ type: "finish", summary: "Mock run completed" })]),
        maxIterations: registry.maxIterations,
        mode: registry.mode,
        eventStore,
        memoryStore
      });
      writeJson(stdout, result);
    });

  const credentialCommand = program.command("credentials");
  credentialCommand
    .command("status")
    .requiredOption("--provider <name>")
    .action(async ({ provider }: { provider: string }) => writeJson(stdout, await credentials.status(provider)));
  credentialCommand
    .command("set")
    .requiredOption("--provider <name>")
    .action(async ({ provider }: { provider: string }) => {
      const value = process.env.HARNESS_CREDENTIAL_VALUE;
      if (!value) throw new Error("HARNESS_CREDENTIAL_VALUE is required to set a credential");
      await credentials.set(provider, value);
      writeJson(stdout, { provider, set: true });
    });
  credentialCommand
    .command("clear")
    .requiredOption("--provider <name>")
    .action(async ({ provider }: { provider: string }) => {
      await credentials.clear(provider);
      writeJson(stdout, { provider, cleared: true });
    });

  return program;
}

export async function runCli(argv: string[], options: CliOptions = {}): Promise<void> {
  await withEnvironment(options.env, async () => createProgram(options).parseAsync(argv, { from: "user" }));
}

if (process.argv[1]?.endsWith("main.ts") || process.argv[1]?.endsWith("main.js")) {
  void runCli(process.argv.slice(2)).catch((error: Error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
