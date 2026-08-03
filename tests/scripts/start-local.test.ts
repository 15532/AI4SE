import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const scriptPath = resolve("scripts/start-local.ps1");

describe("local startup script", () => {
  test("documents the one-command local WebUI startup flow", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("param(");
    expect(script).toContain("[int]$Port = 3000");
    expect(script).toContain("npm ci");
    expect(script).toContain("npm run build");
    expect(script).toContain("data");
    expect(script).toContain("HARNESS_CONFIG_PATH");
    expect(script).toContain("HARNESS_DB_PATH");
    expect(script).toContain("HARNESS_CREDENTIAL_STORE_PATH");
    expect(script).toContain("dist/src/web/server.js");
  });
});
