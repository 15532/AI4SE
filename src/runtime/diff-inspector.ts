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

function stripWorkspacePrefix(relativePath: string, workspacePrefix: string): string | undefined {
  if (workspacePrefix === "") return relativePath;
  return relativePath === workspacePrefix
    ? ""
    : relativePath.startsWith(`${workspacePrefix}/`)
      ? relativePath.slice(workspacePrefix.length + 1)
      : undefined;
}

function parseStatus(output: string, workspacePrefix = ""): WorkspaceChange[] {
  return output
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .flatMap((line) => {
      const rawPath = line.slice(3);
      const renameTarget = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1) ?? rawPath : rawPath;
      const path = stripWorkspacePrefix(toPortablePath(renameTarget), workspacePrefix);
      if (path === undefined || path === "") return [];
      return {
        path,
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

function isWithinPath(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function resolveGitContext(workspace: WorkspaceConfig): Promise<
  { ok: true; gitRoot: string; workspaceRoot: string; workspacePrefix: string }
  | { ok: false; error: string }
> {
  try {
    const workspaceRoot = await realpath(workspace.root);
    const gitRoot = await realpath((await runGit(workspaceRoot, ["rev-parse", "--show-toplevel"])).trim());
    if (!isSamePath(workspaceRoot, gitRoot) && !isWithinPath(gitRoot, workspaceRoot)) {
      return { ok: false, error: "Workspace is not a git repository" };
    }
    return {
      ok: true,
      gitRoot,
      workspaceRoot,
      workspacePrefix: toPortablePath(path.relative(gitRoot, workspaceRoot))
    };
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
  const context = await resolveGitContext(workspace);
  if (!context.ok) return context;

  try {
    const pathspec = context.workspacePrefix === "" ? "." : context.workspacePrefix;
    const output = await runGit(context.gitRoot, ["status", "--porcelain=v1", "--untracked-files=all", "--", pathspec]);
    return { ok: true, changes: parseStatus(output, context.workspacePrefix) };
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

  const context = await resolveGitContext(workspace);
  if (!context.ok) return context;

  try {
    const gitRelativePath = context.workspacePrefix === ""
      ? pathResult.path
      : `${context.workspacePrefix}/${pathResult.path}`;
    const diff = await runGit(context.gitRoot, ["diff", "--no-ext-diff", "--", gitRelativePath]);
    if (diff === "") return { ok: false, error: "File has no diff" };
    if (diff.length > (options.maxBytes ?? defaultDiffLimit)) {
      return { ok: false, error: "Diff is too large to preview" };
    }
    return { ok: true, path: pathResult.path, diff };
  } catch (error) {
    return { ok: false, error: gitError(error) };
  }
}
