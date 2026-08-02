# Chat-first WebUI 设计

## 目标

将 WebUI 首页从“任务表单 + 文件工具台”改成“AI 对话驱动的 coding agent 工作台”。页面主体应像 Codex 桌面端一样围绕对话流展开：用户在底部输入框描述开发任务，系统触发真实 harness run，运行结果和工具链路作为对话内容或侧边 Inspector 呈现。

## 页面结构

- 左侧项目栏：展示产品名、工作区列表、最近 run、文件入口。
- 中间对话区：作为页面主体，展示欢迎消息、最近运行摘要、空状态提示和任务对话流。
- 底部输入框：固定在中间区域底部，包含任务输入、workspace/provider 选择和发送按钮。
- 右侧 Inspector：显示 harness 机制摘要、memory、recent runs、diff/approval 入口。
- 文件编辑器：保留为辅助页面，由对话区或侧栏入口打开，不再作为默认主页面。

## 行为边界

- 首页表单仍提交到 `/api/runs`，继续触发真实 harness run。
- 表单字段继续使用 `workspaceId`、`provider`、`task`，兼容现有 server 行为和测试。
- 不引入客户端框架、不做实时流式渲染；v1 使用 server-rendered HTML 和普通表单跳转。
- 后续可把 run 结果从 `/runs/:id` 逐步内嵌回 chat thread。

## 验收标准

- `/` 页面包含 `chat-app-shell`、`chat-sidebar`、`chat-thread`、`chat-message`、`chat-composer`、`chat-inspector`。
- 首页保留 `task-composer`、`name="workspaceId"`、`name="provider"`、`name="task"` 和 `/api/runs` 表单提交。
- 页面不暴露 workspace root 或 secret-like value。
- 既有 run API、session API、文件编辑器和审批流程继续通过测试。

