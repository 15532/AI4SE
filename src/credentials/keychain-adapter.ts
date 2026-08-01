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
