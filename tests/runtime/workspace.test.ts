import { describe, expect, it } from "vitest";
import { resolveWorkspacePath } from "../../src/runtime/workspace";

const workspace = {
  id: "demo",
  name: "Demo",
  root: process.cwd(),
  allowedCommands: []
};

describe("resolveWorkspacePath", () => {
  it("allows dot as the workspace root", () => {
    const result = resolveWorkspacePath(workspace, ".");
    expect(result.ok).toBe(true);
  });

  it("treats an empty path as the workspace root", () => {
    const result = resolveWorkspacePath(workspace, "");
    expect(result.ok).toBe(true);
  });

  it("rejects parent traversal", () => {
    expect(resolveWorkspacePath(workspace, "../outside")).toEqual({
      ok: false,
      reason: "Path escapes workspace root"
    });
  });

  it("rejects absolute paths outside the workspace", () => {
    expect(resolveWorkspacePath(workspace, "C:\\Windows")).toEqual({
      ok: false,
      reason: "Path escapes workspace root"
    });
  });
});
