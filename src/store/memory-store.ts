import Database from "better-sqlite3";
import { schemaSql } from "./schema.js";

type Memory = { key: string; value: string };
const apiKeyPattern = /\bsk-[A-Za-z0-9_-]+\b/g;

function redactValue(key: string, value: string): string {
  return /secret|token|apikey/i.test(key) ? "[REDACTED]" : value.replace(apiKeyPattern, "[REDACTED]");
}

export class MemoryStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(schemaSql);
  }

  remember(input: { workspaceId: string; scope: "workspace" | "global"; key: string; value: string }): void {
    this.db.prepare(`
      INSERT INTO memory_items (workspace_id, scope, key, value)
      VALUES (@workspaceId, @scope, @key, @value)
      ON CONFLICT(workspace_id, scope, key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run({ ...input, value: redactValue(input.key, input.value) });
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
