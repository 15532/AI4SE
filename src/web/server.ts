import "dotenv/config";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { HarnessRegistry, loadHarnessRegistry } from "../config/harness-config.js";
import { runAgentLoop } from "../core/loop.js";
import { createProvider, type LLMProvider } from "../core/providers.js";
import { listWorkspaceChanges, readWorkspaceDiff } from "../runtime/diff-inspector.js";
import { classifyAction } from "../runtime/guardrails.js";
import { dispatchTool } from "../runtime/tools.js";
import { saveWorkspaceTextFile } from "../runtime/workspace-editor.js";
import { listWorkspaceFiles, readWorkspaceTextFile } from "../runtime/workspace-explorer.js";
import type { WorkspaceConfig } from "../runtime/workspace.js";
import { EventStore } from "../store/event-store.js";
import { MemoryStore } from "../store/memory-store.js";
import {
  renderIndex,
  renderRun,
  renderSession,
  renderWorkspaceFileEditor,
  renderWorkspaceFiles,
  type PublicChatFilePreview,
  type PublicChatRun,
  type PublicChatSession,
  type PublicChatWorkspaceFiles,
  type PublicProvider,
  type PublicWorkspace
} from "./views.js";

type InjectInput = {
  method: string;
  url: string;
  payload?: unknown;
  headers?: Record<string, string | undefined>;
  body?: string;
};
type InjectResponse = { statusCode: number; body: string; headers: Record<string, string>; json(): unknown };

const credentialAssignmentPattern = /\b(?:openai_api_key|api[_-]?key|secret|token|password|private[_-]?key)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,}\]]+)/gi;
const apiKeyPattern = /\bsk-[A-Za-z0-9_-]+\b/g;

function redactString(value: string): string {
  return value
    .replace(credentialAssignmentPattern, (match) => {
      if (match.includes("[REDACTED")) return match;
      return `${match.slice(0, Math.max(match.indexOf("="), match.indexOf(":")) + 1)}[REDACTED]`;
    })
    .replace(apiKeyPattern, "[REDACTED]");
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, redactValue(nested)]));
  }
  return value;
}

function publicWorkspace(
  workspace: WorkspaceConfig,
  memoryStore?: MemoryStore,
  eventStore?: EventStore
): PublicWorkspace {
  const memories = memoryStore?.recall({ workspaceId: workspace.id, scope: "workspace", limit: 5 }) ?? [];
  const recentRuns = eventStore?.listRecentRuns(workspace.id, 5)
    .map((run) => eventStore.summarizeRun(run.id))
    .filter((summary): summary is NonNullable<typeof summary> => summary !== undefined)
    .map((summary) => ({
      task: summary.task,
      status: summary.status,
      ...(summary.summary === undefined ? {} : { summary: summary.summary })
    })) ?? [];
  return redactValue({
    id: workspace.id,
    name: workspace.name,
    allowedCommands: workspace.allowedCommands,
    ...(memories.length === 0 ? {} : { memories }),
    ...(recentRuns.length === 0 ? {} : { recentRuns })
  }) as PublicWorkspace;
}

function isRunRequest(value: unknown): value is { workspaceId: string; provider: string; task: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  return typeof request.workspaceId === "string"
    && typeof request.provider === "string"
    && typeof request.task === "string";
}

function isSessionRequest(value: unknown): value is { workspaceId: string; provider: string; title?: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  return typeof request.workspaceId === "string"
    && typeof request.provider === "string"
    && (request.title === undefined || typeof request.title === "string");
}

function isSessionRunRequest(value: unknown): value is { task: string } {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && typeof (value as Record<string, unknown>).task === "string";
}

function isFileSaveRequest(value: unknown): value is { content: string; returnTo?: string } {
  return typeof value === "object"
    && value !== null
    && !Array.isArray(value)
    && typeof (value as Record<string, unknown>).content === "string"
    && ((value as Record<string, unknown>).returnTo === undefined || typeof (value as Record<string, unknown>).returnTo === "string");
}

function isFormRequest(headers: Record<string, string | string[] | undefined>): boolean {
  return String(headers["content-type"] ?? "").includes("application/x-www-form-urlencoded");
}

function response(statusCode: number, value: unknown, contentType = "application/json; charset=utf-8"): InjectResponse {
  const body = contentType.startsWith("application/json") ? JSON.stringify(redactValue(value)) : String(value);
  return { statusCode, body, headers: { "content-type": contentType }, json: () => JSON.parse(body) };
}

function redirect(location: string): InjectResponse {
  return {
    statusCode: 303,
    body: "",
    headers: { location, "content-type": "text/plain; charset=utf-8" },
    json: () => JSON.parse("")
  };
}

function statusFromTimeline(timeline: Array<{ payload: Record<string, unknown> }>): string {
  const stop = [...timeline].reverse().find((event) => event.payload.kind === "stop");
  switch (stop?.payload.reason) {
    case "finish": return "finished";
    case "max_iterations": return "max_iterations";
    case "pending_approval": return "pending_approval";
    case "approval_executed": return "approval_executed";
    case "approval_rejected": return "approval_rejected";
    default: return stop === undefined ? "running" : "blocked";
  }
}

function safeLocalReturnTo(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return undefined;
  if (decoded.includes("://")) return undefined;
  return decoded;
}

function appendSavedFlag(location: string): string {
  const separator = location.includes("?") ? "&" : "?";
  return `${location}${separator}saved=1`;
}

export function createServer(input: {
  workspaces?: WorkspaceConfig[];
  registry?: HarnessRegistry;
  dbPath?: string;
  providerFactory?: (provider: string) => LLMProvider;
}): {
  inject(input: InjectInput): Promise<InjectResponse>;
  listen(port: number, host?: string): Promise<{ close(): Promise<void> }>;
} {
  const registry = input.registry ?? new HarnessRegistry({
    mode: "webui",
    maxIterations: 10,
    workspaces: input.workspaces ?? [],
    providers: [{ id: "mock", type: "mock" }]
  });
  const eventStore = new EventStore(input.dbPath ?? ":memory:");
  const memoryStore = new MemoryStore(input.dbPath ?? ":memory:");
  const providers: PublicProvider[] = registry.listProviders().map((provider) => ({ id: provider.id }));
  const publicWorkspaces = () => registry.listWorkspaces().map((workspace) => publicWorkspace(workspace, memoryStore, eventStore));

  const storedRun = (id: string) => {
    const run = eventStore.getRun(id);
    if (run === undefined) return undefined;
    const timeline = eventStore.listEvents(id);
    return {
      id: run.id,
      task: run.task,
      workspaceId: run.workspaceId,
      status: statusFromTimeline(timeline),
      approvals: eventStore.listPendingApprovals(id),
      timeline
    };
  };

  const changesForWorkspace = async (workspaceId: string) => {
    const workspace = registry.getWorkspace(workspaceId);
    if (workspace === undefined) return [];
    const result = await listWorkspaceChanges(workspace);
    return result.ok ? result.changes : [];
  };

  const publicSession = (sessionId: string) => {
    const session = eventStore.getSession(sessionId);
    if (session === undefined) return undefined;
    const runs = eventStore.listSessionRuns(session.id, 20)
      .map((run) => eventStore.summarizeRun(run.id))
      .filter((summary): summary is NonNullable<typeof summary> => summary !== undefined)
      .map((summary) => ({
        id: summary.id,
        task: summary.task,
        workspaceId: summary.workspaceId,
        status: summary.status,
        ...(summary.summary === undefined ? {} : { summary: summary.summary })
      }));
    return redactValue({
      id: session.id,
      workspaceId: session.workspaceId,
      provider: session.provider,
      title: session.title,
      runs
    });
  };

  const sessionRuns = (sessionId: string) => eventStore.listSessionRuns(sessionId, 20)
    .map((run) => eventStore.summarizeRun(run.id))
    .filter((summary): summary is NonNullable<typeof summary> => summary !== undefined)
    .map((summary) => ({
      id: summary.id,
      task: summary.task,
      workspaceId: summary.workspaceId,
      status: summary.status,
      ...(summary.summary === undefined ? {} : { summary: summary.summary })
    }));

  const publicChatRun = (runId: string): PublicChatRun | undefined => {
    const run = storedRun(runId);
    if (run === undefined) return undefined;
    const summary = eventStore.summarizeRun(run.id)?.summary;
    return {
      ...run,
      ...(summary === undefined ? {} : { summary })
    };
  };

  const publicChatSession = (sessionId: string): PublicChatSession | undefined => {
    const session = eventStore.getSession(sessionId);
    if (session === undefined) return undefined;
    const runs = eventStore.listSessionRuns(session.id, 20)
      .map((run) => publicChatRun(run.id))
      .filter((run): run is PublicChatRun => run !== undefined);
    return {
      id: session.id,
      workspaceId: session.workspaceId,
      provider: session.provider,
      title: session.title,
      runs
    };
  };

  const startRunInBackground = (start: {
    task: string;
    workspace: WorkspaceConfig;
    provider: string;
    sessionId?: string;
  }): string => {
    const providerConfig = registry.getProvider(start.provider);
    if (providerConfig === undefined) throw new Error("Unsupported provider");
    const provider = input.providerFactory?.(start.provider) ?? createProvider(providerConfig);
    const runId = eventStore.createRun({
      task: start.task,
      workspaceId: start.workspace.id,
      mode: registry.mode,
      sessionId: start.sessionId
    });
    eventStore.appendEvent(runId, "run_started", {
      kind: "run_started",
      task: start.task,
      workspaceId: start.workspace.id,
      provider: start.provider
    });
    void runAgentLoop({
      task: start.task,
      workspace: start.workspace,
      provider,
      maxIterations: registry.maxIterations,
      mode: registry.mode,
      eventStore,
      memoryStore,
      sessionId: start.sessionId,
      existingRunId: runId
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Provider request failed";
      eventStore.appendEvent(runId, "feedback", {
        kind: "feedback",
        feedback: {
          source: "provider_error",
          severity: "error",
          message
        }
      });
      eventStore.appendEvent(runId, "stop", {
        kind: "stop",
        reason: "provider_error"
      });
    });
    return runId;
  };

  const handle = async (
    method: string,
    requestUrl: string,
    payload?: unknown,
    headers: Record<string, string | string[] | undefined> = {}
  ): Promise<InjectResponse> => {
    const url = new URL(requestUrl, "http://localhost");
    if (method === "GET" && url.pathname === "/") {
      const runId = url.searchParams.get("runId");
      const sessionId = url.searchParams.get("sessionId");
      const chatSession = sessionId === null ? undefined : publicChatSession(sessionId);
      const activeRun = runId === null ? undefined : publicChatRun(runId);
      const publicRun: PublicChatRun | undefined = activeRun === undefined
        ? undefined
        : {
          ...activeRun,
          changes: await changesForWorkspace(activeRun.workspaceId)
        };
      const activeWorkspaceId = url.searchParams.get("workspaceId")
        ?? chatSession?.workspaceId
        ?? publicRun?.workspaceId
        ?? registry.listWorkspaces()[0]?.id;
      const activeWorkspace = activeWorkspaceId === undefined ? undefined : registry.getWorkspace(activeWorkspaceId);
      let workspaceFileEntries: Awaited<ReturnType<typeof listWorkspaceFiles>> = [];
      if (activeWorkspace !== undefined) {
        try {
          workspaceFileEntries = await listWorkspaceFiles(activeWorkspace);
        } catch {
          workspaceFileEntries = [];
        }
      }
      const workspaceFiles: PublicChatWorkspaceFiles | undefined = activeWorkspace === undefined
        ? undefined
        : { workspaceId: activeWorkspace.id, files: workspaceFileEntries };
      const workspaceChanges = activeWorkspace === undefined ? [] : await changesForWorkspace(activeWorkspace.id);
      const selectedFile = url.searchParams.get("file");
      let filePreview: PublicChatFilePreview | undefined;
      if (activeWorkspace !== undefined && selectedFile !== null) {
        try {
          const file = await readWorkspaceTextFile(activeWorkspace, selectedFile);
          if (file.ok) filePreview = {
            workspaceId: activeWorkspace.id,
            path: file.path,
            content: file.content,
            status: workspaceChanges.find((change) => change.path === file.path)?.status
          };
        } catch {
          filePreview = undefined;
        }
      }
      return response(200, renderIndex(publicWorkspaces(), providers, publicRun, {
        activeWorkspaceId,
        activeSessionId: chatSession?.id ?? sessionId ?? undefined,
        activeRunId: publicRun?.id ?? runId ?? undefined,
        workspaceFiles,
        workspaceChanges,
        filePreview
      }, chatSession), "text/html; charset=utf-8");
    }
    if (method === "GET" && url.pathname === "/api/workspaces") {
      return response(200, publicWorkspaces());
    }
    if (method === "GET" && url.pathname.startsWith("/workspaces/") && url.pathname.endsWith("/files")) {
      const workspaceId = decodeURIComponent(url.pathname.slice("/workspaces/".length, -"/files".length));
      const workspace = registry.getWorkspace(workspaceId);
      if (workspace === undefined) return response(404, "Workspace not found", "text/html; charset=utf-8");
      return response(200, renderWorkspaceFiles({
        workspace: publicWorkspace(workspace, memoryStore, eventStore),
        files: await listWorkspaceFiles(workspace),
        changes: await changesForWorkspace(workspace.id)
      }), "text/html; charset=utf-8");
    }
    if (method === "GET" && url.pathname.startsWith("/workspaces/") && url.pathname.includes("/files/")) {
      const remainder = url.pathname.slice("/workspaces/".length);
      const separator = remainder.indexOf("/files/");
      const workspaceId = decodeURIComponent(remainder.slice(0, separator));
      const filePath = decodeURIComponent(remainder.slice(separator + "/files/".length));
      const workspace = registry.getWorkspace(workspaceId);
      if (workspace === undefined) return response(404, "Workspace not found", "text/html; charset=utf-8");
      const file = await readWorkspaceTextFile(workspace, filePath);
      if (!file.ok) return response(400, file.error, "text/html; charset=utf-8");
      return response(200, renderWorkspaceFileEditor({
        workspace: publicWorkspace(workspace, memoryStore, eventStore),
        files: await listWorkspaceFiles(workspace),
        file,
        changes: await changesForWorkspace(workspace.id),
        saved: url.searchParams.get("saved") === "1"
      }), "text/html; charset=utf-8");
    }
    if (method === "POST" && url.pathname === "/api/sessions") {
      if (!isSessionRequest(payload)) return response(400, { error: "Invalid session request" });
      if (registry.getWorkspace(payload.workspaceId) === undefined) return response(400, { error: "Unknown workspace id" });
      if (registry.getProvider(payload.provider) === undefined) return response(400, { error: "Unsupported provider" });
      const sessionId = eventStore.createSession({
        workspaceId: payload.workspaceId,
        provider: payload.provider,
        title: payload.title
      });
      if (String(headers["content-type"] ?? "").includes("application/x-www-form-urlencoded")) {
        return redirect(`/sessions/${encodeURIComponent(sessionId)}`);
      }
      return response(201, { id: sessionId });
    }
    if (method === "POST" && url.pathname.startsWith("/api/sessions/") && url.pathname.endsWith("/runs/start")) {
      const sessionId = decodeURIComponent(url.pathname.slice("/api/sessions/".length, -"/runs/start".length));
      const session = eventStore.getSession(sessionId);
      if (session === undefined) return response(404, { error: "Unknown session id" });
      if (!isSessionRunRequest(payload)) return response(400, { error: "Invalid session run request" });
      const workspace = registry.getWorkspace(session.workspaceId);
      if (workspace === undefined) return response(400, { error: "Unknown workspace id" });
      if (registry.getProvider(session.provider) === undefined) return response(400, { error: "Unsupported provider" });
      let runId: string;
      try {
        runId = startRunInBackground({
          task: payload.task,
          workspace,
          provider: session.provider,
          sessionId: session.id
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Provider request failed";
        if (message.startsWith("Missing API key for provider ")) return response(400, { error: message });
        if (message === "Unsupported provider") return response(400, { error: message });
        return response(502, { error: "Provider request failed" });
      }
      if (isFormRequest(headers)) {
        return redirect(`/?sessionId=${encodeURIComponent(session.id)}&runId=${encodeURIComponent(runId)}`);
      }
      return response(202, { id: runId, sessionId: session.id });
    }
    if (method === "POST" && url.pathname.startsWith("/api/sessions/") && url.pathname.endsWith("/runs")) {
      const sessionId = decodeURIComponent(url.pathname.slice("/api/sessions/".length, -"/runs".length));
      const session = eventStore.getSession(sessionId);
      if (session === undefined) return response(404, { error: "Unknown session id" });
      if (!isSessionRunRequest(payload)) return response(400, { error: "Invalid session run request" });
      const workspace = registry.getWorkspace(session.workspaceId);
      if (workspace === undefined) return response(400, { error: "Unknown workspace id" });
      const providerConfig = registry.getProvider(session.provider);
      if (providerConfig === undefined) return response(400, { error: "Unsupported provider" });

      let result: Awaited<ReturnType<typeof runAgentLoop>>;
      try {
        const provider = input.providerFactory?.(session.provider) ?? createProvider(providerConfig);
        result = await runAgentLoop({
          task: payload.task,
          workspace,
          provider,
          maxIterations: registry.maxIterations,
          mode: registry.mode,
          eventStore,
          memoryStore,
          sessionId: session.id
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Provider request failed";
        if (message.startsWith("Missing API key for provider ")) return response(400, { error: message });
        return response(502, { error: "Provider request failed" });
      }
      if (result.runId === undefined) throw new Error("Persisted run did not return an id");
      if (String(headers["content-type"] ?? "").includes("application/x-www-form-urlencoded")) {
        return redirect(`/?sessionId=${encodeURIComponent(session.id)}&runId=${encodeURIComponent(result.runId)}`);
      }
      return response(201, { id: result.runId, sessionId: session.id });
    }
    if (method === "POST" && url.pathname.startsWith("/api/approvals/")) {
      const actionName = url.pathname.endsWith("/approve")
        ? "approve"
        : url.pathname.endsWith("/reject")
          ? "reject"
          : undefined;
      if (actionName === undefined) return response(404, { error: "Not found" });

      const approvalId = decodeURIComponent(
        url.pathname.slice("/api/approvals/".length, -`/${actionName}`.length)
      );
      const approval = eventStore.getApproval(approvalId);
      if (approval === undefined) return response(404, { error: "Unknown approval id" });
      if (approval.status !== "pending") return response(409, { error: "Approval has already been decided" });

      const workspace = registry.getWorkspace(approval.workspaceId);
      if (workspace === undefined) return response(400, { error: "Unknown workspace id" });

      if (actionName === "reject") {
        eventStore.decideApproval(approval.id, "rejected");
        eventStore.appendEvent(approval.runId, "approval_decision", {
          kind: "approval_decision",
          approvalId: approval.id,
          decision: "rejected"
        });
        eventStore.appendEvent(approval.runId, "stop", {
          kind: "stop",
          reason: "approval_rejected",
          approvalId: approval.id
        });
        return redirect(`/?runId=${encodeURIComponent(approval.runId)}`);
      }

      const guardrail = classifyAction(approval.action, workspace);
      if (guardrail.decision !== "require_approval") {
        eventStore.appendEvent(approval.runId, "approval_decision", {
          kind: "approval_decision",
          approvalId: approval.id,
          decision: "approval_failed",
          guardrail
        });
        return response(400, { error: "Approved action no longer requires approval" });
      }

      eventStore.decideApproval(approval.id, "approved");
      eventStore.appendEvent(approval.runId, "approval_decision", {
        kind: "approval_decision",
        approvalId: approval.id,
        decision: "approved"
      });
      const result = await dispatchTool(approval.action, workspace);
      eventStore.appendEvent(approval.runId, "tool_result", {
        kind: "tool_result",
        action: approval.action,
        result
      });
      eventStore.appendEvent(approval.runId, "stop", {
        kind: "stop",
        reason: "approval_executed",
        approvalId: approval.id
      });
      return redirect(`/?runId=${encodeURIComponent(approval.runId)}`);
    }
    if (method === "GET" && url.pathname.startsWith("/api/sessions/")) {
      const sessionId = decodeURIComponent(url.pathname.slice("/api/sessions/".length));
      const session = publicSession(sessionId);
      return session === undefined
        ? response(404, { error: "Unknown session id" })
        : response(200, session);
    }
    const workspaceApiPrefix = "/api/workspaces/";
    if (method === "GET" && url.pathname.startsWith(workspaceApiPrefix) && url.pathname.endsWith("/changes")) {
      const workspaceId = decodeURIComponent(url.pathname.slice(workspaceApiPrefix.length, -"/changes".length));
      const workspace = registry.getWorkspace(workspaceId);
      if (workspace === undefined) return response(404, { error: "Unknown workspace id" });
      const result = await listWorkspaceChanges(workspace);
      return result.ok ? response(200, result.changes) : response(400, { error: result.error });
    }
    if (method === "GET" && url.pathname.startsWith(workspaceApiPrefix) && url.pathname.includes("/changes/")) {
      const remainder = url.pathname.slice(workspaceApiPrefix.length);
      const separator = remainder.indexOf("/changes/");
      const workspaceId = decodeURIComponent(remainder.slice(0, separator));
      const filePath = decodeURIComponent(remainder.slice(separator + "/changes/".length));
      const workspace = registry.getWorkspace(workspaceId);
      if (workspace === undefined) return response(404, { error: "Unknown workspace id" });
      const result = await readWorkspaceDiff(workspace, filePath);
      return result.ok
        ? response(200, { path: result.path, diff: result.diff })
        : response(400, { error: result.error });
    }
    if (method === "GET" && url.pathname.startsWith(workspaceApiPrefix) && url.pathname.endsWith("/files")) {
      const workspaceId = decodeURIComponent(url.pathname.slice(workspaceApiPrefix.length, -"/files".length));
      const workspace = registry.getWorkspace(workspaceId);
      return workspace === undefined
        ? response(404, { error: "Unknown workspace id" })
        : response(200, await listWorkspaceFiles(workspace));
    }
    if (method === "GET" && url.pathname.startsWith(workspaceApiPrefix) && url.pathname.includes("/files/")) {
      const remainder = url.pathname.slice(workspaceApiPrefix.length);
      const separator = remainder.indexOf("/files/");
      const workspaceId = decodeURIComponent(remainder.slice(0, separator));
      const filePath = decodeURIComponent(remainder.slice(separator + "/files/".length));
      const workspace = registry.getWorkspace(workspaceId);
      if (workspace === undefined) return response(404, { error: "Unknown workspace id" });
      const result = await readWorkspaceTextFile(workspace, filePath);
      return result.ok
        ? response(200, { path: result.path, content: result.content })
        : response(400, { error: result.error });
    }
    if (method === "POST" && url.pathname.startsWith(workspaceApiPrefix) && url.pathname.includes("/files/")) {
      const remainder = url.pathname.slice(workspaceApiPrefix.length);
      const separator = remainder.indexOf("/files/");
      const workspaceId = decodeURIComponent(remainder.slice(0, separator));
      const filePath = decodeURIComponent(remainder.slice(separator + "/files/".length));
      const workspace = registry.getWorkspace(workspaceId);
      if (workspace === undefined) return response(404, { error: "Unknown workspace id" });
      if (!isFileSaveRequest(payload)) return response(400, { error: "Invalid file save request" });
      const result = await saveWorkspaceTextFile(workspace, filePath, payload.content);
      if (!result.ok) {
        return response(400, {
          error: result.error,
          ...(result.ruleId === undefined ? {} : { ruleId: result.ruleId })
        });
      }
      if (isFormRequest(headers)) {
        const returnTo = safeLocalReturnTo(payload.returnTo);
        return redirect(appendSavedFlag(returnTo ?? `/workspaces/${encodeURIComponent(workspace.id)}/files/${encodeURIComponent(result.path)}`));
      }
      return response(200, { path: result.path, saved: true });
    }
    if (method === "POST" && url.pathname === "/api/runs/start") {
      if (!isRunRequest(payload)) return response(400, { error: "Invalid run request" });
      const workspace = registry.getWorkspace(payload.workspaceId);
      if (workspace === undefined) return response(400, { error: "Unknown workspace id" });
      const providerConfig = registry.getProvider(payload.provider);
      if (providerConfig === undefined) return response(400, { error: "Unsupported provider" });

      const formRequest = String(headers["content-type"] ?? "").includes("application/x-www-form-urlencoded");
      const sessionId = eventStore.createSession({
        workspaceId: workspace.id,
        provider: providerConfig.id,
        title: payload.task
      });
      let runId: string;
      try {
        runId = startRunInBackground({
          task: payload.task,
          workspace,
          provider: payload.provider,
          sessionId
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Provider request failed";
        if (message.startsWith("Missing API key for provider ")) return response(400, { error: message });
        if (message === "Unsupported provider") return response(400, { error: message });
        return response(502, { error: "Provider request failed" });
      }
      if (formRequest) {
        return redirect(`/?sessionId=${encodeURIComponent(sessionId)}&runId=${encodeURIComponent(runId)}`);
      }
      return response(202, { id: runId, sessionId });
    }
    if (method === "POST" && url.pathname === "/api/runs") {
      if (!isRunRequest(payload)) return response(400, { error: "Invalid run request" });
      const workspace = registry.getWorkspace(payload.workspaceId);
      if (workspace === undefined) return response(400, { error: "Unknown workspace id" });
      const providerConfig = registry.getProvider(payload.provider);
      if (providerConfig === undefined) return response(400, { error: "Unsupported provider" });

      const formRequest = String(headers["content-type"] ?? "").includes("application/x-www-form-urlencoded");
      const sessionId = formRequest
        ? eventStore.createSession({
          workspaceId: workspace.id,
          provider: providerConfig.id,
          title: payload.task
        })
        : undefined;
      let result: Awaited<ReturnType<typeof runAgentLoop>>;
      try {
        const provider = input.providerFactory?.(payload.provider) ?? createProvider(providerConfig);
        result = await runAgentLoop({
          task: payload.task,
          workspace,
          provider,
          maxIterations: registry.maxIterations,
          mode: registry.mode,
          eventStore,
          memoryStore,
          sessionId
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Provider request failed";
        if (message.startsWith("Missing API key for provider ")) return response(400, { error: message });
        return response(502, { error: "Provider request failed" });
      }
      if (result.runId === undefined) throw new Error("Persisted run did not return an id");
      if (formRequest) {
        return redirect(`/?sessionId=${encodeURIComponent(sessionId ?? "")}&runId=${encodeURIComponent(result.runId)}`);
      }
      return response(201, { id: result.runId });
    }
    if (method === "GET" && url.pathname.startsWith("/api/runs/") && url.pathname.endsWith("/timeline")) {
      const id = decodeURIComponent(url.pathname.slice("/api/runs/".length, -"/timeline".length));
      const run = storedRun(id);
      if (run === undefined) return response(404, { error: "Unknown run id" });
      const after = Number(url.searchParams.get("after") ?? "0");
      const timeline = Number.isFinite(after)
        ? run.timeline.filter((event) => event.sequence > after)
        : run.timeline;
      return response(200, {
        id: run.id,
        status: run.status,
        approvals: run.approvals,
        timeline
      });
    }
    if (method === "GET" && url.pathname.startsWith("/api/runs/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/runs/".length));
      const run = storedRun(id);
      if (run === undefined) return response(404, { error: "Unknown run id" });
      const { task: _task, approvals: _approvals, ...publicRun } = run;
      return response(200, publicRun);
    }
    if (method === "GET" && url.pathname.startsWith("/runs/")) {
      const id = decodeURIComponent(url.pathname.slice("/runs/".length));
      const run = storedRun(id);
      return run === undefined
        ? response(404, "运行不存在", "text/html; charset=utf-8")
        : response(200, renderRun({ ...run, changes: await changesForWorkspace(run.workspaceId) }), "text/html; charset=utf-8");
    }
    if (method === "GET" && url.pathname.startsWith("/sessions/")) {
      const sessionId = decodeURIComponent(url.pathname.slice("/sessions/".length));
      const session = eventStore.getSession(sessionId);
      if (session === undefined) return response(404, "Session 不存在", "text/html; charset=utf-8");
      const memories = memoryStore.recall({ workspaceId: session.workspaceId, scope: "workspace", limit: 10 });
      return response(200, renderSession(redactValue({
        id: session.id,
        workspaceId: session.workspaceId,
        provider: session.provider,
        title: session.title,
        runs: sessionRuns(session.id),
        memories,
        changes: await changesForWorkspace(session.workspaceId)
      }) as Parameters<typeof renderSession>[0]), "text/html; charset=utf-8");
    }
    return response(404, { error: "Not found" });
  };

  return {
    inject: async (request) => handle(
      request.method.toUpperCase(),
      request.url,
      request.body === undefined ? request.payload : parseBody(request.headers?.["content-type"], request.body),
      request.headers
    ),
    listen: (port, host) => new Promise((resolve, reject) => {
      const server = createHttpServer(async (request, serverResponse) => {
        const payload = await readBody(request);
        const result = await handle(request.method?.toUpperCase() ?? "GET", request.url ?? "/", payload, request.headers);
        writeResponse(serverResponse, result);
      });
      server.once("error", reject);
      server.listen(port, host, () => {
        server.off("error", reject);
        resolve({ close: () => new Promise((closeResolve, closeReject) => server.close((error) => error ? closeReject(error) : closeResolve())) });
      });
    })
  };
}

export function createDefaultServer(options: { configPath?: string; dbPath?: string } = {}) {
  const registry = loadHarnessRegistry(
    options.configPath ?? process.env.HARNESS_CONFIG_PATH ?? "config/harness.example.yaml"
  );
  return createServer({
    registry,
    dbPath: options.dbPath ?? process.env.HARNESS_DB_PATH ?? "data/harness.sqlite"
  });
}

export async function startStandaloneWebServer(): Promise<void> {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  await createDefaultServer().listen(port, "0.0.0.0");
  console.log(`WebUI is listening on http://0.0.0.0:${port}`);
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString("utf8");
  return parseBody(request.headers["content-type"], body);
}

function parseBody(contentType: string | string[] | undefined, body: string): unknown {
  if (body === "") return undefined;
  if (contentType?.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(body));
  }
  try { return JSON.parse(body); } catch { return undefined; }
}

function writeResponse(serverResponse: ServerResponse, result: InjectResponse): void {
  serverResponse.writeHead(result.statusCode, result.headers);
  serverResponse.end(result.body);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startStandaloneWebServer().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
