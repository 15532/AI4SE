import { describe, expect, it } from "vitest";
import { runCli } from "../../src/cli/main";
import { runMechanismDemo } from "../../src/demo/mechanisms";

function outputBuffer(): { write(chunk: string): boolean; text(): string } {
  let value = "";
  return {
    write(chunk: string): boolean {
      value += chunk;
      return true;
    },
    text(): string {
      return value;
    }
  };
}

describe("mechanism demo", () => {
  it("shows guardrail block and feedback-driven correction", async () => {
    const result = await runMechanismDemo();

    expect(result.events.map((event) => event.kind)).toContain("guardrail.blocked");
    expect(result.events.map((event) => event.kind)).toContain("feedback.test_failed");
    expect(result.events.map((event) => event.kind)).toContain("action.write_file");
  });

  it("does not include secret-shaped values in the timeline", async () => {
    const result = await runMechanismDemo();

    expect(JSON.stringify(result)).not.toMatch(/sk-[A-Za-z0-9_-]+/);
  });
});

describe("CLI", () => {
  it("writes the demo timeline as JSON", async () => {
    const stdout = outputBuffer();
    const stderr = outputBuffer();

    await runCli(["demo"], { stdout, stderr, env: {} });

    expect(JSON.parse(stdout.text())).toMatchObject({ events: expect.any(Array) });
    expect(stderr.text()).toBe("");
  });

  it("reports credential status without exposing the environment value", async () => {
    const stdout = outputBuffer();
    const secret = "sk-cli-status-secret";

    await runCli(["credentials", "status", "--provider", "openai"], {
      stdout,
      stderr: outputBuffer(),
      env: { OPENAI_API_KEY: secret }
    });

    expect(stdout.text()).toContain('"exists":true');
    expect(stdout.text()).toContain('"source":"env"');
    expect(stdout.text()).not.toContain(secret);
  });
});
