import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { schemaSql } from "./schema.js";

type Event = { sequence: number; kind: string; payload: Record<string, unknown> };
const apiKeyPattern = /\bsk-[A-Za-z0-9_-]+\b/g;

function redactPayload(value: unknown, key?: string): unknown {
  if (key !== undefined && /secret|token|apikey/i.test(key)) {
    return "[REDACTED]";
  }
  if (typeof value === "string") {
    return value.replace(apiKeyPattern, "[REDACTED]");
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactPayload(item));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, redactPayload(nestedValue, nestedKey)])
    );
  }
  return value;
}

export class EventStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(schemaSql);
  }

  createRun(input: { task: string; workspaceId: string; mode: string }): string {
    const id = randomUUID();
    this.db.prepare("INSERT INTO runs (id, task, workspace_id, mode) VALUES (?, ?, ?, ?)")
      .run(id, input.task, input.workspaceId, input.mode);
    return id;
  }

  appendEvent(runId: string, kind: string, payload: Record<string, unknown>): void {
    const append = this.db.transaction(() => {
      const row = this.db.prepare("SELECT COALESCE(MAX(sequence), 0) AS sequence FROM events WHERE run_id = ?")
        .get(runId) as { sequence: number };
      this.db.prepare("INSERT INTO events (run_id, sequence, kind, payload_json) VALUES (?, ?, ?, ?)")
        .run(runId, row.sequence + 1, kind, JSON.stringify(redactPayload(payload)));
    });
    append();
  }

  listEvents(runId: string): Event[] {
    const rows = this.db.prepare(
      "SELECT sequence, kind, payload_json FROM events WHERE run_id = ? ORDER BY sequence ASC"
    ).all(runId) as Array<{ sequence: number; kind: string; payload_json: string }>;

    return rows.map((row) => ({ sequence: row.sequence, kind: row.kind, payload: JSON.parse(row.payload_json) }));
  }
}
