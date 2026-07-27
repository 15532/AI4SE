# SPEC_PROCESS

Status: preparation started; cold-start validation pending.

## Process Summary

The project is being prepared for AI4SE Final Project A - Coding Agent Harness. The current main agent is Codex App. The planned cold-start validation agent is Cursor, because the course requirement asks for a different agent type from the main development agent.

## Key Brainstorming Iterations

### Iteration 1 - Project Direction

Question: Which Coding Agent Harness capability should be the main contribution?

Decision: choose governance guardrails plus deterministic feedback loop.

Reason: this direction maps directly to Project A's requirement that mechanisms be implemented in code and remain testable with mock/stub LLMs.

### Iteration 2 - Technology And Product Shape

Question: Which stack and interface should the project use?

Decision: TypeScript, CLI plus WebUI, OpenAI-compatible LLM abstraction, SQLite state.

Reason: one language can cover CLI, WebUI server, tests, Docker deployment, and shared types.

### Iteration 3 - Deployment And Safety

Question: How should the public WebUI be deployed on the user's own server?

Decision: Docker plus Nginx, public WebUI in mock/demo mode only. No authentication for the first public demo, therefore no real shell execution or real API keys in public mode.

Reason: this gives an accessible WebUI for grading while avoiding the risk of exposing a real coding agent over the internet.

### Iteration 4 - CI Requirement Conflict

Question: The user prefers GitHub Actions, while the final checklist explicitly asks for `.gitlab-ci.yml` with a `unit-test` job.

Decision: plan for both. GitHub Actions will be the primary CI, and `.gitlab-ci.yml` will be included for checklist compatibility.

Reason: this avoids losing points on a formatting requirement while preserving the preferred workflow.

### Iteration 5 - Action Protocol

Question: What action format should the LLM use so that parser, guardrails, mock LLM, and cold-start implementation are deterministic?

Decision: strict JSON action object, one action per loop iteration.

Reason: JSON gives the clearest boundary between LLM decision-making and harness code. Invalid output can be rejected deterministically and turned into feedback.

### Iteration 6 - Tool Boundary

Question: What shell commands should v1 allow?

Decision: narrow per-workspace command allowlist. Default TypeScript commands are `npm test`, `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

Reason: exact allowlists keep the scope testable and prevent the shell tool from becoming an unbounded remote command interface.

### Iteration 7 - WebUI Execution Boundary

Question: Should WebUI only show mock/demo runs, or also trigger real harness runs?

Decision: WebUI may trigger real runs, but only for pre-registered workspaces selected by id.

Reason: this gives a stronger product demonstration while still making the filesystem and command boundary explicit.

### Iteration 8 - WebUI Authentication

Question: Should v1 require a WebUI administrator password?

Decision: no password in v1 by user decision. The SPEC documents this as a known risk and constrains WebUI real runs through workspace registration, path boundaries, command allowlists, and guardrails.

Reason: the user prefers not to configure a password yet. The design records the trade-off instead of hiding it.

### Iteration 9 - Module And Test Coverage

Question: Does the design explicitly satisfy the requirement for at least three clear functional modules and one-command tests?

Decision: SPEC now names six functional modules and `npm test` as the one-command test entry.

Reason: the requirement was already structurally covered, but making it explicit reduces grading ambiguity.

## Adopted AI Suggestions

- Main contribution should focus on guardrails and feedback, not only prompt design.
- Strict JSON action protocol should be used instead of natural-language parsing.
- Memory should be exposed as a `remember` action to prove the memory mechanism is code-backed.
- Formal cold-start validation should use Cursor rather than a new Codex chat.
- Workspaces should be pre-registered and selected by id.

## Rejected Or Modified Suggestions

- A pure CLI was rejected because the final checklist requires an accessible WebUI.
- A mock/demo-only WebUI was rejected because the user wants WebUI to trigger real harness runs.
- WebUI password protection was recommended but deferred by user decision.
- `.env` as primary credential storage was rejected because the requirement asks for safer storage and explicit threat modeling.

## Cold-Start Validation

Status: pending.

Planned agent: Cursor.

Input to provide: only `SPEC.md` and `PLAN.md`.

Tasks to ask it to attempt: T2 and T4.

Instructions: stop and ask on ambiguity rather than guessing.

Findings:

- Pending.

Required follow-up:

- Record Cursor questions and mismatches.
- Revise `SPEC.md` and `PLAN.md`.
- Include key before/after diffs in this file.
