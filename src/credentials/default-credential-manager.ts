import { resolve } from "node:path";
import { CredentialManager } from "./credential-manager.js";
import { EncryptedFileKeychainAdapter } from "./keychain-adapter.js";

export function createDefaultCredentialManager(env: NodeJS.ProcessEnv = process.env): CredentialManager {
  return new CredentialManager(new EncryptedFileKeychainAdapter({
    storePath: resolve(env.HARNESS_CREDENTIAL_STORE_PATH ?? "data/credentials.enc.json"),
    masterPassword: env.HARNESS_MASTER_PASSWORD
  }), { allowEnvFallback: true });
}
