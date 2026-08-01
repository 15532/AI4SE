# Workspace Session V1 设计

## 背景

当前系统已经可以触发真实 harness run，并通过 WebUI 查看 timeline，但体验仍偏“一次性任务”。要更接近 Codex，需要让同一个 workspace 具备持续上下文、可见记忆和代码查看能力。

## 目标

Workspace Session V1 让 WebUI 从单次 run 控制台升级为持续工作区工作台：

- 用户可以在 WebUI 查看预注册 workspace 的文件列表。
- 用户可以只读查看 workspace 内代码文件内容。
- WebUI 展示当前 workspace 的 memory。
- WebUI 展示最近 run 摘要。
- 后续 run 的模型 context 自动包含 workspace memory 与最近 run 摘要。

## 范围

包含：

- 只读文件树 / 文件列表 API。
- 只读文件内容 API。
- workspace boundary 检查，禁止路径逃逸。
- memory panel。
- recent runs panel。
- provider context 继承最近 run 摘要。

不包含：

- 浏览器内代码编辑器。
- diff inspector。
- 文件写入 API。
- 人工审批。
- 多用户权限系统。

## 安全边界

- WebUI 只能访问预注册 workspace id。
- 文件路径必须相对 workspace root 解析。
- `.git`、`node_modules`、`dist`、`coverage` 等目录不进入文件列表。
- 单文件查看限制为 UTF-8 文本文件。
- 超过大小限制的文件返回结构化错误。
- 真实文件修改仍只能通过 agent action 与 guardrail 执行。

## 成功标准

- `GET /api/workspaces/:id/files` 返回受限文件列表。
- `GET /api/workspaces/:id/files/<path>` 返回文件内容。
- 路径逃逸请求返回 400。
- WebUI 首页展示 code viewer、memory panel、recent runs。
- 新 run 的 provider context 包含 workspace memory 和 recent run summary。
- `npm test` 与 `npm run build` 通过。
