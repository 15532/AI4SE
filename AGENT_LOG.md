# AGENT_LOG

This log records process evidence for the AI4SE Final Project A workflow.

## Entries

### 2026-07-27 - T0 - Preparation Baseline

- Main agent: Codex App
- Triggered workflow stage: pre-implementation preparation; planning choices before formal implementation
- Key context: user selected Project A - Coding Agent Harness, TypeScript, CLI plus WebUI, OpenAI-compatible LLM abstraction, system keychain credential storage, Docker plus Nginx deployment, mock/demo-only public WebUI, Cursor for cold-start validation
- Human decisions:
  - Main contribution: governance guardrails plus feedback loop
  - Public WebUI: mock/demo mode
  - CI preference: GitHub Actions, with `.gitlab-ci.yml` added for course checklist compatibility
  - Initial cloud access control: no app authentication for first mock-only public demo
- Agent action:
  - Initialized repository
  - Created preparation documents
  - Avoided harness implementation code before cold-start validation
- Lesson:
  - The project should keep a sharp boundary between the host coding agent used for development and the delivered harness kernel implemented by project code.

### 2026-07-27 - T0 - Superpowers Installation Verified

- Main agent: Codex App
- Triggered Superpowers skill: `using-superpowers`
- Verification evidence:
  - Local plugin cache contains `C:\Users\sm\.codex\plugins\cache\openai-curated-remote\superpowers\6.2.0\skills\using-superpowers\SKILL.md`
  - Current session exposes Superpowers skills including `brainstorming`, `writing-plans`, `using-git-worktrees`, `subagent-driven-development`, `test-driven-development`, `requesting-code-review`, and `verification-before-completion`
- Human action:
  - User manually downloaded/installed the Superpowers plugin after the attempted assisted install was interrupted
- Agent action:
  - Read `using-superpowers` and Codex-specific reference instructions
  - Confirmed the plugin is available to this Codex session
- Lesson:
  - Formal SPEC/PLAN work can now proceed under the required Superpowers workflow.

### 2026-07-27 - T0 - Superpowers Brainstorming SPEC Revision

- Main agent: Codex App
- Triggered Superpowers skill: `brainstorming`
- Key prompt/context:
  - User explicitly invoked Superpowers and requested formal review/revision of `SPEC.md`
  - Context included Project A requirements, existing `SPEC.md`, `PLAN.md`, `SPEC_PROCESS.md`, and prior choices
- Key decisions confirmed by human:
  - Use Typed JSON Action Harness architecture
  - LLM action protocol is strict JSON, one action per loop iteration
  - v1 shell execution uses a narrow per-workspace allowlist
  - WebUI may trigger real harness runs
  - WebUI has no password in v1 by user decision
  - WebUI can choose only pre-registered workspace ids, not arbitrary server paths
  - Add `remember` action to make memory a code-backed mechanism
- Agent action:
  - Wrote Superpowers design document under `docs/superpowers/specs/`
  - Revised `SPEC.md` to make action protocol, modules, guardrails, feedback, WebUI boundaries, tests, and risks explicit
  - Updated `SPEC_PROCESS.md` with additional brainstorming iterations
- Human intervention:
  - Rejected mock/demo-only WebUI in favor of real WebUI-triggered runs
  - Deferred WebUI password/authentication for v1
- Lesson:
  - A real-run WebUI strengthens the product demo, but the SPEC must state the unauthenticated deployment risk plainly.
