import type { Action } from "../core/actions.js";
import { classifyAction } from "./guardrails.js";
import { dispatchTool } from "./tools.js";
import { readWorkspaceTextFile } from "./workspace-explorer.js";
import type { WorkspaceConfig } from "./workspace.js";

export type SaveWorkspaceTextFileResult =
  | { ok: true; path: string }
  | { ok: false; error: string; ruleId?: string };

export async function saveWorkspaceTextFile(
  workspace: WorkspaceConfig,
  relativePath: string,
  content: string
): Promise<SaveWorkspaceTextFileResult> {
  const action: Action = {
    type: "write_file",
    path: relativePath,
    content,
    reason: "Saved from browser workspace editor"
  };
  const guardrail = classifyAction(action, workspace);
  if (guardrail.decision !== "allow") {
    return { ok: false, error: guardrail.reason, ruleId: guardrail.ruleId };
  }

  const result = await dispatchTool(action, workspace);
  if (!result.ok) {
    return { ok: false, error: result.error ?? "File save failed" };
  }

  const saved = await readWorkspaceTextFile(workspace, relativePath);
  return saved.ok
    ? { ok: true, path: saved.path }
    : { ok: false, error: saved.error };
}
