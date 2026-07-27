# SPEC: Coding Agent Harness

Status: Superpowers brainstorming design approved; ready for user review before writing implementation plan.

## 1. Problem Statement

Raw LLM output is not a reliable coding agent by itself. A useful coding agent needs a harness: deterministic code that controls what the model may see, what actions it may request, which tools actually run, how dangerous operations are blocked, how objective feedback is returned, how memory is persisted, and how credentials are protected.

This project builds a TypeScript Coding Agent Harness for students, reviewers, and developers who want to inspect how agentic software engineering can be made safer and more verifiable. The project is not a wrapper around an existing agent runner. The delivered harness kernel implements its own loop, tool dispatch, guardrails, feedback sensors, memory, configuration, CLI, and WebUI.

## 2. Chosen Direction

- Project type: A - Coding Agent Harness
- Product name: Coding Agent Harness
- Main contribution: governance guardrails plus deterministic feedback loop
- Architecture: Typed JSON Action Harness
- Product shape: TypeScript CLI plus WebUI
- LLM interface: OpenAI-compatible chat API behind an injectable LLM abstraction
- Test strategy: mock/stub LLM deterministic tests before real LLM integration
- Distribution: Docker image and Docker Compose deployment behind Nginx
- State storage: SQLite
- Credential storage: operating-system keychain first; `.env` only as explicitly enabled development fallback
- WebUI policy: WebUI can trigger real harness runs, but only against pre-registered workspaces and the same guardrails/allowlists as CLI runs

## 3. User Stories

1. As a developer, I want the harness to run a coding task inside a bounded workspace so that agent actions cannot silently affect unrelated files.
2. As a reviewer, I want dangerous shell and file actions to be blocked before execution so that unsafe behavior is governed by code rather than prompt wording.
3. As a developer, I want test/lint/build feedback to be fed back into the agent loop so that failed attempts can drive a revised next action.
4. As a teaching assistant, I want a mock LLM demonstration that deterministically reproduces guardrail blocking and feedback correction so that mechanisms can be graded without network access.
5. As an operator, I want API keys stored outside the repository and never printed in logs or WebUI responses so that the project can be safely distributed.
6. As a visitor, I want a WebUI that can trigger runs for pre-registered workspaces and show the full timeline of actions, guardrails, tool results, feedback, and stop reasons.

## 4. Functional Modules

The project has six responsibilities, each implemented as a distinct module with tests.

### 4.1 Agent Loop Core

Owns the harness main loop:

1. Build bounded context from task, workspace configuration, recent feedback, and selected memory.
2. Call an injected `LLMProvider`.
3. Parse exactly one JSON action.
4. Send the action through guardrails.
5. Dispatch approved actions to tools.
6. Convert results into feedback.
7. Persist events.
8. Continue or stop.

This loop is project code. It must not delegate the loop to LangChain `AgentExecutor`, AutoGen, CrewAI, LlamaIndex agent runners, or a host coding-agent SDK.

### 4.2 Tool And Workspace Runtime

Owns workspace registration, path boundary checks, file tools, and allowlisted shell execution. CLI and WebUI must both select workspaces by configured workspace id, not arbitrary path input.

### 4.3 Governance Guardrail Engine

Owns deterministic action classification before execution. The result is:

```ts
type GuardrailDecision =
  | { decision: "allow" }
  | { decision: "block"; reason: string; ruleId: string }
  | { decision: "require_approval"; reason: string; ruleId: string };
```

### 4.4 Feedback And Self-Correction Engine

Owns deterministic sensors that convert parser errors, guardrail decisions, command results, and test/lint/typecheck output into structured feedback for the next loop iteration.

### 4.5 Memory And Event Store

Owns SQLite persistence for runs, events, actions, feedback, and bounded memory. Memory retrieval is explicit and scoped; the harness must not blindly load all historical data into context.

### 4.6 Credential, CLI, And WebUI Interface

Owns credential status/set/clear flows, CLI commands, WebUI run controls, timeline display, and deployment-facing behavior. It must never print or persist secret values.

## 5. JSON Action Protocol

The LLM must output exactly one strict JSON action object per loop iteration. Natural language outside the JSON object is invalid. Invalid JSON is not executed and becomes `invalid_action` feedback.

Supported v1 actions:

```json
{ "type": "read_file", "path": "src/index.ts", "reason": "inspect entrypoint" }
```

```json
{ "type": "write_file", "path": "src/index.ts", "content": "...", "reason": "apply fix" }
```

```json
{ "type": "list_files", "path": ".", "reason": "discover structure" }
```

```json
{ "type": "run_command", "command": "npm test", "reason": "verify tests" }
```

```json
{
  "type": "remember",
  "key": "project.testCommand",
  "value": "npm test",
  "scope": "workspace",
  "reason": "store discovered project convention"
}
```

```json
{ "type": "finish", "summary": "Requested change is complete" }
```

Constraints:

- One loop iteration executes at most one action.
- There is no batch action in v1.
- Human approval is not an LLM action. Approval is a harness state created by `GuardrailEngine`.
- Action parsing, validation, and rejection must be testable without a real LLM.

## 6. Tools And Workspace Boundaries

Workspaces are pre-registered in configuration:

```yaml
workspaces:
  - id: demo-ts
    name: TypeScript Demo
    root: ./examples/demo-ts
    allowedCommands:
      - npm test
      - npm run lint
      - npm run typecheck
      - npm run build
  - id: course-project
    name: Course Project
    root: D:/Projects/AI4SE
    allowedCommands:
      - npm test
      - npm run build
```

Rules:

- CLI and WebUI select a workspace by id.
- WebUI cannot accept arbitrary server paths.
- All file paths are resolved relative to the selected workspace root.
- Any path that escapes the workspace root is blocked.
- Shell commands must exactly match the selected workspace's `allowedCommands`.
- v1 does not allow arbitrary parameters such as `npm test -- <pattern>`.
- The default TypeScript allowlist is `npm test`, `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

## 7. Domain And Mechanism Design

Project A requires the harness to implement six dimensions: decision, tools, memory, governance, feedback, and configuration. This design maps them as follows:

- Decision: `AgentLoop` owns context assembly, provider calls, action parsing, dispatch, feedback, and stop conditions.
- Tools: `ToolDispatcher` owns file tools and allowlisted shell execution.
- Memory: `remember` action writes scoped memory to SQLite; context building retrieves bounded memory by workspace scope.
- Governance: `GuardrailEngine` classifies actions before execution using deterministic rules.
- Feedback: `FeedbackSensors` parse objective results into structured feedback that affects the next LLM call.
- Configuration: workspace registry, command allowlists, provider profiles, max iterations, and WebUI execution mode are declarative config loaded by project code.

Main contribution: governance plus feedback loop. These mechanisms must remain meaningful after removing the real LLM and replacing it with a mock/stub LLM.

## 8. Guardrail Rules

Initial deterministic rules:

- `path.escape_workspace`: block any file action whose resolved path is outside the selected workspace root.
- `command.not_allowlisted`: block any command that does not exactly match the current workspace allowlist.
- `command.destructive_delete`: block destructive delete commands such as `rm -rf`, `del /s`, and `Remove-Item -Recurse`.
- `command.secret_access`: block attempts to read or print `.env`, private keys, token files, or known secret paths.
- `command.publish_or_deploy`: block `git push`, `npm publish`, `docker push`, and deployment commands in v1.
- `write.sensitive_file`: block writes to `.env`, private key files, and secret-bearing configuration files.

`require_approval` exists in the data model and UI state, but v1 defaults high-risk operations to `block` until an explicit human approval implementation is added.

## 9. Feedback Loop

Feedback sensors produce structured feedback:

- invalid JSON or invalid action shape -> `invalid_action`
- guardrail block -> `safety_blocked`
- nonzero command exit -> `command_failed`
- test failure output -> `test_failed`
- lint/typecheck failure output -> `static_check_failed`
- successful tool result -> `tool_succeeded`
- missing credential -> `credential_missing`

The next LLM context includes recent feedback entries with source, severity, concise message, and relevant payload. The mock mechanism demo must prove that feedback changes the next mock LLM action.

## 10. LLM Providers

`LLMProvider` is an injectable abstraction. Required providers:

- `MockLLMProvider`: deterministic scripted responses for tests and demos; no network.
- `OpenAICompatibleProvider`: real provider mode using an OpenAI-compatible chat completion endpoint.

The provider layer performs a single completion call only. It does not provide an agent loop or tool runner.

## 11. WebUI

WebUI capabilities:

- list pre-registered workspaces
- choose workspace id
- enter task description
- choose mock or real provider profile
- trigger a harness run
- show run timeline
- show action JSON, guardrail decisions, tool results, feedback, memory events, and stop reason
- show pending approval states when they occur

Security boundary:

- The WebUI may trigger real runs.
- It cannot choose arbitrary filesystem paths.
- It cannot display API keys.
- It uses the same workspace registry, allowlist, guardrails, and feedback sensors as CLI.
- No password is required in v1 by user decision. This is a known risk. Public deployments should be treated as trusted-network or short-term course-demo deployments until authentication is added.

Future improvement: add `WEBUI_ADMIN_PASSWORD` or reverse-proxy authentication before any long-lived public deployment.

## 12. Credentials And Threat Model

Threats:

- real API key committed to Git
- real key printed in logs or terminal output
- real key returned to WebUI
- `.env` accidentally deployed or committed
- key stored in SQLite event payloads

Controls:

- OS keychain is the primary credential store.
- CLI supports `credentials status`, `credentials set`, and `credentials clear`.
- `credentials status` shows only provider and existence, never secret value.
- `.env` is a development fallback only when explicitly enabled.
- `.env` and common secret files are ignored by Git.
- Event store and WebUI responses must redact secret-like values.
- Real provider run fails with structured `credential_missing` feedback when no key is available.

## 13. Data Model

Main SQLite entities:

- Run: id, mode, provider_profile, workspace_id, task, status, started_at, ended_at, stop_reason
- Event: id, run_id, sequence, kind, payload_json, created_at
- Action: id, run_id, sequence, action_type, payload_json, guardrail_decision, created_at
- Feedback: id, run_id, sequence, source, severity, message, payload_json, created_at
- MemoryItem: id, workspace_id, scope, key, value_json, created_at, updated_at
- WorkspaceConfigSnapshot: id, run_id, workspace_id, root, allowed_commands_json, created_at

Secret values must never be stored in SQLite.

## 14. Non-Functional Requirements

Security:

- No real key may be committed, logged, printed, or stored in SQLite.
- All file actions are workspace-bounded.
- All shell actions are allowlist-bounded.
- WebUI real runs are limited to pre-registered workspaces.

Reliability:

- Max iterations prevents infinite loops.
- Tool failures become structured feedback.
- Invalid LLM output never triggers tool execution.
- Event logs explain each action decision.

Performance:

- Mock mechanism demo completes in under 5 seconds on a typical laptop.
- Real provider calls use configurable timeout.

Observability:

- Each run records action, guardrail decision, tool result, feedback, memory event, and stop reason.

## 15. Testing And Mechanism Demo

One-command test entry:

```bash
npm test
```

Required deterministic tests:

- mock LLM returns `finish`; loop stops normally
- invalid JSON becomes `invalid_action` feedback
- dangerous `run_command` is blocked by guardrail
- failed test feedback causes mock LLM's next action to change
- workspace path traversal is rejected
- non-allowlisted command is rejected
- allowlisted command dispatch can run in a temp workspace
- `remember` writes scoped memory and context builder retrieves it
- credential status never reveals secret value
- WebUI run API accepts only registered workspace ids
- WebUI real run path uses the same guardrail and allowlist as CLI

Mechanism demo command:

```bash
npm run demo:mechanisms
```

The demo must deterministically show:

1. mock LLM attempts a dangerous command and guardrail blocks it
2. injected test failure becomes feedback
3. mock LLM changes its next action because of that feedback
4. final timeline shows governance plus feedback as the main contribution

## 16. Technology Choices

- TypeScript: shared language for core, CLI, WebUI server, and tests
- Node.js: practical runtime for CLI, server, SQLite, keychain integration, and Docker
- Vitest or equivalent: deterministic unit testing
- SQLite: local persistent run history, memory, and WebUI timeline
- OpenAI-compatible API: flexible real LLM provider path
- Docker and Docker Compose: reproducible distribution and cloud-server deployment
- GitHub Actions plus `.gitlab-ci.yml`: user preference plus course checklist compatibility

## 17. Acceptance Criteria

- `npm test` runs all core mechanism tests with no network.
- The harness main loop is project-owned code.
- A mock LLM run completes without a real LLM.
- A dangerous action is blocked before execution.
- A failure feedback event changes the next mock LLM action.
- `remember` action persists scoped memory and context retrieval is bounded.
- CLI can manage credential status/set/clear without printing secrets.
- WebUI can trigger runs only for pre-registered workspaces.
- WebUI displays action, guardrail, feedback, and stop reason timelines.
- Docker deployment instructions run the WebUI on a fresh server.
- CI passes with a job named `unit-test`; `.gitlab-ci.yml` also contains `unit-test`.
- README documents install, run, distribution, key configuration, directory structure, and security boundaries.
- No real credentials appear in source, logs, docs, SQLite, or Git history.

## 18. Risks And Open Questions

- WebUI has no password in v1 by user decision; public real-run deployment is a known risk and should be treated as trusted-network or short-term demo only.
- OS keychain behavior differs between Windows, Linux, and Docker; tests must use fake keychain adapters.
- Exact output parsing for test/lint/typecheck failures must start simple and deterministic.
- Cursor cold-start validation is still pending and may reveal missing interfaces or unclear task boundaries.

