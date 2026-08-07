import { cp, mkdir, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceConfig } from "./workspace.js";

export type WorkspaceResetResult =
  | { ok: true; action: "reset" | "unchanged" }
  | { ok: false; error: string };

async function realpathOrNull(target: string): Promise<string | null> {
  try {
    return await realpath(target);
  } catch {
    return null;
  }
}

function isSamePath(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === "win32"
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

/**
 * Reset a workspace directory to the initial template found under `templateRoot/<workspaceId>`.
 *
 * Safety rules:
 * - If the template directory is missing, the workspace is left untouched.
 * - If the workspace root already is the template directory (local dev usually), it is a no-op.
 * - Only the contents of the workspace root are removed; the root itself is preserved.
 */
export async function resetWorkspaceToTemplate(
  workspace: WorkspaceConfig,
  templateRoot: string
): Promise<WorkspaceResetResult> {
  const workspaceRoot = path.resolve(workspace.root);
  const templateDir = path.resolve(templateRoot, workspace.id);

  const templateReal = await realpathOrNull(templateDir);
  if (templateReal === null) {
    return { ok: false, error: `Template directory does not exist: ${templateDir}` };
  }

  const workspaceReal = await realpathOrNull(workspaceRoot);
  if (workspaceReal === null) {
    await mkdir(workspaceRoot, { recursive: true });
    await cp(templateReal, workspaceRoot, { recursive: true });
    return { ok: true, action: "reset" };
  }

  if (isSamePath(workspaceReal, templateReal)) {
    return { ok: true, action: "unchanged" };
  }

  const entries = await readdir(workspaceReal);
  await Promise.all(entries.map((entry) => rm(path.join(workspaceReal, entry), { recursive: true, force: true })));
  await cp(templateReal, workspaceReal, { recursive: true });
  return { ok: true, action: "reset" };
}
