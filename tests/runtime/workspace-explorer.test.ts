import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { listWorkspaceFiles, readWorkspaceTextFile } from "../../src/runtime/workspace-explorer";

describe("workspace explorer", () => {
  it("lists workspace files while skipping dependency and build directories", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-explorer-"));
    await mkdir(join(root, "src"), { recursive: true });
    await mkdir(join(root, "node_modules", "pkg"), { recursive: true });
    await mkdir(join(root, "dist"), { recursive: true });
    await writeFile(join(root, "README.md"), "# Demo\n", "utf8");
    await writeFile(join(root, "src", "index.ts"), "export const ok = true;\n", "utf8");
    await writeFile(join(root, "node_modules", "pkg", "index.js"), "ignored", "utf8");
    await writeFile(join(root, "dist", "index.js"), "ignored", "utf8");

    const files = await listWorkspaceFiles({ id: "demo", name: "Demo", root, allowedCommands: [] });

    expect(files).toEqual([
      { path: "README.md", kind: "file" },
      { path: "src", kind: "directory" },
      { path: "src/index.ts", kind: "file" }
    ]);
  });

  it("reads a text file inside the workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-explorer-"));
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "index.ts"), "export const answer = 42;\n", "utf8");

    await expect(readWorkspaceTextFile(
      { id: "demo", name: "Demo", root, allowedCommands: [] },
      "src/index.ts"
    )).resolves.toEqual({
      ok: true,
      path: "src/index.ts",
      content: "export const answer = 42;\n"
    });
  });

  it("rejects path traversal when reading files", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-explorer-"));

    await expect(readWorkspaceTextFile(
      { id: "demo", name: "Demo", root, allowedCommands: [] },
      "../outside.txt"
    )).resolves.toEqual({ ok: false, error: "Path escapes workspace root" });
  });

  it("rejects files larger than the configured limit", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-explorer-"));
    await writeFile(join(root, "large.txt"), "abcdef", "utf8");

    await expect(readWorkspaceTextFile(
      { id: "demo", name: "Demo", root, allowedCommands: [] },
      "large.txt",
      { maxBytes: 4 }
    )).resolves.toEqual({ ok: false, error: "File is too large to preview" });
  });
});
