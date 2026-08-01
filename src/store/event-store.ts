import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { schemaSql } from "./schema.js";
import { redactSensitiveString, redactSensitiveValue } from "./redaction.js";

type Event = { sequence: number; kind: string; payload: Record<string, unknown> };
export type StoredRun = {
  id: string;
  task: string;
  workspaceId: string;
  mode: string;
  createdAt: string;
};
export type RecentRun = StoredRun;
export type RunSummary = {
  id: string;
  task: string;
  workspaceId: string;
  status: string;
  summary?: string;
};

export class EventStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") mkdirSync(dirname(resolve(dbPath)), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec(schemaSql);
  }

  createRun(input: { task: string; workspaceId: string; mode: string }): string {
    const id = randomUUID();
    this.db.prepare("INSERT INTO runs (id, task, workspace_id, mode) VALUES (?, ?, ?, ?)")
      .run(id, redactSensitiveString(input.task), input.workspaceId, input.mode);
    return id;
  }

  getRun(runId: string): StoredRun | undefined {
    const row = this.db.prepare(`
      SELECT id, task, workspace_id, mode, created_at
      FROM runs
      WHERE id = ?
    `).get(runId) as {
      id: string;
      task: string;
      workspace_id: string;
      mode: string;
      created_at: string;
    } | undefined;

    return row === undefined ? undefined : {
      id: row.id,
      task: row.task,
      workspaceId: row.workspace_id,
      mode: row.mode,
      createdAt: row.created_at
    };
  }

  listRecentRuns(workspaceId: string, limit: number): RecentRun[] {
    const rows = this.db.prepare(`
      SELECT id, task, workspace_id, mode, created_at
      FROM runs
      WHERE workspace_id = ?
      ORDER BY rowid DESC
      LIMIT ?
    `).all(workspaceId, limit) as Array<{
      id: string;
      task: string;
      workspace_id: string;
      mode: string;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      task: row.task,
      workspaceId: row.workspace_id,
      mode: row.mode,
      createdAt: row.created_at
    }));
  }

  appendEvent(runId: string, kind: string, payload: Record<string, unknown>): void {
    const append = this.db.transaction(() => {
      const row = this.db.prepare("SELECT COALESCE(MAX(sequence), 0) AS sequence FROM events WHERE run_id = ?")
        .get(runId) as { sequence: number };
      this.db.prepare("INSERT INTO events (run_id, sequence, kind, payload_json) VALUES (?, ?, ?, ?)")
        .run(runId, row.sequence + 1, kind, JSON.stringify(redactSensitiveValue(payload)));
    });
    append();
  }

  listEvents(runId: string): Event[] {
    const rows = this.db.prepare(
      "SELECT sequence, kind, payload_json FROM events WHERE run_id = ? ORDER BY sequence ASC"
    ).all(runId) as Array<{ sequence: number; kind: string; payload_json: string }>;

    return rows.map((row) => ({ sequence: row.sequence, kind: row.kind, payload: JSON.parse(row.payload_json) }));
  }

  summarizeRun(runId: string): RunSummary | undefined {
    const run = this.getRun(runId);
    if (run === undefined) return undefined;

    const stop = [...this.listEvents(runId)].reverse().find((event) => event.kind === "stop");
    const reason = typeof stop?.payload.reason === "string" ? stop.payload.reason : undefined;
    const summary = typeof stop?.payload.summary === "string" ? stop.payload.summary : undefined;
    const status = reason === "finish"
      ? "finished"
      : reason === "max_iterations"
        ? "max_iterations"
        : reason === undefined
          ? "unknown"
          : "blocked";

    return {
      id: run.id,
      task: run.task,
      workspaceId: run.workspaceId,
      status,
      ...(summary === undefined ? {} : { summary })
    };
  }
}
