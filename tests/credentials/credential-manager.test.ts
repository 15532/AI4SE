import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CredentialManager } from "../../src/credentials/credential-manager";
import { EncryptedFileKeychainAdapter, InMemoryKeychainAdapter } from "../../src/credentials/keychain-adapter";

describe("CredentialManager", () => {
  it("reports status without revealing secret value", async () => {
    const adapter = new InMemoryKeychainAdapter();
    const manager = new CredentialManager(adapter);

    await manager.set("openai-compatible", "sk-test-secret");

    await expect(manager.status("openai-compatible")).resolves.toEqual({
      provider: "openai-compatible",
      exists: true,
      source: "keychain"
    });
    await expect(manager.status("openai-compatible")).resolves.not.toHaveProperty("value");
  });

  it("clears stored credentials", async () => {
    const adapter = new InMemoryKeychainAdapter();
    const manager = new CredentialManager(adapter);

    await manager.set("openai-compatible", "sk-test-secret");
    await manager.clear("openai-compatible");

    await expect(manager.status("openai-compatible")).resolves.toEqual({
      provider: "openai-compatible",
      exists: false
    });
  });

  it("does not use an environment credential by default", async () => {
    const key = "OPENAI_COMPATIBLE_API_KEY";
    const previous = process.env[key];
    process.env[key] = "sk-env-secret";

    try {
      const manager = new CredentialManager(new InMemoryKeychainAdapter());
      await expect(manager.status("openai-compatible")).resolves.toEqual({
        provider: "openai-compatible",
        exists: false
      });
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  it("reports an environment credential without revealing its value when enabled", async () => {
    const key = "OPENAI_COMPATIBLE_API_KEY";
    const previous = process.env[key];
    process.env[key] = "sk-env-secret";

    try {
      const manager = new CredentialManager(new InMemoryKeychainAdapter(), { allowEnvFallback: true });
      await expect(manager.status("openai-compatible")).resolves.toEqual({
        provider: "openai-compatible",
        exists: true,
        source: "env"
      });
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  it("prefers keychain credentials over environment credentials", async () => {
    const key = "OPENAI_COMPATIBLE_API_KEY";
    const previous = process.env[key];
    process.env[key] = "sk-env-secret";

    try {
      const adapter = new InMemoryKeychainAdapter();
      const manager = new CredentialManager(adapter, { allowEnvFallback: true });
      await manager.set("openai-compatible", "sk-keychain-secret");

      await expect(manager.status("openai-compatible")).resolves.toEqual({
        provider: "openai-compatible",
        exists: true,
        source: "keychain"
      });
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  it("clears only keychain credentials and leaves environment credentials intact", async () => {
    const key = "OPENAI_COMPATIBLE_API_KEY";
    const previous = process.env[key];
    process.env[key] = "sk-env-secret";

    try {
      const adapter = new InMemoryKeychainAdapter();
      const manager = new CredentialManager(adapter, { allowEnvFallback: true });
      await manager.set("openai-compatible", "sk-keychain-secret");
      await manager.clear("openai-compatible");

      await expect(manager.status("openai-compatible")).resolves.toEqual({
        provider: "openai-compatible",
        exists: true,
        source: "env"
      });
      expect(process.env[key]).toBe("sk-env-secret");
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  it("maps provider names deterministically for environment credentials", async () => {
    const key = "OPENAI_COMPATIBLE_API_KEY";
    const previous = process.env[key];
    process.env[key] = "sk-env-secret";

    try {
      const manager = new CredentialManager(new InMemoryKeychainAdapter(), { allowEnvFallback: true });
      await expect(manager.status("openai-compatible")).resolves.toEqual({
        provider: "openai-compatible",
        exists: true,
        source: "env"
      });
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  it("returns keychain credential values before environment fallback for provider requests", async () => {
    const key = "DEEPSEEK_API_KEY";
    const previous = process.env[key];
    process.env[key] = "env-secret";

    try {
      const adapter = new InMemoryKeychainAdapter();
      const manager = new CredentialManager(adapter, { allowEnvFallback: true });
      await manager.set("deepseek", "stored-secret");

      await expect(manager.resolve("deepseek", "DEEPSEEK_API_KEY")).resolves.toBe("stored-secret");
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });
});

describe("InMemoryKeychainAdapter", () => {
  it("stores values by service and account", async () => {
    const adapter = new InMemoryKeychainAdapter();

    await adapter.set("service-a", "account-a", "secret-a");
    await adapter.set("service-a", "account-b", "secret-b");

    await expect(adapter.get("service-a", "account-a")).resolves.toBe("secret-a");
    await expect(adapter.get("service-a", "account-b")).resolves.toBe("secret-b");
    await expect(adapter.get("service-b", "account-a")).resolves.toBeUndefined();
  });
});

describe("EncryptedFileKeychainAdapter", () => {
  it("persists encrypted credentials without storing plaintext", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-credentials-"));
    const storePath = join(dir, "credentials.enc.json");

    const first = new EncryptedFileKeychainAdapter({
      storePath,
      masterPassword: "correct horse battery staple"
    });
    await first.set("coding-agent-harness", "deepseek", "ds-test-secret-value");

    const raw = await readFile(storePath, "utf8");
    expect(raw).not.toContain("ds-test-secret-value");
    expect(raw).not.toContain("deepseek");

    const second = new EncryptedFileKeychainAdapter({
      storePath,
      masterPassword: "correct horse battery staple"
    });
    await expect(second.get("coding-agent-harness", "deepseek")).resolves.toBe("ds-test-secret-value");
  });

  it("requires a master password before reading or writing encrypted credentials", async () => {
    const dir = await mkdtemp(join(tmpdir(), "harness-credentials-"));
    const adapter = new EncryptedFileKeychainAdapter({ storePath: join(dir, "credentials.enc.json") });

    await expect(adapter.set("coding-agent-harness", "deepseek", "secret"))
      .rejects.toThrow("HARNESS_MASTER_PASSWORD is required");
  });
});
