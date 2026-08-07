import { describe, expect, it } from "vitest";
import { runCodingTaskDemo } from "../../src/demo/coding-task";

describe("runCodingTaskDemo", () => {
  it("drives the agent loop through inspect, edit, verify, and finish", async () => {
    const result = await runCodingTaskDemo();

    expect(result.status).toBe("finished");
    expect(result.actionTypes).toEqual([
      "list_files",
      "read_file",
      "write_file",
      "run_command",
      "finish"
    ]);
    expect(result.finalSource).toContain("a + b");
    expect(result.verificationStdout).toContain("ok");
  });
});
