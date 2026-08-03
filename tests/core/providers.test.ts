import { describe, expect, it } from "vitest";
import { createProvider, OpenAICompatibleProvider } from "../../src/core/providers";

describe("OpenAICompatibleProvider", () => {
  it("calls the DeepSeek chat completions API and returns message content", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requests.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({
        choices: [{ message: { content: "{\"type\":\"finish\",\"summary\":\"done\"}" } }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const provider = new OpenAICompatibleProvider({
      id: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      apiKey: "ds-test-key",
      thinking: "disabled",
      fetchImpl
    });

    const content = await provider.complete({ task: "finish", context: "context" });

    expect(content).toBe("{\"type\":\"finish\",\"summary\":\"done\"}");
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://api.deepseek.com/chat/completions");
    expect(requests[0].init.method).toBe("POST");
    expect(requests[0].init.headers).toEqual(expect.objectContaining({
      authorization: "Bearer ds-test-key",
      "content-type": "application/json"
    }));
    expect(JSON.parse(String(requests[0].init.body))).toEqual({
      model: "deepseek-v4-flash",
      stream: false,
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      messages: [
        expect.objectContaining({ role: "system", content: expect.stringContaining("strict JSON Action") }),
        expect.objectContaining({ role: "user", content: expect.stringContaining("finish") })
      ]
    });
  });

  it("fails before making a request when the API key is missing", async () => {
    const provider = new OpenAICompatibleProvider({
      id: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      apiKey: "",
      thinking: "disabled",
      fetchImpl: async () => {
        throw new Error("fetch should not be called");
      }
    });

    await expect(provider.complete({ task: "finish", context: "context" }))
      .rejects.toThrow("Missing API key for provider deepseek");
  });

  it("instructs real models to use the harness type field instead of action", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchImpl = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        choices: [{ message: { content: "{\"type\":\"finish\",\"summary\":\"done\"}" } }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const provider = new OpenAICompatibleProvider({
      id: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      apiKey: "ds-test-key",
      thinking: "disabled",
      fetchImpl
    });

    await provider.complete({ task: "finish", context: "context" });

    const messages = requestBody?.messages as Array<{ role: string; content: string }>;
    expect(messages[0].content).toContain('{"type":"finish","summary":"DeepSeek connected"}');
    expect(messages[0].content).toContain('Do not use "action" as a field name');
    expect(messages[0].content).toContain("finish.summary must be written in Chinese");
    expect(messages[0].content).toContain("changed files");
    expect(messages[0].content).toContain("verification result");
  });

  it("instructs real models to behave like a coding agent instead of a chat bot", async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchImpl = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        choices: [{ message: { content: "{\"type\":\"finish\",\"summary\":\"done\"}" } }]
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const provider = new OpenAICompatibleProvider({
      id: "deepseek",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      apiKey: "ds-test-key",
      fetchImpl
    });

    await provider.complete({ task: "fix failing tests", context: "context" });

    const messages = requestBody?.messages as Array<{ role: string; content: string }>;
    expect(messages[0].content).toContain("inspect the workspace before editing");
    expect(messages[0].content).toContain("after writing code, run an allowed verification command");
    expect(messages[0].content).toContain("When the task asks for a new small program or algorithm, create or update files in the current workspace");
    expect(messages[0].content).toContain("Do not repeatedly list files after you already know the project layout");
    expect(messages[0].content).toContain("if feedback reports invalid_action, return a corrected JSON action");
    expect(messages[0].content).toContain("do not finish just because the user greeted you");
    expect(messages[0].content).toContain("finish after successful verification");
  });

  it("uses credential resolver before environment variables when creating providers", async () => {
    const requests: Array<{ init: RequestInit }> = [];
    const provider = createProvider({
      id: "deepseek",
      type: "deepseek-compatible",
      baseUrl: "https://api.deepseek.com",
      model: "deepseek-v4-flash",
      apiKeyEnv: "DEEPSEEK_API_KEY",
      thinking: "disabled"
    }, {
      env: { DEEPSEEK_API_KEY: "env-secret" },
      credentialResolver: async () => "stored-secret",
      fetchImpl: async (_url, init) => {
        requests.push({ init });
        return new Response(JSON.stringify({
          choices: [{ message: { content: "{\"type\":\"finish\",\"summary\":\"done\"}" } }]
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
    });

    await provider.complete({ task: "finish", context: "context" });

    expect(requests[0].init.headers).toEqual(expect.objectContaining({
      authorization: "Bearer stored-secret"
    }));
  });
});
