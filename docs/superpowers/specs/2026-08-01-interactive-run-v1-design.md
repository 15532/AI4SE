# Interactive Run V1 Design

## 目标

Interactive Run V1 让 WebUI 从“一次提交一个 run”升级为“同一个 workspace session 下持续协作”。用户可以打开一个 session，连续提交后续指令；每条指令仍触发真实 harness run，并显示 session 历史、workspace memory、当前 diff 和每次 run 的 timeline。

## 部署约束

- Session 必须持久化到 SQLite，不能依赖进程内 Map。
- API 不能接收任意 filesystem path，只能使用预注册 workspace id。
- 不使用 WebSocket 或长连接，首版用普通 HTTP 表单与 JSON API，便于以后放在 Nginx / Docker / 云服务器后面。
- 所有响应继续经过 secret redaction。
- 当前 v1 仍不配置 WebUI password；公网部署前必须加反向代理认证或应用层认证。

## 范围

- 新增 session 数据模型：`id`、`workspace_id`、`provider`、`title`、`created_at`、`updated_at`。
- 新增 run 与 session 的关联表。
- 新增 API：
  - `POST /api/sessions`
  - `GET /api/sessions/:id`
  - `POST /api/sessions/:id/runs`
- 新增页面：
  - `GET /sessions/:id`
- Session 页面展示：
  - session 基本信息
  - 继续输入任务的表单
  - 同 session 历史 run 摘要
  - workspace memory
  - 当前 workspace diff 摘要

## 非目标

- 不做流式 token。
- 不做后台任务队列。
- 不做暂停、取消、恢复同一个长 run。
- 不做浏览器内编辑器。
- 不做人工审批 accept/reject。

## 数据流

1. 用户通过 WebUI 创建 session，选择 workspace 与 provider。
2. Web server 将 session 写入 SQLite。
3. 用户在 session 页面提交后续指令。
4. Web server 根据 session 绑定的 workspace/provider 调用 `runAgentLoop()`。
5. `EventStore.createRun()` 写入 run，并将 run 关联到 session。
6. Session 页面重新读取 session、runs、memory 和 diff，渲染持续协作视图。

## 错误处理

- 未知 workspace：`400 Unknown workspace id`。
- 未知 provider：`400 Unsupported provider`。
- 未知 session：`404 Unknown session id`。
- Session 指向的 workspace/provider 在配置中不再存在：继续运行时返回结构化错误，不允许 fallback 到任意输入。

## 测试策略

- Store 测试覆盖 session 创建、读取、run 关联、按 session 列出 run。
- Web 测试覆盖 session API、继续运行 API、表单 redirect、session 页面渲染和 secret/root 不泄露。
- 全量验证运行 `npm test` 与 `npm run build`。
