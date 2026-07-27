# Superpowers Workflow Checklist

Use this checklist to avoid breaking the course workflow.

## Before Implementation

- [x] Confirm Superpowers is installed for the chosen main agent.
- [ ] Complete `SPEC.md`.
- [ ] Complete `PLAN.md`.
- [ ] Run Cursor cold-start validation using only `SPEC.md` and `PLAN.md`.
- [ ] Record findings and key diffs in `SPEC_PROCESS.md`.
- [ ] Update `AGENT_LOG.md`.

## During Implementation

- [ ] Use one worktree/branch per major feature.
- [ ] Use one fresh subagent per task.
- [ ] Start each task with a failing test.
- [ ] Run red-green-refactor.
- [ ] Review for spec compliance first.
- [ ] Review for code quality second.
- [ ] Update `PLAN.md` with completion status and commit hash.
- [ ] Update `AGENT_LOG.md` with prompt/context, subagent output summary, and human interventions.

## Before Submission

- [ ] No real credentials in files, logs, or Git history.
- [ ] GitHub Actions final run passes.
- [ ] `.gitlab-ci.yml` has a passing `unit-test` job.
- [ ] Docker distribution instructions are tested.
- [ ] WebUI URL is reachable.
- [ ] `REFLECTION.md` is written by the student.
