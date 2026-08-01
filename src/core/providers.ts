import type { ProviderConfig } from "../config/harness-config.js";

export type LLMProvider = {
  complete(input: { task: string; context: string }): Promise<string>;
};

type FetchImpl = (url: string, init: RequestInit) => Promise<Response>;

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
  private readonly thinking: "enabled" | "disabled";
  private readonly fetchImpl: FetchImpl;

  constructor(input: {
    id: string;
    baseUrl: string;
    model: string;
    apiKey?: string;
    thinking?: "enabled" | "disabled";
    fetchImpl?: FetchImpl;
  }) {
    this.id = input.id;
    this.baseUrl = input.baseUrl.replace(/\/+$/, "");
    this.model = input.model;
    this.apiKey = input.apiKey;
    this.thinking = input.thinking ?? "disabled";
    this.fetchImpl = input.fetchImpl ?? fetch;
  }

  async complete(input: { task: string; context: string }): Promise<string> {
    if (this.apiKey === undefined || this.apiKey.trim() === "") {
      throw new Error(`Missing API key for provider ${this.id}`);
    }

    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
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
              "The discriminator field MUST be named \"type\".",
              "Do not use \"action\" as a field name.",
              "Valid action type values are read_file, write_file, list_files, run_command, remember, and finish.",
              "For a completed task, return exactly this shape: {\"type\":\"finish\",\"summary\":\"DeepSeek connected\"}."
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
  options: { env?: NodeJS.ProcessEnv; fetchImpl?: FetchImpl; mockResponses?: string[] } = {}
): LLMProvider {
  if (config.type === "mock") {
    return new MockLLMProvider(options.mockResponses ?? [JSON.stringify({ type: "finish", summary: "Mock run completed" })]);
  }

  return new OpenAICompatibleProvider({
    id: config.id,
    baseUrl: config.baseUrl,
    model: config.model,
    apiKey: (options.env ?? process.env)[config.apiKeyEnv],
    thinking: config.thinking,
    fetchImpl: options.fetchImpl
  });
}
