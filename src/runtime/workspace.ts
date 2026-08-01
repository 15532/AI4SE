import path from "node:path";

export type WorkspaceConfig = {
  id: string;
  name: string;
  root: string;
  allowedCommands: string[];
};

export type WorkspacePathResolution =
  | { ok: true; absolutePath: string }
  | { ok: false; reason: string };

function pathApiFor(root: string): typeof path.win32 | typeof path.posix {
  return path.win32.isAbsolute(root) || /^[a-zA-Z]:/.test(root) ? path.win32 : path.posix;
}

export function resolveWorkspacePath(
  workspace: WorkspaceConfig,
  relativePath: string
): WorkspacePathResolution {
  const pathApi = pathApiFor(workspace.root);
  const root = pathApi.resolve(workspace.root);
  const target = pathApi.resolve(root, relativePath || ".");
  const comparableRoot = pathApi === path.win32 ? root.toLowerCase() : root;
  const comparableTarget = pathApi === path.win32 ? target.toLowerCase() : target;

  if (comparableTarget !== comparableRoot && !comparableTarget.startsWith(`${comparableRoot}${pathApi.sep}`)) {
    return { ok: false, reason: "Path escapes workspace root" };
  }

  return { ok: true, absolutePath: target };
}
