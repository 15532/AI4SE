import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type KeychainAdapter = {
  get(service: string, account: string): Promise<string | undefined>;
  set(service: string, account: string, value: string): Promise<void>;
  delete(service: string, account: string): Promise<void>;
};

export class InMemoryKeychainAdapter implements KeychainAdapter {
  private readonly values = new Map<string, Map<string, string>>();

  async get(service: string, account: string): Promise<string | undefined> {
    return this.values.get(service)?.get(account);
  }

  async set(service: string, account: string, value: string): Promise<void> {
    let accounts = this.values.get(service);
    if (!accounts) {
      accounts = new Map<string, string>();
      this.values.set(service, accounts);
    }
    accounts.set(account, value);
  }

  async delete(service: string, account: string): Promise<void> {
    const accounts = this.values.get(service);
    if (!accounts) return;

    accounts.delete(account);
    if (accounts.size === 0) this.values.delete(service);
  }
}

type EncryptedCredentialFile = {
  version: 1;
  kdf: "scrypt";
  algorithm: "aes-256-gcm";
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

type CredentialMap = Record<string, Record<string, string>>;

function credentialKey(masterPassword: string, salt: Buffer): Buffer {
  return scryptSync(masterPassword, salt, 32);
}

function requireMasterPassword(masterPassword: string | undefined): string {
  if (masterPassword === undefined || masterPassword.trim() === "") {
    throw new Error("HARNESS_MASTER_PASSWORD is required for encrypted credential storage");
  }
  return masterPassword;
}

export class EncryptedFileKeychainAdapter implements KeychainAdapter {
  constructor(private readonly input: {
    storePath: string;
    masterPassword?: string;
  }) {}

  async get(service: string, account: string): Promise<string | undefined> {
    const values = await this.readValues();
    return values[service]?.[account];
  }

  async set(service: string, account: string, value: string): Promise<void> {
    const values = await this.readValues();
    values[service] = { ...(values[service] ?? {}), [account]: value };
    await this.writeValues(values);
  }

  async delete(service: string, account: string): Promise<void> {
    const values = await this.readValues();
    if (values[service] === undefined) return;
    delete values[service][account];
    if (Object.keys(values[service]).length === 0) delete values[service];
    await this.writeValues(values);
  }

  private async readValues(): Promise<CredentialMap> {
    let raw: string;
    try {
      raw = await readFile(this.input.storePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw error;
    }
    const masterPassword = requireMasterPassword(this.input.masterPassword);
    const file = JSON.parse(raw) as EncryptedCredentialFile;
    const decipher = createDecipheriv(
      file.algorithm,
      credentialKey(masterPassword, Buffer.from(file.salt, "base64")),
      Buffer.from(file.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(file.tag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(file.ciphertext, "base64")),
      decipher.final()
    ]).toString("utf8");
    return JSON.parse(plaintext) as CredentialMap;
  }

  private async writeValues(values: CredentialMap): Promise<void> {
    const masterPassword = requireMasterPassword(this.input.masterPassword);
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", credentialKey(masterPassword, salt), iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(values), "utf8"),
      cipher.final()
    ]);
    const file: EncryptedCredentialFile = {
      version: 1,
      kdf: "scrypt",
      algorithm: "aes-256-gcm",
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64")
    };
    await mkdir(dirname(this.input.storePath), { recursive: true });
    await writeFile(this.input.storePath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  }
}
