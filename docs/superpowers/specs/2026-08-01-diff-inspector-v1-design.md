# Diff Inspector V1 Design

## 目标

Diff Inspector V1 让 WebUI 能看见当前 workspace 中的代码变更。它回答两个问题：哪些文件被修改了，以及单个文件的 unified diff 是什么。

## 范围

- 支持 git workspace。
- 展示修改、新增、删除、重命名、未跟踪等文件状态。
- 提供只读 API：
  - `GET /api/workspaces/:id/changes`
  - `GET /api/workspaces/:id/changes/<relativePath>`
- 在运行详情页加入变更入口，便于用户从一次 run 回到 workspace diff。
- 拒绝未知 workspace、路径逃逸、非 git workspace 和超大 diff。

## 非目标

- 不做在线编辑器。
- 不做逐行评论、回滚、accept/reject。
- 不把 diff 注入 LLM prompt；后续由交互式 run 或 approval 阶段决定。
- 不暴露 workspace root、绝对路径、API key 或 secret-like 内容。

## 架构

新增 `src/runtime/diff-inspector.ts`，作为唯一直接调用 git 的模块。Web server 调用该模块并返回结构化 JSON。HTML 视图只展示入口和运行详情页中的变更摘要，不负责执行 git 命令。

## 数据结构

```ts
export type WorkspaceChange = {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed" | "untracked" | "typechange" | "unknown";
};
```

`listWorkspaceChanges()` 返回变更列表。`readWorkspaceDiff()` 返回单个文件的 diff 文本。所有 path 都是 workspace 相对路径，使用 `/` 分隔。

## 错误处理

- workspace 不是 git 仓库：返回 `Workspace is not a git repository`。
- 文件路径逃逸：返回 `Path escapes workspace root`。
- 文件没有变更：返回 `File has no diff`。
- diff 超过上限：返回 `Diff is too large to preview`。

## 测试策略

- runtime 测试创建临时 git 仓库，验证 status 解析、diff 读取、未跟踪文件、路径逃逸和非 git 仓库错误。
- Web 测试验证变更列表 API、单文件 diff API、路径逃逸拒绝和运行详情页包含 diff 入口。
- 最终运行 `npm test` 和 `npm run build`。
