import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { load } from "js-yaml";
import type { WorkspaceConfig } from "../runtime/workspace.js";

export type MockProviderConfig = { id: string; type: "mock" };
export type DeepSeekProviderConfig = {
  id: string;
  type: "deepseek-compatible";
  baseUrl: string;
  model: string;
  apiKeyEnv: string;
  thinking: "enabled" | "disabled";
};
export type ProviderConfig = MockProviderConfig | DeepSeekProviderConfig;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} must be a non-empty string`);
  return value;
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${field} must be an array of strings`);
  }
  return value;
}

function optionalString(value: unknown, fallback: string, field: string): string {
  if (value === undefined) return fallback;
  return requiredString(value, field);
}

function optionalThinking(value: unknown): "enabled" | "disabled" {
  if (value === undefined) return "disabled";
  if (value === "enabled" || value === "disabled") return value;
  throw new Error("provider thinking must be enabled or disabled");
}

export class HarnessRegistry {
  readonly mode: string;
  readonly maxIterations: number;
  private readonly workspaces: WorkspaceConfig[];
  private readonly workspaceById: Map<string, WorkspaceConfig>;
  private readonly providerById: Map<string, ProviderConfig>;

  constructor(input: {
    mode: string;
    maxIterations: number;
    workspaces: WorkspaceConfig[];
    providers: ProviderConfig[];
  }) {
    this.mode = input.mode;
    this.maxIterations = input.maxIterations;
    this.workspaces = input.workspaces;
    this.workspaceById = new Map(input.workspaces.map((workspace) => [workspace.id, workspace]));
    this.providerById = new Map(input.providers.map((provider) => [provider.id, provider]));
  }

  getWorkspace(id: string): WorkspaceConfig | undefined {
    return this.workspaceById.get(id);
  }

  getProvider(id: string): ProviderConfig | undefined {
    return this.providerById.get(id);
  }

  listProviders(): ProviderConfig[] {
    return [...this.providerById.values()];
  }

  listWorkspaces(): WorkspaceConfig[] {
    return [...this.workspaces];
  }
}

export function loadHarnessRegistry(configPath: string): HarnessRegistry {
  const absoluteConfigPath = resolve(configPath);
  const parsed = load(readFileSync(absoluteConfigPath, "utf8"));
  if (!isRecord(parsed)) throw new Error("Harness config must be a YAML object");

  const mode = requiredString(parsed.mode, "mode");
  const maxIterations = parsed.maxIterations;
  if (!Number.isInteger(maxIterations) || (maxIterations as number) < 1) {
    throw new Error("maxIterations must be a positive integer");
  }

  if (!Array.isArray(parsed.providers)) throw new Error("providers must be an array");
  const providerIds = new Set<string>();
  const providers = parsed.providers.map((provider, index): ProviderConfig => {
    if (!isRecord(provider)) throw new Error(`providers[${index}] must be an object`);
    const id = requiredString(provider.id, `providers[${index}].id`);
    if (providerIds.has(id)) throw new Error(`Duplicate provider id: ${id}`);
    providerIds.add(id);
    if (provider.type === "mock") return { id, type: "mock" };
    if (provider.type === "deepseek-compatible") {
      return {
        id,
        type: "deepseek-compatible",
        baseUrl: requiredString(provider.baseUrl, `providers[${index}].baseUrl`),
        model: requiredString(provider.model, `providers[${index}].model`),
        apiKeyEnv: optionalString(provider.apiKeyEnv, "DEEPSEEK_API_KEY", `providers[${index}].apiKeyEnv`),
        thinking: optionalThinking(provider.thinking)
      };
    }
    throw new Error(`Unsupported provider type: ${String(provider.type)}`);
  });

  if (!Array.isArray(parsed.workspaces)) throw new Error("workspaces must be an array");
  const workspaceIds = new Set<string>();
  const configDirectory = dirname(absoluteConfigPath);
  const workspaces = parsed.workspaces.map((workspace, index): WorkspaceConfig => {
    if (!isRecord(workspace)) throw new Error(`workspaces[${index}] must be an object`);
    const id = requiredString(workspace.id, `workspaces[${index}].id`);
    if (workspaceIds.has(id)) throw new Error(`Duplicate workspace id: ${id}`);
    workspaceIds.add(id);
    return {
      id,
      name: requiredString(workspace.name, `workspaces[${index}].name`),
      root: resolve(configDirectory, requiredString(workspace.root, `workspaces[${index}].root`)),
      allowedCommands: stringArray(workspace.allowedCommands, `workspaces[${index}].allowedCommands`)
    };
  });

  return new HarnessRegistry({ mode, maxIterations: maxIterations as number, workspaces, providers });
}
