import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { readWorkspaceTextFile } from "./workspace-explorer.js";
import { resolveWorkspacePath, type WorkspaceConfig } from "./workspace.js";

export type WorkspaceChangeStatus =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked"
  | "typechange"
  | "unknown";

export type WorkspaceChange = { path: string; status: WorkspaceChangeStatus };

const execFileAsync = promisify(execFile);
const defaultDiffLimit = 200 * 1024;

function toPortablePath(value: string): string {
  return value.split(path.sep).join("/");
}

function statusFromPorcelain(code: string): WorkspaceChangeStatus {
  if (code === "??") return "untracked";
  if (code.includes("R")) return "renamed";
  if (code.includes("D")) return "deleted";
  if (code.includes("A")) return "added";
  if (code.includes("T")) return "typechange";
  if (code.includes("M")) return "modified";
  return "unknown";
}

function statusPriority(status: WorkspaceChangeStatus): number {
  switch (status) {
    case "modified": return 0;
    case "added": return 1;
    case "deleted": return 2;
    case "renamed": return 3;
    case "typechange": return 4;
    case "untracked": return 5;
    case "unknown": return 6;
  }
}

function parseStatus(output: string): WorkspaceChange[] {
  return output
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const rawPath = line.slice(3);
      const renameTarget = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1) ?? rawPath : rawPath;
      return {
        path: renameTarget,
        status: statusFromPorcelain(line.slice(0, 2))
      };
    })
    .sort((left, right) => {
      const priority = statusPriority(left.status) - statusPriority(right.status);
      if (priority !== 0) return priority;
      const leftPath = left.path.toLowerCase();
      const rightPath = right.path.toLowerCase();
      if (leftPath === rightPath) return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
      return leftPath < rightPath ? -1 : 1;
    });
}

function gitError(error: unknown): string {
  const stderr = typeof error === "object" && error !== null && "stderr" in error
    ? String((error as { stderr?: unknown }).stderr)
    : "";
  return stderr.includes("not a git repository")
    ? "Workspace is not a git repository"
    : "Git command failed";
}

async function runGit(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", root, ...args], {
    maxBuffer: defaultDiffLimit * 2,
    windowsHide: true
  });
  return stdout;
}

function isSamePath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

async function resolveGitRoot(workspace: WorkspaceConfig): Promise<{ ok: true; root: string } | { ok: false; error: string }> {
  try {
    const root = await realpath(workspace.root);
    const topLevel = (await runGit(root, ["rev-parse", "--show-toplevel"])).trim();
    return isSamePath(root, topLevel)
      ? { ok: true, root }
      : { ok: false, error: "Workspace is not a git repository" };
  } catch {
    return { ok: false, error: "Workspace is not a git repository" };
  }
}

function resolveRelativePath(workspace: WorkspaceConfig, relativePath: string): { ok: true; path: string } | { ok: false; error: string } {
  const resolved = resolveWorkspacePath(workspace, relativePath);
  if (!resolved.ok) return { ok: false, error: resolved.reason };
  return { ok: true, path: toPortablePath(relativePath) };
}

export async function listWorkspaceChanges(
  workspace: WorkspaceConfig
): Promise<{ ok: true; changes: WorkspaceChange[] } | { ok: false; error: string }> {
  const root = await resolveGitRoot(workspace);
  if (!root.ok) return root;

  try {
    const output = await runGit(root.root, ["status", "--porcelain=v1"]);
    return { ok: true, changes: parseStatus(output) };
  } catch (error) {
    return { ok: false, error: gitError(error) };
  }
}

function virtualUntrackedDiff(relativePath: string, content: string): string {
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  const range = lines.length === 1 ? "+1" : `+1,${lines.length}`;
  return [
    `diff --git a/${relativePath} b/${relativePath}`,
    "new file mode 100644",
    "--- /dev/null",
    `+++ b/${relativePath}`,
    `@@ -0,0 ${range} @@`,
    ...lines.map((line) => `+${line}`),
    ""
  ].join("\n");
}

export async function readWorkspaceDiff(
  workspace: WorkspaceConfig,
  relativePath: string,
  options: { maxBytes?: number } = {}
): Promise<{ ok: true; path: string; diff: string } | { ok: false; error: string }> {
  const pathResult = resolveRelativePath(workspace, relativePath);
  if (!pathResult.ok) return pathResult;

  const changes = await listWorkspaceChanges(workspace);
  if (!changes.ok) return changes;

  const change = changes.changes.find((entry) => entry.path === pathResult.path);
  if (change === undefined) return { ok: false, error: "File has no diff" };

  if (change.status === "untracked") {
    const file = await readWorkspaceTextFile(workspace, pathResult.path, { maxBytes: options.maxBytes ?? defaultDiffLimit });
    if (!file.ok) return file;
    const diff = virtualUntrackedDiff(pathResult.path, file.content);
    return diff.length > (options.maxBytes ?? defaultDiffLimit)
      ? { ok: false, error: "Diff is too large to preview" }
      : { ok: true, path: pathResult.path, diff };
  }

  const root = await resolveGitRoot(workspace);
  if (!root.ok) return root;

  try {
    const diff = await runGit(root.root, ["diff", "--no-ext-diff", "--", pathResult.path]);
    if (diff === "") return { ok: false, error: "File has no diff" };
    if (diff.length > (options.maxBytes ?? defaultDiffLimit)) {
      return { ok: false, error: "Diff is too large to preview" };
    }
    return { ok: true, path: pathResult.path, diff };
  } catch (error) {
    return { ok: false, error: gitError(error) };
  }
}
