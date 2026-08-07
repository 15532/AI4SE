import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { resolveWorkspacePath, type WorkspaceConfig } from "./workspace.js";

export type WorkspaceFileEntry = { path: string; kind: "file" | "directory" };

const ignoredDirectoryNames = new Set([".git", "node_modules", "dist", "coverage"]);
const ignoredEntryNames = new Set([".git", "node_modules", "dist", "coverage"]);
const defaultFileLimit = 200 * 1024;

function toPortablePath(value: string): string {
  return value.split(path.sep).join("/");
}

function isWithinPath(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function resolveReadablePath(workspace: WorkspaceConfig, relativePath: string): Promise<{ ok: true; absolutePath: string } | { ok: false; error: string }> {
  const resolved = resolveWorkspacePath(workspace, relativePath);
  if (!resolved.ok) {
    return { ok: false, error: resolved.reason };
  }

  try {
    const [root, target] = await Promise.all([realpath(workspace.root), realpath(resolved.absolutePath)]);
    return isWithinPath(root, target)
      ? { ok: true, absolutePath: resolved.absolutePath }
      : { ok: false, error: "Path escapes workspace root" };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { ok: false, error: code === "ENOENT" ? "Path does not exist" : String(error) };
  }
}

async function walk(root: string, current: string, entries: WorkspaceFileEntry[], limit: number): Promise<void> {
  if (entries.length >= limit) return;

  const children = await readdir(current, { withFileTypes: true });
  children.sort((left, right) => left.name.localeCompare(right.name));

  for (const child of children) {
    if (entries.length >= limit) return;
    if (ignoredEntryNames.has(child.name)) continue;
    if (child.isDirectory() && ignoredDirectoryNames.has(child.name)) continue;

    const absolutePath = path.join(current, child.name);
    const relativePath = toPortablePath(path.relative(root, absolutePath));
    if (child.isDirectory()) {
      entries.push({ path: relativePath, kind: "directory" });
      await walk(root, absolutePath, entries, limit);
    } else if (child.isFile()) {
      entries.push({ path: relativePath, kind: "file" });
    }
  }
}

export async function listWorkspaceFiles(
  workspace: WorkspaceConfig,
  options: { limit?: number } = {}
): Promise<WorkspaceFileEntry[]> {
  const limit = options.limit ?? 200;
  const root = await realpath(workspace.root);
  const entries: WorkspaceFileEntry[] = [];
  await walk(root, root, entries, limit);
  return entries;
}

export async function readWorkspaceTextFile(
  workspace: WorkspaceConfig,
  relativePath: string,
  options: { maxBytes?: number } = {}
): Promise<{ ok: true; path: string; content: string } | { ok: false; error: string }> {
  const resolved = await resolveReadablePath(workspace, relativePath);
  if (!resolved.ok) {
    return resolved;
  }

  const metadata = await stat(resolved.absolutePath);
  if (!metadata.isFile()) {
    return { ok: false, error: "Path is not a file" };
  }
  if (metadata.size > (options.maxBytes ?? defaultFileLimit)) {
    return { ok: false, error: "File is too large to preview" };
  }

  return {
    ok: true,
    path: toPortablePath(path.relative(await realpath(workspace.root), resolved.absolutePath)),
    content: await readFile(resolved.absolutePath, "utf8")
  };
}
