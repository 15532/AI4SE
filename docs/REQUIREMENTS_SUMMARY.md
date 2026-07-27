# 要求摘要

本文件用于快速本地查阅两个课程文档。最终要求仍以课程原始文档为准。

## 通用要求

- 如实使用 Superpowers 工作流。
- 交付 `SPEC.md`、`PLAN.md`、`SPEC_PROCESS.md`、`AGENT_LOG.md`、`README.md`、`REFLECTION.md`。
- SPEC/PLAN 与冷启动验证完成前不得写实现代码。
- 使用 TDD：red、green、refactor。
- 使用 worktree 和 PR 风格历史处理独立模块。
- 保护所有 API key 和 credentials。
- 提供分发说明。
- 提供通过的 CI。
- 提供可访问 WebUI URL。

## Project A 专属要求

- 自己实现 Coding Agent Harness kernel。
- 不得依赖 LangChain `AgentExecutor`、AutoGen、CrewAI、LlamaIndex agent runner 或宿主 coding-agent SDK 这样的高层 agent loop。
- 实现可注入的 LLM abstraction 和 mock/stub LLM。
- 用确定性代码实现：
  - tool dispatch
  - governance guardrail
  - feedback loop
  - memory
  - stop conditions
- 核心机制必须能在无真实 LLM、无网络情况下测试。
- 提交机制演示，展示：
  - 危险动作被 guardrail block
  - 注入失败后 feedback 使 agent 改变下一步 action
  - 与主要贡献维度对齐的一个确定性行为

