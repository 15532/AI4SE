import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Action } from "../core/actions.js";
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
export type StoredSession = {
  id: string;
  workspaceId: string;
  provider: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type StoredApproval = {
  id: string;
  runId: string;
  workspaceId: string;
  action: Action;
  ruleId: string;
  reason: string;
  status: ApprovalStatus;
  createdAt: string;
  decidedAt?: string;
};

export class EventStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    if (dbPath !== ":memory:") mkdirSync(dirname(resolve(dbPath)), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec(schemaSql);
  }

  createSession(input: { workspaceId: string; provider: string; title?: string }): string {
    const id = randomUUID();
    const title = redactSensitiveString(input.title?.trim() || "Untitled session");
    this.db.prepare("INSERT INTO sessions (id, workspace_id, provider, title) VALUES (?, ?, ?, ?)")
      .run(id, input.workspaceId, input.provider, title);
    return id;
  }

  getSession(sessionId: string): StoredSession | undefined {
    const row = this.db.prepare(`
      SELECT id, workspace_id, provider, title, created_at, updated_at
      FROM sessions
      WHERE id = ?
    `).get(sessionId) as {
      id: string;
      workspace_id: string;
      provider: string;
      title: string;
      created_at: string;
      updated_at: string;
    } | undefined;

    return row === undefined ? undefined : {
      id: row.id,
      workspaceId: row.workspace_id,
      provider: row.provider,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  listSessions(input: { workspaceId?: string; limit?: number } = {}): StoredSession[] {
    const limit = input.limit ?? 20;
    const rows = input.workspaceId === undefined
      ? this.db.prepare(`
        SELECT id, workspace_id, provider, title, created_at, updated_at
        FROM sessions
        ORDER BY rowid DESC
        LIMIT ?
      `).all(limit)
      : this.db.prepare(`
        SELECT id, workspace_id, provider, title, created_at, updated_at
        FROM sessions
        WHERE workspace_id = ?
        ORDER BY rowid DESC
        LIMIT ?
      `).all(input.workspaceId, limit);

    return (rows as Array<{
      id: string;
      workspace_id: string;
      provider: string;
      title: string;
      created_at: string;
      updated_at: string;
    }>).map((row) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      provider: row.provider,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  createApproval(input: {
    runId: string;
    workspaceId: string;
    action: Action;
    ruleId: string;
    reason: string;
  }): string {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO approvals (id, run_id, workspace_id, action_json, rule_id, reason, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      id,
      input.runId,
      input.workspaceId,
      JSON.stringify(redactSensitiveValue(input.action)),
      input.ruleId,
      redactSensitiveString(input.reason)
    );
    return id;
  }

  getApproval(approvalId: string): StoredApproval | undefined {
    const row = this.db.prepare(`
      SELECT id, run_id, workspace_id, action_json, rule_id, reason, status, created_at, decided_at
      FROM approvals
      WHERE id = ?
    `).get(approvalId) as {
      id: string;
      run_id: string;
      workspace_id: string;
      action_json: string;
      rule_id: string;
      reason: string;
      status: ApprovalStatus;
      created_at: string;
      decided_at?: string;
    } | undefined;

    return row === undefined ? undefined : {
      id: row.id,
      runId: row.run_id,
      workspaceId: row.workspace_id,
      action: JSON.parse(row.action_json) as Action,
      ruleId: row.rule_id,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
      ...(row.decided_at === undefined || row.decided_at === null ? {} : { decidedAt: row.decided_at })
    };
  }

  listPendingApprovals(runId: string): StoredApproval[] {
    const rows = this.db.prepare(`
      SELECT id
      FROM approvals
      WHERE run_id = ? AND status = 'pending'
      ORDER BY rowid ASC
    `).all(runId) as Array<{ id: string }>;

    return rows
      .map((row) => this.getApproval(row.id))
      .filter((approval): approval is StoredApproval => approval !== undefined);
  }

  decideApproval(approvalId: string, status: Exclude<ApprovalStatus, "pending">): StoredApproval | undefined {
    this.db.prepare(`
      UPDATE approvals
      SET status = ?, decided_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'
    `).run(status, approvalId);
    return this.getApproval(approvalId);
  }

  createRun(input: { task: string; workspaceId: string; mode: string; sessionId?: string }): string {
    const id = randomUUID();
    const create = this.db.transaction(() => {
      this.db.prepare("INSERT INTO runs (id, task, workspace_id, mode) VALUES (?, ?, ?, ?)")
        .run(id, redactSensitiveString(input.task), input.workspaceId, input.mode);
      if (input.sessionId !== undefined) {
        this.db.prepare("INSERT INTO session_runs (session_id, run_id) VALUES (?, ?)")
          .run(input.sessionId, id);
        this.db.prepare("UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .run(input.sessionId);
      }
    });
    create();
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

  listSessionRuns(sessionId: string, limit: number): RecentRun[] {
    const rows = this.db.prepare(`
      SELECT runs.id, runs.task, runs.workspace_id, runs.mode, runs.created_at
      FROM session_runs
      INNER JOIN runs ON runs.id = session_runs.run_id
      WHERE session_runs.session_id = ?
      ORDER BY session_runs.rowid DESC
      LIMIT ?
    `).all(sessionId, limit) as Array<{
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
        : reason === "pending_approval"
          ? "pending_approval"
          : reason === "approval_executed"
            ? "approval_executed"
            : reason === "approval_rejected"
              ? "approval_rejected"
              : reason === undefined
                ? "running"
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
