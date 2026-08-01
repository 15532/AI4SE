import { mkdtemp, readFile, writeFile } from "node:fs/promises";
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

  it("reads file contents inside workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-tools-"));
    const workspace = { id: "tmp", name: "Tmp", root, allowedCommands: [] };
    await writeFile(join(root, "a.txt"), "hello", "utf8");

    await expect(
      dispatchTool({ type: "read_file", path: "a.txt", reason: "read" }, workspace)
    ).resolves.toEqual({ ok: true, stdout: "hello" });
  });

  it("lists directory entry names", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-tools-"));
    const workspace = { id: "tmp", name: "Tmp", root, allowedCommands: [] };
    await writeFile(join(root, "entry.txt"), "", "utf8");

    await expect(
      dispatchTool({ type: "list_files", path: ".", reason: "list" }, workspace)
    ).resolves.toEqual({ ok: true, stdout: "entry.txt" });
  });

  it("rejects commands outside the workspace allowlist", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-tools-"));
    const workspace = { id: "tmp", name: "Tmp", root, allowedCommands: [] };

    await expect(
      dispatchTool({ type: "run_command", command: "node -v", reason: "run" }, workspace)
    ).resolves.toEqual({ ok: false, error: "Command is not in the workspace allowlist" });
  });

  it("runs an allowlisted command from the workspace root", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-tools-"));
    const command = "node -e \"process.stdout.write(process.cwd())\"";
    const workspace = { id: "tmp", name: "Tmp", root, allowedCommands: [command] };

    await expect(
      dispatchTool({ type: "run_command", command, reason: "run" }, workspace)
    ).resolves.toMatchObject({ ok: true, stdout: root, exitCode: 0 });
  });

  it("reports that memory storage is unavailable", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-tools-"));
    const workspace = { id: "tmp", name: "Tmp", root, allowedCommands: [] };

    await expect(
      dispatchTool(
        { type: "remember", key: "note", value: "hello", scope: "workspace", reason: "remember" },
        workspace
      )
    ).resolves.toEqual({ ok: false, error: "Memory store is not available in this task" });
  });

  it("finishes without running a tool", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-tools-"));
    const workspace = { id: "tmp", name: "Tmp", root, allowedCommands: [] };

    await expect(dispatchTool({ type: "finish", summary: "done" }, workspace)).resolves.toEqual({ ok: true });
  });
});
