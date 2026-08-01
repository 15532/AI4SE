import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadHarnessRegistry } from "../../src/config/harness-config";

describe("loadHarnessRegistry", () => {
  it("loads multiple registered workspaces and execution settings from YAML", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-config-"));
    const configPath = join(dir, "harness.yaml");
    await writeFile(configPath, `
mode: review
maxIterations: 7
providers:
  - id: mock
    type: mock
workspaces:
  - id: app
    name: Application
    root: ./fixtures/app
    allowedCommands:
      - npm test
  - id: docs
    name: Documentation
    root: ./fixtures/docs
    allowedCommands:
      - npm run build
`, "utf8");

    const registry = loadHarnessRegistry(configPath);

    expect(registry.mode).toBe("review");
    expect(registry.maxIterations).toBe(7);
    expect(registry.getProvider("mock")).toEqual({ id: "mock", type: "mock" });
    expect(registry.listWorkspaces()).toEqual([
      { id: "app", name: "Application", root: join(dir, "fixtures/app"), allowedCommands: ["npm test"] },
      { id: "docs", name: "Documentation", root: join(dir, "fixtures/docs"), allowedCommands: ["npm run build"] }
    ]);
  });

  it("rejects duplicate workspace ids instead of silently replacing a registration", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-config-"));
    const configPath = join(dir, "harness.yaml");
    await writeFile(configPath, `
mode: default
maxIterations: 3
providers:
  - id: mock
    type: mock
workspaces:
  - id: demo
    name: First
    root: ./first
    allowedCommands: []
  - id: demo
    name: Second
    root: ./second
    allowedCommands: []
`, "utf8");

    expect(() => loadHarnessRegistry(configPath)).toThrow("Duplicate workspace id: demo");
  });

  it("loads a DeepSeek-compatible provider with safe defaults", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-config-"));
    const configPath = join(dir, "harness.yaml");
    await writeFile(configPath, `
mode: default
maxIterations: 3
providers:
  - id: deepseek
    type: deepseek-compatible
    baseUrl: https://api.deepseek.com
    model: deepseek-v4-flash
workspaces:
  - id: demo
    name: Demo
    root: ./demo
    allowedCommands: []
`, "utf8");

    const registry = loadHarnessRegistry(configPath);

    expect(registry.getProvider("deepseek")).toEqual({
      id: "deepseek",
      type: "deepseek-compatible",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      thinking: "disabled"
    });
  });
});
