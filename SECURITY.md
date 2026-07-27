# Security Policy

## Credential Rules

- Never commit real API keys or provider tokens.
- Never print key values in logs, terminal output, WebUI responses, CI logs, or SQLite records.
- Store production credentials in the operating-system keychain.
- Use `.env` only as an explicit local-development fallback and document that it is plaintext.

## Public WebUI Boundary

The first public WebUI deployment is mock/demo-only:

- no real LLM API key use
- no real shell execution
- no real repository modification
- no credential management endpoint exposed for public demo

If real execution is later enabled, authentication, workspace sandboxing, command allowlists, and audit logs must be implemented first.

## Pre-Commit Checklist

- `git status --short` has no `.env` or secret files.
- Search for accidental key material before publishing.
- CI logs do not include provider tokens.
- Demo data contains only mock values.

