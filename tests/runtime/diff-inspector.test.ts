import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { listWorkspaceChanges, readWorkspaceDiff } from "../../src/runtime/diff-inspector";
import type { WorkspaceConfig } from "../../src/runtime/workspace";

const execFileAsync = promisify(execFile);

async function git(root: string, args: string[]): Promise<void> {
  await execFileAsync("git", ["-C", root, ...args]);
}

async function createGitWorkspace(): Promise<{ root: string; workspace: WorkspaceConfig }> {
  const root = await mkdtemp(join(tmpdir(), "harness-diff-"));
  await git(root, ["init"]);
  await git(root, ["config", "user.email", "test@example.com"]);
  await git(root, ["config", "user.name", "Harness Test"]);
  await writeFile(join(root, "README.md"), "line one\nline two\n", "utf8");
  await git(root, ["add", "README.md"]);
  await git(root, ["commit", "-m", "initial"]);
  return {
    root,
    workspace: { id: "demo", name: "Demo", root, allowedCommands: [] }
  };
}

describe("diff inspector", () => {
  it("lists tracked and untracked workspace changes without exposing absolute roots", async () => {
    const { root, workspace } = await createGitWorkspace();
    await writeFile(join(root, "README.md"), "line one\nline two changed\n", "utf8");
    await writeFile(join(root, "notes.txt"), "new note\n", "utf8");

    const result = await listWorkspaceChanges(workspace);

    expect(result).toEqual({
      ok: true,
      changes: [
        { path: "README.md", status: "modified" },
        { path: "notes.txt", status: "untracked" }
      ]
    });
    expect(JSON.stringify(result)).not.toContain(root);
  });

  it("reads a tracked file diff by relative path", async () => {
    const { root, workspace } = await createGitWorkspace();
    await writeFile(join(root, "README.md"), "line one\nline two changed\n", "utf8");

    const result = await readWorkspaceDiff(workspace, "README.md");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.path).toBe("README.md");
    expect(result.diff).toContain("--- a/README.md");
    expect(result.diff).toContain("+++ b/README.md");
    expect(result.diff).toContain("-line two");
    expect(result.diff).toContain("+line two changed");
    expect(result.diff).not.toContain(root);
  });

  it("returns a virtual diff for untracked text files", async () => {
    const { root, workspace } = await createGitWorkspace();
    await writeFile(join(root, "notes.txt"), "new note\n", "utf8");

    const result = await readWorkspaceDiff(workspace, "notes.txt");

    expect(result).toEqual({
      ok: true,
      path: "notes.txt",
      diff: [
        "diff --git a/notes.txt b/notes.txt",
        "new file mode 100644",
        "--- /dev/null",
        "+++ b/notes.txt",
        "@@ -0,0 +1 @@",
        "+new note",
        ""
      ].join("\n")
    });
  });

  it("rejects diff paths that escape the workspace", async () => {
    const { workspace } = await createGitWorkspace();

    const result = await readWorkspaceDiff(workspace, "../outside.txt");

    expect(result).toEqual({ ok: false, error: "Path escapes workspace root" });
  });

  it("returns a structured error for non-git workspaces", async () => {
    const root = await mkdtemp(join(tmpdir(), "harness-diff-plain-"));
    const workspace = { id: "plain", name: "Plain", root, allowedCommands: [] };

    const result = await listWorkspaceChanges(workspace);

    expect(result).toEqual({ ok: false, error: "Workspace is not a git repository" });
  });
});
