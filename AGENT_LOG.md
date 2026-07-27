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
