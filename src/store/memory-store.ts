import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { schemaSql } from "./schema.js";
import { isSensitiveKey, redactSensitiveString } from "./redaction.js";

type Memory = { key: string; value: string };

export class MemoryStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") mkdirSync(dirname(resolve(dbPath)), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec(schemaSql);
  }

  remember(input: { workspaceId: string; scope: "workspace" | "global"; key: string; value: string }): void {
    const key = redactSensitiveString(input.key);
    const value = isSensitiveKey(input.key) ? "[REDACTED]" : redactSensitiveString(input.value);
    this.db.prepare(`
      INSERT INTO memory_items (workspace_id, scope, key, value)
      VALUES (@workspaceId, @scope, @key, @value)
      ON CONFLICT(workspace_id, scope, key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run({ ...input, key, value });
  }

  recall(input: { workspaceId: string; scope: "workspace" | "global"; limit: number }): Memory[] {
    return this.db.prepare(`
      SELECT key, value
      FROM memory_items
      WHERE workspace_id = ? AND scope = ?
      ORDER BY updated_at DESC, key ASC
      LIMIT ?
    `).all(input.workspaceId, input.scope, input.limit) as Memory[];
  }
}
