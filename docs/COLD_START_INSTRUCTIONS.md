# Cold-Start Validation Instructions

Use this file when opening the formal Cursor validation session.

## Setup

1. Open a fresh Cursor session.
2. Do not import prior Codex conversation history.
3. Provide only `SPEC.md` and `PLAN.md`.
4. Do not add oral explanations.

## Prompt

You are validating this AI4SE Project A specification. Choose tasks T2 and T4 from `PLAN.md` and attempt to implement them using TDD. Do not rely on any prior conversation or hidden context. If any requirement is ambiguous, stop and ask instead of guessing. Report every ambiguity, mismatch, missing interface, or unintended interpretation you encounter.

## Evidence To Record

Record in `SPEC_PROCESS.md`:

- Where Cursor paused to ask questions.
- Which missing assumptions were exposed.
- Which interpretations differed from the intended design.
- Whether the issue was a spec defect or an agent misread.
- What changed in `SPEC.md` or `PLAN.md` afterward.
- Key before/after diff excerpts.

