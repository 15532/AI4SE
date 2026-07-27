# Coding Agent Harness

AI4SE Final Project A preparation repository.

## Project Status

This repository is currently in the pre-implementation stage. The course requirement forbids writing harness implementation code before `SPEC.md` and `PLAN.md` are complete and cold-start validated by a different agent.

## Project Summary

Coding Agent Harness is planned as a TypeScript CLI plus WebUI project. It will implement a project-owned coding agent harness with:

- deterministic governance guardrails
- feedback loops driven by test/lint/build signals
- injectable mock and real OpenAI-compatible LLM providers
- bounded file and shell tools
- SQLite run history and memory
- OS keychain credential management
- Docker deployment with a mock/demo-only public WebUI

## Required Preparation Documents

- `SPEC.md`: project specification
- `PLAN.md`: implementation plan
- `SPEC_PROCESS.md`: brainstorming and cold-start validation evidence
- `AGENT_LOG.md`: chronological agent workflow log
- `REFLECTION.md`: student-authored reflection draft scaffold

## Installation

Implementation has not started yet. Installation instructions will be completed after the TypeScript scaffold is created.

## Running

No runtime command exists yet. The first implementation task will create the project scaffold and test command.

## Distribution

Planned distribution is Docker. Final README will include:

- `docker build` command
- `docker run` or Docker Compose command
- cloud server deployment behind Nginx
- known platform and architecture limits

## Key Configuration

Planned credential storage:

- Primary: operating-system keychain
- Development fallback: `.env`, only when explicitly enabled

Security rule: real API keys must never be committed, printed, or stored in run logs.

## Security Boundary

The public WebUI will run in mock/demo mode only until authentication and stronger sandboxing are implemented. Public mode must not execute real shell commands, read real user repositories, or use real LLM API keys.

## Directory Structure

- `.github/workflows/`: GitHub Actions CI
- `docs/`: additional process notes
- `scripts/`: future helper scripts
- `SPEC.md`: specification
- `PLAN.md`: implementation plan
- `SPEC_PROCESS.md`: process evidence
- `AGENT_LOG.md`: agent workflow log

