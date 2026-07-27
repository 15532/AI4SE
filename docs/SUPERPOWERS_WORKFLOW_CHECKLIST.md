# Superpowers 工作流检查清单

用这个清单避免偏离课程流程。

## 实现前

- [x] 确认主 agent 已安装 Superpowers。
- [ ] 完成 `SPEC.md`。
- [ ] 完成 `PLAN.md`。
- [ ] 使用 Cursor 且仅提供 `SPEC.md` 和 `PLAN.md` 做冷启动验证。
- [ ] 将发现和关键 diff 记录到 `SPEC_PROCESS.md`。
- [ ] 更新 `AGENT_LOG.md`。

## 实现中

- [ ] 每个大功能使用一个 worktree/branch。
- [ ] 每个 task 使用一个新鲜 subagent。
- [ ] 每个 task 从失败测试开始。
- [ ] 执行 red-green-refactor。
- [ ] 先做 spec compliance review。
- [ ] 再做 code quality review。
- [ ] 在 `PLAN.md` 中更新完成状态和 commit hash。
- [ ] 在 `AGENT_LOG.md` 中记录 prompt/context、subagent 输出摘要和人工干预。

## 提交前

- [ ] 文件、日志或 Git history 中没有真实凭据。
- [ ] GitHub Actions 最后一次运行通过。
- [ ] `.gitlab-ci.yml` 有通过的 `unit-test` job。
- [ ] Docker 分发说明已测试。
- [ ] WebUI URL 可访问。
- [ ] `REFLECTION.md` 由学生本人撰写。

