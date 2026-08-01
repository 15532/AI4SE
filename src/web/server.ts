import "dotenv/config";
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { HarnessRegistry, loadHarnessRegistry } from "../config/harness-config.js";
import { runAgentLoop } from "../core/loop.js";
import { createProvider, type LLMProvider } from "../core/providers.js";
import { listWorkspaceFiles, readWorkspaceTextFile } from "../runtime/workspace-explorer.js";
import type { WorkspaceConfig } from "../runtime/workspace.js";
import { EventStore } from "../store/event-store.js";
import { MemoryStore } from "../store/memory-store.js";
import { renderIndex, renderRun, type PublicProvider, type PublicWorkspace } from "./views.js";

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
    .replace(credentialAssignmentPattern, (match) => `${match.slice(0, Math.max(match.indexOf("="), match.indexOf(":")) + 1)}[REDACTED]`)
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
    default: return stop === undefined ? "unknown" : "blocked";
  }
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
      timeline
    };
  };

  const handle = async (
    method: string,
    requestUrl: string,
    payload?: unknown,
    headers: Record<string, string | string[] | undefined> = {}
  ): Promise<InjectResponse> => {
    const url = new URL(requestUrl, "http://localhost");
    if (method === "GET" && url.pathname === "/") {
      return response(200, renderIndex(publicWorkspaces(), providers), "text/html; charset=utf-8");
    }
    if (method === "GET" && url.pathname === "/api/workspaces") {
      return response(200, publicWorkspaces());
    }
    const filesPrefix = "/api/workspaces/";
    if (method === "GET" && url.pathname.startsWith(filesPrefix) && url.pathname.endsWith("/files")) {
      const workspaceId = decodeURIComponent(url.pathname.slice(filesPrefix.length, -"/files".length));
      const workspace = registry.getWorkspace(workspaceId);
      return workspace === undefined
        ? response(404, { error: "Unknown workspace id" })
        : response(200, await listWorkspaceFiles(workspace));
    }
    if (method === "GET" && url.pathname.startsWith(filesPrefix) && url.pathname.includes("/files/")) {
      const remainder = url.pathname.slice(filesPrefix.length);
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
    if (method === "POST" && url.pathname === "/api/runs") {
      if (!isRunRequest(payload)) return response(400, { error: "Invalid run request" });
      const workspace = registry.getWorkspace(payload.workspaceId);
      if (workspace === undefined) return response(400, { error: "Unknown workspace id" });
      const providerConfig = registry.getProvider(payload.provider);
      if (providerConfig === undefined) return response(400, { error: "Unsupported provider" });

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
          memoryStore
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Provider request failed";
        if (message.startsWith("Missing API key for provider ")) return response(400, { error: message });
        return response(502, { error: "Provider request failed" });
      }
      if (result.runId === undefined) throw new Error("Persisted run did not return an id");
      if (String(headers["content-type"] ?? "").includes("application/x-www-form-urlencoded")) {
        return redirect(`/runs/${encodeURIComponent(result.runId)}`);
      }
      return response(201, { id: result.runId });
    }
    if (method === "GET" && url.pathname.startsWith("/api/runs/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/runs/".length));
      const run = storedRun(id);
      if (run === undefined) return response(404, { error: "Unknown run id" });
      const { task: _task, ...publicRun } = run;
      return response(200, publicRun);
    }
    if (method === "GET" && url.pathname.startsWith("/runs/")) {
      const id = decodeURIComponent(url.pathname.slice("/runs/".length));
      const run = storedRun(id);
      return run === undefined
        ? response(404, "运行不存在", "text/html; charset=utf-8")
        : response(200, renderRun(run), "text/html; charset=utf-8");
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
