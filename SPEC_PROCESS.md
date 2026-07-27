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

## Adopted AI Suggestions

- Main contribution should focus on guardrails and feedback, not only prompt design.
- Public WebUI should be mock/demo-only until authentication and sandboxing are added.
- Formal cold-start validation should use Cursor rather than a new Codex chat.

## Rejected Or Modified Suggestions

- A pure CLI was rejected because the final checklist requires an accessible WebUI.
- A fully public real-execution WebUI was rejected because it would expose dangerous shell behavior.
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

