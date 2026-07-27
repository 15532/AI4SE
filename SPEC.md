# SPEC: Coding Agent Harness

Status: Draft for pre-implementation review

## 1. Problem Statement

Modern coding agents can propose useful next actions, but raw LLM output is not enough to make a reliable engineering system. This project builds a Coding Agent Harness that wraps an LLM with deterministic engineering mechanisms: tool dispatch, guardrails, feedback loops, memory, configuration, and observable execution records.

Target users are software engineering students, teaching assistants, and developers who want to study how a coding agent can be made safer and more verifiable. The project is worth building because the course project asks not merely whether an LLM can write code, but what engineering remains when the LLM is only one uncertain component inside a larger system.

## 2. Chosen Direction

- Project type: A - Coding Agent Harness
- Product name: Coding Agent Harness
- Main contribution: governance guardrails plus deterministic feedback loop
- Product shape: TypeScript CLI plus WebUI
- Runtime mode for public WebUI: mock/demo mode only
- LLM interface: OpenAI-compatible chat API behind an injectable LLM abstraction
- Test strategy: mock/stub LLM deterministic tests before real LLM integration
- Distribution: Docker image and Docker Compose deployment behind Nginx
- State storage: SQLite
- Credential storage: operating-system keychain first; `.env` only as development fallback with documented plaintext risk

## 3. User Stories

1. As a developer, I want the harness to run a coding task in a bounded workspace so that agent actions cannot silently affect unrelated files.
2. As a reviewer, I want dangerous shell actions to be blocked before execution so that unsafe behavior is handled by code rather than prompt wording.
3. As a developer, I want test/lint/build feedback to be fed back into the agent loop so that failed attempts can lead to a revised next action.
4. As a teaching assistant, I want a mock LLM demonstration that deterministically reproduces guardrail blocking and feedback correction so that the mechanism can be graded without network access.
5. As an operator, I want API keys stored outside the repository and never printed in logs so that the project can be safely distributed.
6. As a visitor, I want a WebUI that shows demo runs, blocked actions, and feedback events so that I can inspect the harness behavior without running a real coding agent on the public server.

## 4. Functional Specification

### 4.1 Agent Main Loop

Input: task description, workspace path, config profile, optional memory context.

Behavior: build context, call injected LLM, parse structured action, pass action through guardrails, dispatch approved tool, collect tool result, run feedback sensors when configured, append event log, decide whether to continue or stop.

Output: final run status, event timeline, artifacts, feedback summary.

Errors: invalid LLM output becomes a feedback event; max-iteration exhaustion stops safely; blocked action records a paused or rejected event.

### 4.2 Tools

Minimum tools:

- Read file
- Write file inside workspace
- List files inside workspace
- Run allowlisted shell commands for tests, lint, and build

Boundary: file tools must reject paths outside the configured workspace. Shell execution must use an allowlist and must pass through the guardrail layer.

### 4.3 Governance Guardrails

Guardrails are deterministic code mechanisms. They must classify actions before execution and return one of: allow, block, or require human approval.

Initial dangerous actions:

- Recursive deletion or broad delete commands
- Commands touching parent directories outside the workspace
- Network publish or deploy commands
- Commands attempting to read known secret files
- Shell commands not present in the configured allowlist

### 4.4 Feedback Loop

Feedback sensors parse objective command results and convert them into structured feedback for the next loop iteration.

Minimum sensors:

- Test result sensor
- Lint/typecheck result sensor
- Invalid action/output sensor
- Guardrail block sensor

The mock LLM demo must show one failed command result causing the next LLM action to change.

### 4.5 Memory

SQLite stores run events, decisions, workspace summaries, and project conventions. Memory retrieval is explicit and bounded; the harness must not blindly load all history into LLM context.

### 4.6 Configuration

Configuration defines workspace root, tool allowlist, max iterations, LLM provider profile, feedback sensors, and WebUI mode. Config files are content, not a substitute for deterministic code mechanisms.

### 4.7 CLI

The CLI will support:

- Running a task in mock mode
- Running a task with a real OpenAI-compatible provider
- Managing credential status/update/clear without printing secrets
- Running the mechanism demonstration

### 4.8 WebUI

The WebUI will show mock/demo run history, blocked action records, feedback transitions, and mechanism demonstration results. The public deployment must not execute real shell commands or use real API keys.

## 5. Domain And Mechanism Design

Coding feedback signals are test, lint, typecheck, command exit status, and structured parser errors. Dangerous actions are shell commands and file operations that can escape the workspace, delete important data, publish artifacts, or expose credentials. Required tools are bounded file tools and restricted shell execution.

The main contribution is the governance plus feedback loop:

- Guardrails are implemented as deterministic action classifiers.
- Feedback sensors are implemented as deterministic parsers that produce structured loop input.
- The main loop is implemented by project code, not by LangChain AgentExecutor, AutoGen, CrewAI, LlamaIndex agent runners, or a host coding-agent SDK.
- Every core mechanism must remain testable with a mock/stub LLM and no network access.

## 6. Non-Functional Requirements

Security:

- No real key may be committed, logged, or printed.
- Key status may show whether a key exists, but never the value.
- `.env` is allowed only for local development fallback and is documented as plaintext.
- Public WebUI uses mock/demo mode only until explicit authentication and sandboxing are implemented.

Reliability:

- Max iterations must prevent infinite loops.
- Tool failures must become structured feedback, not unhandled crashes.
- Event logs must be sufficient to explain each action decision.

Performance:

- Mock demos should complete in under 5 seconds on a typical laptop.
- Real LLM calls should be isolated behind timeout-capable provider code.

Observability:

- Each run records action, guardrail decision, tool result, feedback, and stop reason.

## 7. System Architecture

Components:

- CLI entrypoint
- WebUI server
- Agent loop core
- LLM provider abstraction
- Mock LLM
- Action parser
- Tool dispatcher
- Guardrail engine
- Feedback sensors
- SQLite event store
- Credential manager
- Config loader

Data flow:

Task request -> context builder -> LLM abstraction -> action parser -> guardrail engine -> tool dispatcher -> feedback sensors -> event store -> next loop or stop.

External dependencies:

- OpenAI-compatible chat API for real provider mode
- Operating-system keychain library
- SQLite
- Docker/Nginx for deployment

## 8. Data Model

Main entities:

- Run: id, mode, task, workspace, status, started_at, ended_at, stop_reason
- Event: id, run_id, sequence, kind, payload_json, created_at
- Action: id, run_id, kind, payload_json, guardrail_decision, created_at
- Feedback: id, run_id, source, severity, message, payload_json, created_at
- MemoryItem: id, scope, key, value_json, created_at, updated_at
- CredentialStatus: provider, exists, source, updated_at; never stores secret values in SQLite

## 9. Credential And Distribution Design

Credential flow:

- `credentials status`: show provider and whether a key exists.
- `credentials set`: read secret input without echo and store it in OS keychain.
- `credentials clear`: remove key from OS keychain.
- Development fallback: read `.env` only when explicitly enabled and document plaintext risk.

Distribution:

- Docker image for app runtime.
- Docker Compose for server deployment.
- Nginx reverse proxy on the user's cloud server.
- Public WebUI runs only mock/demo mode by default.

## 10. Technology Choices

- TypeScript: one language for CLI, server, shared core, and tests.
- Node.js: broad ecosystem for CLI, WebUI server, SQLite, keychain integration, and Docker.
- Vitest or equivalent: deterministic unit testing.
- SQLite: simple persistent event store suitable for local and server deployment.
- OpenAI-compatible API: provider-flexible real LLM path.
- Docker: reproducible distribution and server deployment.
- GitHub Actions plus `.gitlab-ci.yml`: user preference plus course checklist compatibility.

## 11. Acceptance Criteria

- The main loop can complete a mock LLM run without network access.
- A dangerous action is blocked by code before execution.
- A mock run injects one failure and the next action changes because feedback was delivered.
- Core mechanisms have deterministic tests using mock/stub LLM.
- CLI can manage credential status/set/clear without printing secrets.
- WebUI displays demo runs and mechanism evidence.
- Docker deployment can run the WebUI on a fresh server.
- CI has passing unit tests; GitLab CI contains a `unit-test` job.
- No real credentials appear in source, logs, docs, or Git history.

## 12. Risks And Open Questions

- Public WebUI without authentication must remain mock-only to avoid exposing shell execution.
- OS keychain support may differ between Windows, Linux, and Docker; fallback behavior needs careful documentation.
- The formal cold-start validation with Cursor is still pending and must be recorded in `SPEC_PROCESS.md`.
- Superpowers installation and exact skill invocation evidence still need to be captured by the student during the official process.

