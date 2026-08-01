import { describe, expect, it } from "vitest";
import { classifyAction } from "../../src/runtime/guardrails";

const workspace = {
  id: "demo-ts",
  name: "TypeScript Demo",
  root: process.cwd(),
  allowedCommands: ["npm test", "npm run build"]
};

describe("classifyAction", () => {
  it("blocks destructive delete commands", () => {
    expect(classifyAction({ type: "run_command", command: "rm -rf .", reason: "cleanup" }, workspace)).toEqual({
      decision: "block",
      reason: "Destructive delete commands are not allowed",
      ruleId: "command.destructive_delete"
    });
  });

  it("prioritizes destructive deletes over other command rules", () => {
    expect(classifyAction({ type: "run_command", command: "rm -rf . && git push", reason: "cleanup" }, workspace)).toEqual({
      decision: "block",
      reason: "Destructive delete commands are not allowed",
      ruleId: "command.destructive_delete"
    });
  });

  it("blocks publish and deploy commands before allowlist checks", () => {
    expect(classifyAction({ type: "run_command", command: "git push", reason: "publish" }, workspace)).toEqual({
      decision: "block",
      reason: "Publish and deploy commands are not allowed in v1",
      ruleId: "command.publish_or_deploy"
    });
  });

  it("blocks secret access", () => {
    expect(classifyAction({ type: "read_file", path: ".env", reason: "inspect config" }, workspace)).toEqual({
      decision: "block",
      reason: "Secret files cannot be read or printed",
      ruleId: "command.secret_access"
    });
  });

  it("blocks sensitive writes before path escape checks", () => {
    expect(classifyAction({ type: "write_file", path: "../.env", content: "TOKEN=value", reason: "configure" }, workspace)).toEqual({
      decision: "block",
      reason: "Sensitive files cannot be written",
      ruleId: "write.sensitive_file"
    });
  });

  it("blocks paths that escape the workspace", () => {
    expect(classifyAction({ type: "list_files", path: "../outside", reason: "inspect" }, workspace)).toEqual({
      decision: "block",
      reason: "Path escapes workspace root",
      ruleId: "path.escape_workspace"
    });
  });

  it("requires an exact command allowlist match", () => {
    expect(classifyAction({ type: "run_command", command: "npm test -- --runInBand", reason: "verify" }, workspace)).toEqual({
      decision: "block",
      reason: "Command is not in the workspace allowlist",
      ruleId: "command.not_allowlisted"
    });
  });

  it("allows allowlisted commands", () => {
    expect(classifyAction({ type: "run_command", command: "npm test", reason: "verify" }, workspace)).toEqual({
      decision: "allow"
    });
  });
});
