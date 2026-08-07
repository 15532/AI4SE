import type { ProviderConfig } from "../config/harness-config.js";

export type LLMProvider = {
  complete(input: { task: string; context: string }): Promise<string>;
};

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;
type ApiKeyResolver = () => string | undefined | Promise<string | undefined>;

export class MockLLMProvider implements LLMProvider {
  private readonly responses: string[];
  private responseIndex = 0;

  constructor(responses: string[]) {
    this.responses = responses;
  }

  async complete(_input: { task: string; context: string }): Promise<string> {
    const response = this.responses[this.responseIndex];
    this.responseIndex += 1;
    return response ?? JSON.stringify({ type: "finish", summary: "No scripted response remains" });
  }
}

export class OpenAICompatibleProvider implements LLMProvider {
  private readonly id: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly apiKey: string | undefined;
  private readonly apiKeyResolver: ApiKeyResolver | undefined;
  private readonly thinking: "enabled" | "disabled";
  private readonly fetchImpl: FetchImpl;

  constructor(input: {
    id: string;
    baseUrl: string;
    model: string;
    apiKey?: string;
    apiKeyResolver?: ApiKeyResolver;
    thinking?: "enabled" | "disabled";
    fetchImpl?: FetchImpl;
  }) {
    this.id = input.id;
    this.baseUrl = input.baseUrl.replace(/\/+$/, "");
    this.model = input.model;
    this.apiKey = input.apiKey;
    this.apiKeyResolver = input.apiKeyResolver;
    this.thinking = input.thinking ?? "disabled";
    this.fetchImpl = input.fetchImpl ?? fetch;
  }

  async complete(input: { task: string; context: string }): Promise<string> {
    const apiKey = this.apiKey ?? await this.apiKeyResolver?.();
    if (apiKey === undefined || apiKey.trim() === "") {
      throw new Error(`Missing API key for provider ${this.id}`);
    }

    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        response_format: { type: "json_object" },
        thinking: { type: this.thinking },
        messages: [
          {
            role: "system",
            content: [
              "You are the decision model for a Coding Agent Harness.",
              "Return exactly one strict JSON Action object and no markdown or prose.",
              "Never concatenate multiple JSON objects in a single response; if you need to perform several steps, return one action now and continue in the next turn.",
              "The discriminator field MUST be named \"type\".",
              "Do not use \"action\" as a field name.",
              "Valid action type values are read_file, write_file, list_files, run_command, remember, and finish.",
              "For a completed task, return exactly this shape: {\"type\":\"finish\",\"summary\":\"DeepSeek connected\"}.",
              "finish.summary must be written in Chinese and be detailed: it must describe what was implemented, list every file created or modified, summarize the key changes in each file, state which verification commands were actually run and their outcomes, and mention anything skipped or left incomplete.",
              "A good finish.summary is 4-8 Chinese sentences, not a short English phrase and not a single summary line.",
              "Never claim that a verification command (for example npm test, node --check, npm run build) succeeded unless you actually ran that exact command in this run via the run_command action and observed its result.",
              "If you did not run a verification command, say so honestly in finish.summary instead of inventing a successful verification.",
              "The Allowed commands in the harness context are executable as-is via run_command (for example npm test, npm run build). When the task asks for verification, run one of them instead of claiming verification is impossible; if unsure whether a script exists, read package.json first and then run the command.",
              "As a coding agent, inspect the workspace before editing.",
              "after writing code, run an allowed verification command.",
              "When the task asks for a new small program or algorithm, create or update files in the current workspace.",
              "Do not repeatedly list files after you already know the project layout; read a likely file, write the change, then verify.",
              "Do not use previous run summaries as proof for the current task; if the current task asks for verification, verify it in this run.",
              "finish after successful verification instead of repeating read_file, list_files, or write_file.",
              "if feedback reports invalid_action, return a corrected JSON action.",
              "if feedback reports safety_blocked, choose a safer allowed action.",
              "do not finish just because the user greeted you; finish only when the task is complete or no code action is needed."
            ].join(" ")
          },
          {
            role: "user",
            content: `Task:\n${input.task}\n\nHarness context:\n${input.context}`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Provider ${this.id} request failed with status ${response.status}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new Error(`Provider ${this.id} returned an empty response`);
    }
    return content;
  }
}

export function createProvider(
  config: ProviderConfig,
  options: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: FetchImpl;
    mockResponses?: string[];
    credentialResolver?: (providerId: string, envName: string) => string | undefined | Promise<string | undefined>;
  } = {}
): LLMProvider {
  if (config.type === "mock") {
    return new MockLLMProvider(options.mockResponses ?? [JSON.stringify({ type: "finish", summary: "Mock run completed" })]);
  }

  return new OpenAICompatibleProvider({
    id: config.id,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: options.credentialResolver === undefined ? (options.env ?? process.env)[config.apiKeyEnv] : undefined,
    apiKeyResolver: options.credentialResolver === undefined
      ? undefined
      : () => options.credentialResolver?.(config.id, config.apiKeyEnv),
    thinking: config.thinking,
    fetchImpl: options.fetchImpl
  });
}
