# Requirements Summary

This file summarizes the two assignment documents for quick local reference. The source of truth remains the original course documents.

## Universal Requirements

- Use Superpowers workflow honestly.
- Produce `SPEC.md`, `PLAN.md`, `SPEC_PROCESS.md`, `AGENT_LOG.md`, `README.md`, `REFLECTION.md`.
- Do not implement code before SPEC/PLAN and cold-start validation.
- Use TDD: red, green, refactor.
- Use worktrees and PR-style history for independent modules.
- Protect all API keys and credentials.
- Provide distribution instructions.
- Provide CI with passing tests.
- Provide an accessible WebUI URL.

## Project A Specific Requirements

- Implement a Coding Agent Harness kernel yourself.
- Do not depend on an existing high-level agent loop such as LangChain `AgentExecutor`, AutoGen, CrewAI, LlamaIndex agent runners, or a host coding-agent SDK.
- Implement an injectable LLM abstraction and mock/stub LLM.
- Implement deterministic code mechanisms for:
  - tool dispatch
  - governance guardrails
  - feedback loop
  - memory
  - stop conditions
- Core mechanisms must be testable without real LLMs or network access.
- Submit a mechanism demonstration showing:
  - a dangerous action blocked by guardrails
  - a failure injected into the loop and used to change the next action
  - one deterministic behavior from the main contribution dimension

