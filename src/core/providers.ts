export type LLMProvider = {
  complete(input: { task: string; context: string }): Promise<string>;
};

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
