import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { runAgentLoop } from "../core/loop";
import { MockLLMProvider, type LLMProvider } from "../core/providers";
import type { WorkspaceConfig } from "../runtime/workspace";
import { renderIndex, type PublicWorkspace } from "./views";

type InjectInput = {
  method: string;
  url: string;
  payload?: unknown;
  headers?: Record<string, string | undefined>;
  body?: string;
};
type InjectResponse = { statusCode: number; body: string; json(): unknown };
type RunRecord = {
  id: string;
  workspaceId: string;
  status: string;
  timeline: Record<string, unknown>[];
};

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

function publicWorkspace(workspace: WorkspaceConfig): PublicWorkspace {
  return redactValue({
    id: workspace.id,
    name: workspace.name,
    allowedCommands: workspace.allowedCommands
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
  return { statusCode, body, json: () => JSON.parse(body) };
}

export function createServer(input: {
  workspaces: WorkspaceConfig[];
  providerFactory?: (provider: string) => LLMProvider;
}): {
  inject(input: InjectInput): Promise<InjectResponse>;
  listen(port: number, host?: string): Promise<{ close(): Promise<void> }>;
} {
  const workspaceById = new Map(input.workspaces.map((workspace) => [workspace.id, workspace]));
  const runs = new Map<string, RunRecord>();
  const workspaces = input.workspaces.map(publicWorkspace);

  const handle = async (method: string, requestUrl: string, payload?: unknown): Promise<InjectResponse> => {
    const url = new URL(requestUrl, "http://localhost");
    if (method === "GET" && url.pathname === "/") {
      return response(200, renderIndex(workspaces), "text/html; charset=utf-8");
    }
    if (method === "GET" && url.pathname === "/api/workspaces") {
      return response(200, workspaces);
    }
    if (method === "POST" && url.pathname === "/api/runs") {
      if (!isRunRequest(payload)) return response(400, { error: "Invalid run request" });
      const workspace = workspaceById.get(payload.workspaceId);
      if (workspace === undefined) return response(400, { error: "Unknown workspace id" });
      if (payload.provider !== "mock") return response(400, { error: "Unsupported provider" });

      const provider = input.providerFactory?.("mock") ?? new MockLLMProvider([]);
      const result = await runAgentLoop({
        task: payload.task,
        workspace,
        provider,
        maxIterations: 10,
        mode: "webui"
      });
      const id = randomUUID();
      runs.set(id, {
        id,
        workspaceId: workspace.id,
        status: result.status,
        timeline: redactValue(result.events) as Record<string, unknown>[]
      });
      return response(201, { id });
    }
    if (method === "GET" && url.pathname.startsWith("/api/runs/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/runs/".length));
      const run = runs.get(id);
      return run === undefined ? response(404, { error: "Unknown run id" }) : response(200, run);
    }
    return response(404, { error: "Not found" });
  };

  return {
    inject: async (request) => handle(
      request.method.toUpperCase(),
      request.url,
      request.body === undefined ? request.payload : parseBody(request.headers?.["content-type"], request.body)
    ),
    listen: (port, host) => new Promise((resolve, reject) => {
      const server = createHttpServer(async (request, serverResponse) => {
        const payload = await readBody(request);
        const result = await handle(request.method?.toUpperCase() ?? "GET", request.url ?? "/", payload);
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
  serverResponse.writeHead(result.statusCode, { "content-type": result.body.startsWith("<!doctype") ? "text/html; charset=utf-8" : "application/json; charset=utf-8" });
  serverResponse.end(result.body);
}
