import type { KeychainAdapter } from "./keychain-adapter.js";

const SERVICE = "coding-agent-harness";

function environmentName(provider: string): string {
  return `${provider.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_API_KEY`;
}

export class CredentialManager {
  constructor(
    private readonly adapter: KeychainAdapter,
    private readonly options: { allowEnvFallback?: boolean } = {}
  ) {}

  async status(provider: string): Promise<{ provider: string; exists: boolean; source?: "keychain" | "env" }> {
    const keychainValue = await this.adapter.get(SERVICE, provider);
    if (keychainValue !== undefined) {
      return { provider, exists: true, source: "keychain" };
    }

    if (this.options.allowEnvFallback && process.env[environmentName(provider)] !== undefined) {
      return { provider, exists: true, source: "env" };
    }

    return { provider, exists: false };
  }

  async set(provider: string, value: string): Promise<void> {
    await this.adapter.set(SERVICE, provider, value);
  }

  async clear(provider: string): Promise<void> {
    await this.adapter.delete(SERVICE, provider);
  }
}
