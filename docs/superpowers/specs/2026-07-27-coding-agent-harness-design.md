# Coding Agent Harness Design

Date: 2026-07-27

Status: Approved during Superpowers brainstorming; written before implementation.

## Summary

This project builds a TypeScript Coding Agent Harness for AI4SE Final Project A. The chosen architecture is a Typed JSON Action Harness: the LLM outputs exactly one strict JSON action per loop iteration, while project-owned code handles parsing, guardrails, tool dispatch, feedback, memory, configuration, credentials, CLI, and WebUI.

The main contribution is governance plus deterministic feedback. The harness must still demonstrate meaningful behavior when the real LLM is removed and replaced by a mock/stub LLM.

## Design Decisions

- Use TypeScript for shared core, CLI, WebUI server, and tests.
- Use OpenAI-compatible chat API only as a single-call provider behind an injectable `LLMProvider`.
- Use `MockLLMProvider` for all deterministic unit tests and mechanism demos.
- Use strict JSON action output instead of XML or natural-language parsing.
- Use pre-registered workspace ids, not arbitrary path input.
- Use exact command allowlists per workspace.
- Let WebUI trigger real harness runs, but only within registered workspaces and the same guardrails as CLI.
- Do not require a WebUI password in v1 by user decision; document this as a risk and trusted-demo boundary.

## Core Modules

The implementation is divided into six modules:

1. Agent Loop Core: context, provider call, action parsing, guardrail, dispatch, feedback, persistence, stop.
2. Tool And Workspace Runtime: workspace registry, path checks, file tools, allowlisted shell.
3. Governance Guardrail Engine: deterministic allow/block/require_approval classification.
4. Feedback And Self-Correction Engine: objective result parsing and feedback injection.
5. Memory And Event Store: SQLite run timeline, action, feedback, memory.
6. Credential, CLI, And WebUI Interface: key lifecycle, local commands, WebUI run control and timeline.

## Action Protocol

Supported v1 actions:

- `read_file`
- `write_file`
- `list_files`
- `run_command`
- `remember`
- `finish`

Each loop iteration accepts exactly one JSON object. Invalid JSON or invalid shape becomes feedback and never reaches tool execution.

Human approval is not an LLM action. It is a harness state produced by guardrails.

## Workspace And Tool Boundary

Workspaces are configured before runtime:

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
```

CLI and WebUI select a workspace by id. Paths are resolved relative to the selected workspace root. Escapes are blocked. Shell commands must exactly match that workspace's allowlist. v1 does not allow arbitrary command arguments.

## Governance And Feedback

Initial guardrails block workspace escapes, non-allowlisted commands, destructive deletion, secret access, publish/deploy commands, and writes to sensitive files.

Feedback sensors produce structured feedback for invalid actions, guardrail blocks, command failures, test failures, static-check failures, missing credentials, and successful tool results. The next loop context includes recent feedback, allowing mock LLM tests to prove self-correction without a real LLM.

## WebUI And Security

WebUI can trigger mock or real provider runs. It can select only pre-registered workspaces, cannot display API keys, and must use the same runtime boundaries as CLI. Since v1 has no password by user decision, public deployment is documented as a trusted-network or short-term course-demo deployment. Future work should add `WEBUI_ADMIN_PASSWORD` or reverse-proxy authentication.

Credentials use OS keychain as primary storage. `.env` is only an explicitly enabled development fallback and is treated as plaintext risk. Secret values must not appear in Git, logs, SQLite, WebUI responses, or CI output.

## Tests And Demo

The one-command test entry is:

```bash
npm test
```

Required deterministic tests cover main loop stop, invalid JSON feedback, guardrail blocking, feedback-driven action change, workspace path escapes, command allowlist rejection, memory write/retrieval, credential masking, and WebUI registered-workspace enforcement.

The mechanism demo command is:

```bash
npm run demo:mechanisms
```

It must deterministically show a dangerous action blocked, a failed test result fed back into the loop, and a changed next action caused by that feedback.

