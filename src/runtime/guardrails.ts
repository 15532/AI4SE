import type { Action } from "../core/actions.js";
import { resolveWorkspacePath, type WorkspaceConfig } from "./workspace.js";

export type GuardrailDecision =
  | { decision: "allow" }
  | { decision: "block"; reason: string; ruleId: string }
  | { decision: "require_approval"; reason: string; ruleId: string };

const destructiveDeletePattern = /(?:\brm\s+-[^\s]*[rf][^\s]*|\bdel\s+\/s\b|\bremove-item\b[^\r\n]*\s-recurse\b)/i;
const publishOrDeployPattern = /\b(?:git\s+push|npm\s+publish|docker\s+push|deploy(?:ment)?|kubectl\s+apply)\b/i;
const secretPathPattern = /(^|[\\/\s"'])(?:\.env(?:\.[\w.-]+)?|id_(?:rsa|ed25519|ecdsa)|[^\\/\s"']+\.(?:pem|key|p12|pfx)|(?:secrets?|credentials?|tokens?)(?:\.[\w.-]+)?)(?=$|[\\/\s"'])/i;
const secretContentPattern = /(?:api[_-]?key|secret|token|password|private[_-]?key)\s*[:=]/i;

function block(reason: string, ruleId: string): GuardrailDecision {
  return { decision: "block", reason, ruleId };
}

function isSecretPath(value: string): boolean {
  return secretPathPattern.test(value);
}

function actionPath(action: Action): string | undefined {
  if (action.type === "read_file" || action.type === "write_file" || action.type === "list_files") {
    return action.path;
  }

  return undefined;
}

export function classifyAction(action: Action, workspace: WorkspaceConfig): GuardrailDecision {
  if (action.type === "run_command" && destructiveDeletePattern.test(action.command)) {
    return block("Destructive delete commands are not allowed", "command.destructive_delete");
  }

  if (
    (action.type === "read_file" && isSecretPath(action.path))
    || (action.type === "run_command" && isSecretPath(action.command))
  ) {
    return block("Secret files cannot be read or printed", "command.secret_access");
  }

  if (action.type === "write_file" && (isSecretPath(action.path) || secretContentPattern.test(action.content))) {
    return block("Sensitive files cannot be written", "write.sensitive_file");
  }

  const filePath = actionPath(action);
  if (filePath !== undefined && !resolveWorkspacePath(workspace, filePath).ok) {
    return block("Path escapes workspace root", "path.escape_workspace");
  }

  if (action.type === "run_command" && publishOrDeployPattern.test(action.command)) {
    return block("Publish and deploy commands are not allowed in v1", "command.publish_or_deploy");
  }

  if (action.type === "run_command" && !workspace.allowedCommands.includes(action.command)) {
    return block("Command is not in the workspace allowlist", "command.not_allowlisted");
  }

  return { decision: "allow" };
}
