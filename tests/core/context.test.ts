import { describe, expect, it } from "vitest";
import { buildContext } from "../../src/core/context";

describe("buildContext", () => {
  it("renders a usable coding-agent context with tool schema and verification rules", () => {
    const context = buildContext({
      task: "fix add function",
      feedback: [{
        source: "test_failed",
        severity: "error",
        message: "npm test failed",
        payload: { stderr: "expected 3 got 2" }
      }],
      memories: ["project.testCommand: npm test"],
      recentRuns: ["finished: fixed add function - verified with npm test"],
      workspace: { id: "demo-ts", name: "Demo TS" },
      allowedCommands: ["npm test", "npm run build"]
    });

    expect(context).toContain("Task");
    expect(context).toContain("fix add function");
    expect(context).toContain("Workspace");
    expect(context).toContain("demo-ts");
    expect(context).toContain("Available actions");
    expect(context).toContain("list_files");
    expect(context).toContain("read_file");
    expect(context).toContain("write_file");
    expect(context).toContain("run_command");
    expect(context).toContain("Allowed commands");
    expect(context).toContain("npm test");
    expect(context).toContain("Recent feedback");
    expect(context).toContain("test_failed");
    expect(context).toContain("Recent runs");
    expect(context).toContain("fixed add function");
    expect(context).toContain("Do not finish before");
  });
});
