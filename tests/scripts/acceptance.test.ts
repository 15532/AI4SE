import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const packageJsonPath = resolve("package.json");
const scriptPath = resolve("scripts/acceptance-check.ps1");
const checklistPath = resolve("docs/ACCEPTANCE_CHECKLIST.md");

describe("acceptance check workflow", () => {
  test("exposes a one-command acceptance check script", () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts?.["check:acceptance"]).toBe("powershell -ExecutionPolicy Bypass -File scripts/acceptance-check.ps1");
    expect(existsSync(scriptPath)).toBe(true);

    const script = readFileSync(scriptPath, "utf8");
    expect(script).toContain("npm.cmd run build");
    expect(script).toContain("npm.cmd test");
    expect(script).toContain("npm.cmd run demo:mechanisms");
    expect(script).toContain("npm.cmd run demo:coding-task");
    expect(script).toContain("git status --short");
    expect(script).toContain("DEEPSEEK_API_KEY=");
    expect(script).toContain("sk-");
  });

  test("documents the Project A delivery checklist", () => {
    expect(existsSync(checklistPath)).toBe(true);

    const checklist = readFileSync(checklistPath, "utf8");
    expect(checklist).toContain("项目 A");
    expect(checklist).toContain("至少 3 个职责清晰的功能模块");
    expect(checklist).toContain("可一键运行的测试");
    expect(checklist).toContain("mock");
    expect(checklist).toContain("DeepSeek");
    expect(checklist).toContain("WebUI");
    expect(checklist).toContain("Docker");
    expect(checklist).toContain("安全策略");
  });
});
