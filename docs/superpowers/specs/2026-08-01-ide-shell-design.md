# 方案 B：轻量智能 IDE 壳层设计

## 目标

方案 B 第一版把当前“简单模型前端”升级为轻量智能 IDE 壳层，让评审者第一眼能看出这是一个面向代码开发的 agent harness 工具，而不是普通表单 demo。

## 范围

- 保留当前 server-rendered WebUI，不引入前端框架。
- 保留真实 harness run 链路：workspace registry、provider factory、guardrail、tool dispatcher、feedback、SQLite timeline 全部不变。
- 首页改为三栏工作台：
  - 左侧：工作区与允许命令。
  - 中间：任务编排与 provider 选择。
  - 右侧：机制状态与运行入口语义。
- 运行详情页改为 IDE 风格 run inspector：
  - 顶部显示 run 元信息。
  - 左侧展示事件导航。
  - 右侧展示 timeline 详情。
- 暂不实现浏览器内代码编辑器、文件在线编辑、真实 diff 计算、多人协作或插件系统。

## Open Design 说明

课程推荐 Open Design 用于前端 / UI。当前项目不直接接入 Open Design runtime，而是在 SPEC 中说明其作为方案 B 后续 UI 增强参考：本轮采用 server-rendered、可测试、低依赖的 Open Design 风格信息架构，后续若做完整视觉系统再引入 Open Design 生成/审查设计系统。

## 成功标准

- 首页包含明确的智能 IDE 壳层结构：workspace rail、task composer、run inspector。
- 运行详情页包含 timeline navigator 和 event detail 区域。
- 现有 `/api/runs`、`/api/workspaces`、`/runs/:id` 行为不回退。
- `npm test` 与 `npm run build` 通过。
