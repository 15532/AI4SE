import { exec } from "node:child_process";
import { mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { Action } from "../core/actions";
import { resolveWorkspacePath, type WorkspaceConfig } from "./workspace";

const execCommand = promisify(exec);

export type ToolResult = {
  ok: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
};

function isWithinPath(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function realpathExistingAncestor(target: string): Promise<string> {
  let candidate = target;

  while (true) {
    try {
      return await realpath(candidate);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") {
        throw error;
      }

      const parent = path.dirname(candidate);
      if (parent === candidate) {
        throw error;
      }
      candidate = parent;
    }
  }
}

async function resolvePath(action: Action, workspace: WorkspaceConfig): Promise<ToolResult | string> {
  if (action.type !== "read_file" && action.type !== "write_file" && action.type !== "list_files") {
    throw new Error("Only file actions can resolve a workspace path");
  }

  const resolution = resolveWorkspacePath(workspace, action.path);
  if (!resolution.ok) {
    return { ok: false, error: resolution.reason };
  }

  const [canonicalRoot, canonicalAncestor] = await Promise.all([
    realpath(workspace.root),
    realpathExistingAncestor(resolution.absolutePath)
  ]);
  return isWithinPath(canonicalRoot, canonicalAncestor)
    ? resolution.absolutePath
    : { ok: false, error: "Path escapes workspace root" };
}

function errorResult(error: unknown): ToolResult {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

async function runCommand(command: string, workspace: WorkspaceConfig): Promise<ToolResult> {
  if (!workspace.allowedCommands.includes(command)) {
    return { ok: false, error: "Command is not in the workspace allowlist" };
  }

  try {
    const { stdout, stderr } = await execCommand(command, { cwd: workspace.root });
    return { ok: true, stdout, stderr, exitCode: 0 };
  } catch (error) {
    const commandError = error as { code?: number; stdout?: string; stderr?: string };
    return {
      ok: false,
      stdout: commandError.stdout,
      stderr: commandError.stderr,
      exitCode: commandError.code,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function dispatchTool(action: Action, workspace: WorkspaceConfig): Promise<ToolResult> {
  try {
    switch (action.type) {
      case "read_file": {
        const target = await resolvePath(action, workspace);
        return typeof target === "string"
          ? { ok: true, stdout: await readFile(target, "utf8") }
          : target;
      }
      case "write_file": {
        const target = await resolvePath(action, workspace);
        if (typeof target !== "string") {
          return target;
        }

        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, action.content, "utf8");
        return { ok: true };
      }
      case "list_files": {
        const target = await resolvePath(action, workspace);
        return typeof target === "string"
          ? { ok: true, stdout: (await readdir(target)).join("\n") }
          : target;
      }
      case "run_command":
        return runCommand(action.command, workspace);
      case "remember":
        return { ok: false, error: "Memory store is not available in this task" };
      case "finish":
        return { ok: true };
    }
  } catch (error) {
    return errorResult(error);
  }
}
