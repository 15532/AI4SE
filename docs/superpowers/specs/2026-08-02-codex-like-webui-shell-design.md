# Codex-like WebUI Shell 设计

## 目标

将浏览器内工作区编辑器从“居中文档页面”升级为更接近 Codex 桌面端的现代开发工具壳层。改造聚焦页面结构、信息密度、文件树降噪和编辑器视觉整合，不引入新的前端框架，也不改变 harness 的运行、安全和保存语义。

## 视觉方向

- 使用全屏应用布局，页面高度贴合视口，不再将内容放在居中的普通网页容器中。
- 顶部保留紧凑 app bar，展示产品名、workspace、当前文件、保存状态。
- 左侧为现代文件栏，使用浅灰背景、细分割线、紧凑文件项、当前文件高亮。
- 中间为主编辑器，包含 tab/header、轻量 toolbar、柔和代码背景和底部状态栏。
- 右侧为 Agent 面板，承载上下文、保存护栏、变更摘要和审批入口。
- 采用中性工具型色彩：浅灰、白、深墨色文字、低饱和蓝色强调，不使用大面积装饰渐变。

## 功能边界

本次只调整 server-rendered HTML/CSS 与文件列表呈现：

- 不引入 React、Monaco、客户端路由或复杂构建链。
- 不改变 `saveWorkspaceTextFile`、guardrail、workspace registry 或 API 语义。
- 文件树隐藏 `.git`、`node_modules`、`dist`、`coverage` 等噪声条目。
- 编辑器仍使用 `<textarea>`，确保表单保存、可访问性和测试稳定。

## 验收标准

- 文件编辑页包含 `codex-app-shell`、`codex-app-bar`、`codex-sidebar`、`codex-editor-main`、`codex-agent-panel` 和 `codex-editor-tab`。
- 文件浏览页使用同一套 app shell，不再是普通文档页。
- 文件树不展示 `.git` 和 `node_modules`。
- 既有保存 API、路径护栏、敏感内容护栏全部继续通过测试。

