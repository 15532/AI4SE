# Approval V1 设计

## 目标

为 Coding Agent Harness 增加一个简单、明确的人类审批门，让模型请求执行发布或部署类命令时不会被静默执行，也不会被普通反馈循环绕过。

## 范围

Approval V1 只覆盖已经出现在工作区 `allowedCommands` 中的发布或部署类命令，例如 `git push`、`npm publish`、`docker push`、`kubectl apply`。这类命令进入 `pending_approval` 状态，由 WebUI 展示待审批动作，用户可以批准或拒绝。

不在 `allowedCommands` 中的命令继续按 `command.not_allowlisted` 拦截。破坏性删除、读取密钥、写入敏感文件、路径越界仍然永久拦截，不进入审批。

## 数据流

1. LLM 返回 `run_command` action。
2. guardrail 判断命令是否需要审批。
3. 核心循环记录 `approval_required` 事件，创建待审批记录，并停止本次 run，状态为 `pending_approval`。
4. WebUI 在 run 页面展示审批卡片。
5. 用户选择批准或拒绝。
6. 批准后 harness 重新校验该 action，只允许同一类 `require_approval` 决策继续执行工具，并把审批决定和工具结果追加到原 run 时间线。
7. 拒绝后只记录拒绝决定，不执行工具。

## 组件

- `guardrails`：把 allowlist 内的发布/部署命令分类为 `require_approval`。
- `event-store`：持久化审批记录，支持创建、查询、列出、批准、拒绝。
- `loop`：遇到 `require_approval` 后生成审批记录并返回 `pending_approval`。
- `web server`：提供批准和拒绝 API。
- `views`：在 run 页面展示待审批动作。

## 错误与安全

审批不绕过 allowlist。审批执行前会重新读取 workspace 和 action，并再次运行 guardrail。只有仍然得到 `require_approval` 的 action 才能执行；如果变成 `block`，会记录失败并返回错误。

所有持久化事件和审批 action 继续走脱敏逻辑，不暴露密钥、工作区 root 或攻击者提交的 root 字段。

## 测试

测试覆盖四条主线：

- allowlist 内发布命令进入审批，非 allowlist 命令仍被拦截。
- 核心循环遇到审批动作后返回 `pending_approval` 并写入审批记录。
- EventStore 可以创建、查询、批准和拒绝审批记录。
- WebUI 能展示待审批卡片，并通过 API 批准或拒绝。
