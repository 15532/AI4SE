# Coding Agent Harness

AI4SE 期末项目 A 准备仓库。

## 项目状态

本仓库当前处于实现前阶段。课程要求在 `SPEC.md` 和 `PLAN.md` 完成并通过不同 agent 的冷启动验证前，不得编写 harness 实现代码。

## 项目简介

Coding Agent Harness 计划实现为 TypeScript CLI + WebUI 项目。它将交付一个自己实现内核的 coding agent harness，包含：

- 确定性治理护栏
- 基于 test/lint/build 信号的反馈闭环
- 可注入的 mock 和 OpenAI-compatible LLM provider
- 有边界的文件工具与受限 shell 工具
- SQLite run history 和 memory
- OS keychain 凭据管理
- Docker 部署与 WebUI

## 必需准备文档

- `SPEC.md`：项目规约
- `PLAN.md`：实现计划
- `SPEC_PROCESS.md`：brainstorming 与冷启动验证证据
- `AGENT_LOG.md`：按时间顺序记录 agent 工作流
- `REFLECTION.md`：学生本人撰写的反思报告提纲

## 安装

实现尚未开始。TypeScript 脚手架创建后会补充安装命令。

## 运行

当前还没有 runtime command。第一个实现任务将创建项目脚手架和测试命令。

## 分发

计划使用 Docker 分发。最终 README 将包含：

- `docker build` 命令
- `docker run` 或 Docker Compose 命令
- 云服务器 + Nginx 部署说明
- 已知平台和架构限制

## Key 配置

计划凭据存储：

- 主存储：操作系统钥匙串
- 开发 fallback：`.env`，仅在显式启用时使用

安全规则：真实 API key 不得提交、打印或存储在 run logs 中。

## 安全边界

WebUI v1 可以触发真实 harness run，但只能选择预注册 workspace id，并使用与 CLI 相同的 path boundary、command allowlist 和 guardrail。根据用户决定，v1 暂不配置 WebUI password；公网部署应视为受信任网络或短期课程演示环境。

## 目录结构

- `.github/workflows/`：GitHub Actions CI
- `docs/`：过程说明和 Superpowers 设计文档
- `scripts/`：后续辅助脚本
- `SPEC.md`：规约
- `PLAN.md`：实现计划
- `SPEC_PROCESS.md`：过程证据
- `AGENT_LOG.md`：agent 工作日志

