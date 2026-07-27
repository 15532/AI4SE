# PLAN: Coding Agent Harness

Status: Draft implementation plan. Do not implement harness code until this plan has passed cold-start validation with Cursor.

## Workflow Gate

- Current phase: preparation and specification.
- Implementation gate: `SPEC.md` and `PLAN.md` must be reviewed, then cold-start tested by Cursor using only those two files.
- Required process evidence: update `SPEC_PROCESS.md` and `AGENT_LOG.md` before implementation begins.

## Task Dependency Overview

Sequential foundation:

1. Repository and document baseline
2. TypeScript project scaffold
3. Core domain types and test harness
4. Mock LLM driven main loop

Parallelizable after core types:

- Guardrail engine
- Tool dispatcher
- Feedback sensors
- SQLite event store
- Credential manager
- WebUI demo views
- Docker and CI

## Planned Tasks

### T0 - Preparation Baseline

Goal: create repository, documentation skeleton, ignore rules, and CI placeholders.

Files: `SPEC.md`, `PLAN.md`, `SPEC_PROCESS.md`, `AGENT_LOG.md`, `README.md`, `.gitignore`, `.github/workflows/unit-test.yml`, `.gitlab-ci.yml`.

Verification: `git status --short` shows only intended baseline files. No harness implementation exists yet.

Status: in progress.

### T1 - TypeScript Project Scaffold

Goal: create package, TypeScript, test, and lint/build command baseline.

Expected files: `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/`, `tests/`.

Failing test first: a smoke test that imports the future core module should fail before implementation.

Verification: `npm test`, `npm run build`, and CI run the same test command.

Dependencies: T0.

### T2 - Core Domain Types And Action Parser

Goal: define action, feedback, guardrail decision, run event, and LLM response interfaces.

Failing tests first:

- invalid action JSON becomes an invalid-output feedback event
- valid tool action parses into a typed action

Verification: deterministic unit tests with no network.

Dependencies: T1.

### T3 - Mock LLM And Main Loop Skeleton

Goal: implement the project-owned agent loop: context -> LLM -> parse action -> guardrail -> dispatch -> feedback -> stop.

Failing tests first:

- mock LLM returns a finish action and loop stops
- max iteration limit stops runaway loop

Verification: unit tests assert event sequence and stop reason.

Dependencies: T2.

### T4 - Guardrail Engine

Goal: implement deterministic governance classification for dangerous shell/file actions.

Failing tests first:

- recursive delete command is blocked
- command outside allowlist is blocked or requires approval
- safe allowlisted test command is allowed

Verification: mock LLM is not required; direct guardrail tests pass deterministically.

Dependencies: T2; can run parallel with T5/T6 after interfaces settle.

### T5 - Bounded Tool Dispatcher

Goal: implement workspace-bounded file tools and restricted shell execution.

Failing tests first:

- path traversal outside workspace is rejected
- allowlisted command can execute in a temp workspace
- blocked command is never executed

Verification: tests use temp directories and no network.

Dependencies: T2, T4.

### T6 - Feedback Sensors

Goal: convert command result, test output, lint/typecheck output, invalid LLM output, and guardrail block events into structured feedback.

Failing tests first:

- failed test output creates actionable feedback
- guardrail block creates safety feedback
- feedback is included in the next loop context

Verification: mock LLM changes its second action after feedback is delivered.

Dependencies: T2, T3.

### T7 - SQLite Event Store And Memory

Goal: persist run events, feedback, decisions, and bounded memory items.

Failing tests first:

- run events are stored in order
- memory retrieval is scoped and bounded
- secret values are never stored as memory or event payloads

Verification: SQLite-backed unit tests use temp database files.

Dependencies: T2.

### T8 - Credential Manager

Goal: implement credential status/set/clear abstraction with OS keychain first and `.env` fallback only in development mode.

Failing tests first:

- status hides secret value
- clear removes provider key
- `.env` fallback is disabled unless explicitly enabled

Verification: unit tests use an in-memory fake keychain adapter.

Dependencies: T1.

### T9 - CLI

Goal: expose mock run, mechanism demo, real-provider run, credential management, and config validation commands.

Failing tests first:

- `demo` command returns guardrail and feedback evidence
- credential status command never prints secret value

Verification: CLI integration tests use mock LLM and fake keychain.

Dependencies: T3, T4, T5, T6, T8.

### T10 - WebUI Demo Mode

Goal: provide a WebUI that shows mock/demo run history, blocked actions, feedback transitions, and run timeline.

Failing tests first:

- server exposes demo run data
- public mode refuses real execution

Verification: component/API tests confirm mock-only behavior.

Dependencies: T7, T9.

### T11 - Docker And Server Deployment

Goal: package the app for Docker and document deployment behind Nginx on the user's own server.

Failing tests first:

- container build command succeeds in CI
- documented environment variables are sufficient for mock WebUI

Verification: `docker build` and `docker run` instructions work on a fresh machine.

Dependencies: T9, T10.

### T12 - CI, Review, And Final Docs

Goal: finish README, CI, `.gitlab-ci.yml`, AGENT_LOG updates, SPEC_PROCESS cold-start evidence, and REFLECTION draft prompts.

Verification:

- GitHub Actions passes
- `.gitlab-ci.yml` contains a `unit-test` job
- README includes install, run, distribution, directory structure, key configuration, and security boundaries
- `SPEC_PROCESS.md` includes Cursor cold-start findings and SPEC/PLAN revisions

Dependencies: all implementation tasks.

## Worktree Strategy

- `feature/core-loop`: T1-T3
- `feature/guardrails-tools`: T4-T5
- `feature/feedback-memory`: T6-T7
- `feature/credentials-cli`: T8-T9
- `feature/webui-deploy`: T10-T11
- `docs/finalization`: T12

Each feature branch should have a PR and commit messages naming the subagent or human reviewer.

## Cold-Start Validation Prompt

Use Cursor in a fresh session. Provide only `SPEC.md` and `PLAN.md`, then ask:

> You are validating this project specification. Choose T2 and T4 from PLAN.md and attempt to implement them using TDD. Do not rely on any prior conversation. If any requirement is ambiguous, stop and ask instead of guessing. Report every ambiguity, mismatch, or missing interface you encounter.

Record the result in `SPEC_PROCESS.md` before implementation.

