import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { dispatchTool } from "../../src/runtime/tools";

describe("dispatchTool", () => {
  it("writes and reads files inside workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-tools-"));
    const workspace = { id: "tmp", name: "Tmp", root, allowedCommands: [] };
    await dispatchTool({ type: "write_file", path: "a.txt", content: "hello", reason: "write" }, workspace);
    await expect(readFile(join(root, "a.txt"), "utf8")).resolves.toBe("hello");
  });

  it("rejects path traversal outside workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-tools-"));
    const workspace = { id: "tmp", name: "Tmp", root, allowedCommands: [] };
    const result = await dispatchTool({ type: "read_file", path: "../secret.txt", reason: "escape" }, workspace);
    expect(result).toEqual({ ok: false, error: "Path escapes workspace root" });
  });
});
