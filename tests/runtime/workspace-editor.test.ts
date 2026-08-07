import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { saveWorkspaceTextFile } from "../../src/runtime/workspace-editor";

describe("workspace editor", () => {
  it("saves a text file inside the workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-editor-"));
    await mkdir(join(root, "src"), { recursive: true });
    const workspace = { id: "demo", name: "Demo", root, allowedCommands: [] };

    await expect(saveWorkspaceTextFile(workspace, "src/index.ts", "export const ok = true;\n"))
      .resolves.toEqual({ ok: true, path: "src/index.ts" });
    await expect(readFile(join(root, "src", "index.ts"), "utf8"))
      .resolves.toBe("export const ok = true;\n");
  });

  it("rejects paths that escape the workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-editor-"));

    await expect(saveWorkspaceTextFile(
      { id: "demo", name: "Demo", root, allowedCommands: [] },
      "../outside.ts",
      "export const unsafe = true;\n"
    )).resolves.toEqual({
      ok: false,
      error: "Path escapes workspace root",
      ruleId: "path.escape_workspace"
    });
  });

  it("rejects sensitive paths and secret-like content", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-editor-"));
    const workspace = { id: "demo", name: "Demo", root, allowedCommands: [] };

    await expect(saveWorkspaceTextFile(workspace, ".env", "TOKEN=value\n"))
      .resolves.toEqual({
        ok: false,
        error: "Sensitive files cannot be written",
        ruleId: "write.sensitive_file"
      });
    await expect(saveWorkspaceTextFile(workspace, "src/config.ts", "api_key=plain-secret\n"))
      .resolves.toEqual({
        ok: false,
        error: "Sensitive files cannot be written",
        ruleId: "write.sensitive_file"
      });
  });

  it("can update an existing file without exposing absolute paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-editor-"));
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "index.ts"), "old\n", "utf8");

    const result = await saveWorkspaceTextFile(
      { id: "demo", name: "Demo", root, allowedCommands: [] },
      "src/index.ts",
      "new\n"
    );

    expect(result).toEqual({ ok: true, path: "src/index.ts" });
    expect(JSON.stringify(result)).not.toContain(root);
    await expect(readFile(join(root, "src", "index.ts"), "utf8")).resolves.toBe("new\n");
  });
});
