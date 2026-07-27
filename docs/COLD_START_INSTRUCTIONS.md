# 冷启动验证说明

正式 Cursor 验证 session 使用本文件。

## 设置

1. 打开一个全新的 Cursor session。
2. 不导入此前 Codex 对话历史。
3. 只提供 `SPEC.md` 和 `PLAN.md`。
4. 不补充口头解释。

## 提示词

> 你正在验证这个 AI4SE Project A 规约。请从 `PLAN.md` 中选择 T2 和 T4，并尝试用 TDD 实现它们。不要依赖任何先前对话或隐藏上下文。如果任何要求存在歧义，请停止并提问，不要猜测。请报告你遇到的所有歧义、不一致、缺失接口或非预期解读。

## 需要记录的证据

将以下内容记录到 `SPEC_PROCESS.md`：

- Cursor 在哪里暂停并提问。
- 暴露了哪些缺失假设。
- 哪些解释与你的原意不同。
- 问题是 spec 缺陷还是 agent 误读。
- 之后 `SPEC.md` 或 `PLAN.md` 做了什么修改。
- 关键 before/after diff。
