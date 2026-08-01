# Coding Agent Harness

这是 AI4SE Project A 的 TypeScript coding-agent harness。它提供带治理边界的 CLI 与 WebUI：代理循环使用 mock provider，文件操作受 workspace path boundary 约束，shell 命令受 allowlist 与 guardrail 约束，并可记录运行历史。

## 安装

需要 Node.js 22。安装依赖：

```bash
npm ci
```

## 运行与验证

```bash
npm test
npm run demo:mechanisms
npm run build
npx tsx src/cli/main.ts demo
```

`npm run build` 是 TypeScript 类型检查与构建验证入口。当前 ESM 源码使用 Bundler 解析约定，因此运行 CLI 或 WebUI 时使用项目提供的 `tsx` 入口。

启动 WebUI：

```bash
npm run build
npx tsx src/web/server.ts
```

WebUI 默认监听 `0.0.0.0:3000`；可用 `PORT` 修改端口。它只预注册 `demo-ts` workspace，其根目录由部署时的 `HARNESS_WORKSPACE_ROOT` 或进程当前目录决定。页面和 API 不接受任意服务器路径，real-run 也只能选择该预注册 workspace id。

## Docker 分发

```bash
docker build -t coding-agent-harness .
docker run --rm -p 3000:3000 coding-agent-harness
docker compose up --build
```

Compose 将 `/app/data` 挂载为 `harness-data` named volume，便于未来 SQLite 数据持久化；镜像构建不会复制 `.env`、本地 SQLite 数据、logs 或本地 `node_modules`。容器默认启动 WebUI。

### Docker 与 Nginx 部署

将容器放在 Nginx 反向代理之后，并由 Nginx 转发到 `127.0.0.1:3000`。WebUI v1 **没有 password**，仅适合受信任网络或短期课程演示。长期公网部署必须先在 Nginx 或其他边界层配置 basic auth、SSO、VPN 或等效认证与访问控制；不要把容器端口直接暴露到公网。

## Key 安全配置

当前 v1 默认使用 mock provider，不实现真实 OpenAI provider，也不实现真实 OS keychain。`CredentialManager` 使用测试用内存 adapter；环境变量 fallback 仅在显式开启时使用。真实 API key 绝不能提交、打印、写入 SQLite、写入日志或通过 WebUI 返回。`.env.example` 只给出非敏感示例，真实凭据应保存在受管控的部署环境中。

## 目录结构

- `src/core/`：代理循环、provider 抽象和治理逻辑。
- `src/runtime/`：workspace、文件与 shell 执行边界。
- `src/web/`：WebUI HTTP server 与页面。
- `src/cli/`：命令行入口。
- `tests/`：Vitest 单元测试。
- `.github/workflows/`、`.gitlab-ci.yml`：持续集成。
- `Dockerfile`、`docker-compose.yml`：容器分发。

更多安全边界和发布前检查请见 [SECURITY.md](SECURITY.md)。
