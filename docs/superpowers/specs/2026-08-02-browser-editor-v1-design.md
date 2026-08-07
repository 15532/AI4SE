# 浏览器内轻量代码编辑器 V1 设计

## 目标

在现有 WebUI 中加入一个接近 IDE 的轻量代码查看与编辑页面，让用户可以在浏览器里查看 workspace 文件、编辑文本文件、保存修改，并通过 Diff Inspector 看到变更。

## 设计风格

采用用户确认的 Open Design 参考风格：安静、高密度、开发工具感。页面结构为三栏工作台：

- 左栏：workspace 信息、文件列表、允许命令。
- 中栏：集成式代码编辑区，使用浅层代码面板、柔和 gutter、状态条和保存按钮。
- 右栏：Agent Session、审批状态、Diff 摘要和最近反馈。

代码区不使用突兀的黑色终端块，而是作为页面材质的一部分嵌入，视觉上和文件树、Diff、审批面板保持同一套边框、背景和状态语言。

## 功能范围

V1 只支持文本文件的轻量编辑：

- `GET /workspaces/:id/files`：渲染 workspace 文件浏览页。
- `GET /workspaces/:id/files/<relativePath>`：渲染单文件编辑页。
- `POST /api/workspaces/:id/files/<relativePath>`：保存文本内容。

不做 Monaco、语法高亮引擎、多标签、二进制文件编辑、实时协作、撤销历史或浏览器内终端。

## 安全边界

保存文件必须复用 harness 的安全模型：

- WebUI 只能使用预注册 workspace id，不能传入 root。
- 文件路径必须在 workspace root 内。
- `.env`、private key、token、credential 等敏感路径不能读取或写入。
- 写入内容包含 secret-like assignment 时必须被 block。
- 保存 action 经过 `classifyAction({ type: "write_file", ... })` 后才能 dispatch。

## 数据流

1. 用户在文件页提交文本内容。
2. Web server 根据 workspace id 找到注册 workspace。
3. 构造 `write_file` action。
4. 调用 guardrail 分类。
5. 若 `allow`，调用 `dispatchTool` 写入文件。
6. 保存成功后跳转回文件编辑页，并可通过 Diff Inspector 查看变更。
7. 若被 block，返回结构化 400 错误或在页面展示错误状态。

## 测试策略

- runtime 测试覆盖安全写文件：正常写入、路径逃逸、敏感路径、敏感内容。
- Web 测试覆盖页面渲染、表单保存、root 不暴露、路径逃逸和敏感内容拒绝。
- 现有全量测试和 build 必须继续通过。
