# Coding Agent Harness

这是 AI4SE Project A 的 TypeScript coding-agent harness。项目提供一个带安全边界的代理运行环境：CLI 和 WebUI 都可以触发真实 harness run，代理循环默认使用 mock provider，文件操作受 workspace path boundary 约束，shell 命令受 allowlist 与 guardrail 约束，运行过程会写入 SQLite timeline 和 memory。

## 功能概览

- Action 协议与解析器：支持 `read_file`、`write_file`、`run_shell`、`finish` 等结构化动作。
- Workspace 注册与边界控制：只能访问配置中注册的 workspace，阻止路径逃逸和符号链接逃逸。
- 受限工具分发器：文件工具和 shell 工具统一经过 allowlist、路径归一化和敏感信息脱敏。
- Agent 主循环：provider 输出 Action，harness 执行动作并回灌观察结果，直到 `finish` 或达到最大迭代次数。
- 事件与记忆存储：run、event、timeline、memory 持久化到 SQLite。
- CLI 与 WebUI：命令行和浏览器都能创建 run，并查看运行结果。
- Docker 分发：支持镜像构建和 compose 启动。

## 当前前端定位

当前 WebUI 是功能性“简单模型前端”，用于演示和调试 harness 机制：选择预注册 workspace、输入任务、触发 mock harness run、查看 action / guardrail / tool result / feedback / stop reason timeline。

它不是完整 VS Code 替代品，也不包含成熟代码编辑器、调试器或插件系统。课程文档推荐的 Open Design 会在核心 harness 功能完善后用于后续 UI 增强阶段；当前阶段先保持页面简单、可运行、可测试。

## 环境准备

需要 Node.js 22 和 npm。建议先确认版本：

```powershell
node -v
npm -v
```

安装依赖：

```powershell
npm ci
```

如果是第一次运行，可以复制一份本地环境变量文件：

```powershell
Copy-Item .env.example .env
```

当前版本默认使用 mock provider，不需要真实 API key。不要把真实 secret 写入 `.env`、SQLite、日志或任何已提交文件。

## 最快启动

在 Windows PowerShell 中执行：

```powershell
.\scripts\start-local.ps1
```

脚本会自动完成以下步骤：

- 如果缺少 `node_modules`，执行 `npm ci`。
- 创建本地 `data/` 目录。
- 执行 `npm run build`。
- 设置默认 `HARNESS_CONFIG_PATH`、`HARNESS_DB_PATH` 和 `PORT`。
- 启动 WebUI。

启动后访问：

```text
http://127.0.0.1:3000
```

修改端口：

```powershell
.\scripts\start-local.ps1 -Port 3100
```

开发时如果刚刚构建过，可以跳过构建：

```powershell
.\scripts\start-local.ps1 -SkipBuild
```

## 常用配置

默认配置文件是 `config/harness.example.yaml`：

```yaml
mode: default
maxIterations: 10
providers:
  - id: mock
    type: mock
workspaces:
  - id: demo-ts
    name: TypeScript Demo
    root: ..
    allowedCommands:
      - npm test
      - npm run test
      - npm run lint
      - npm run typecheck
      - npm run build
```

常用环境变量：

- `HARNESS_CONFIG_PATH`：指定 YAML 配置路径，默认 `config/harness.example.yaml`。
- `HARNESS_DB_PATH`：指定 SQLite 数据库路径，默认 `data/harness.sqlite`。
- `PORT`：指定 WebUI 端口，默认 `3000`。

PowerShell 示例：

```powershell
$env:HARNESS_CONFIG_PATH = "config/harness.example.yaml"
$env:HARNESS_DB_PATH = "data/harness.sqlite"
$env:PORT = "3000"
```

如果要支持多个 workspace，直接在 YAML 的 `workspaces` 下增加条目。每个 workspace 必须有独立 `id`、`root` 和 `allowedCommands`；WebUI 请求只能选择已注册的 workspace id，不能从浏览器传入任意 root。

## 本地验证

一键运行测试：

```powershell
npm test
```

类型检查与构建：

```powershell
npm run typecheck
npm run build
```

机制演示：

```powershell
npm run demo:mechanisms
```

推荐在提交前至少运行：

```powershell
npm test
npm run build
```

## 启动 CLI

先构建：

```powershell
npm run build
```

运行内置机制 demo：

```powershell
node dist/src/cli/main.js demo
```

触发一次真实 harness run：

```powershell
node dist/src/cli/main.js run --workspace demo-ts --provider mock --task "请完成一次 mock 运行"
```

运行结果会写入 `HARNESS_DB_PATH` 指向的 SQLite 文件；未设置时写入 `data/harness.sqlite`。

## 启动 WebUI

先构建：

```powershell
npm run build
```

启动服务：

```powershell
node dist/src/web/server.js
```

打开浏览器访问：

```text
http://127.0.0.1:3000
```

如果要换端口：

```powershell
$env:PORT = "3100"
node dist/src/web/server.js
```

WebUI 首页会列出已注册 workspace 和每个 workspace 的可用命令。提交任务后会创建 mock harness run，并跳转到 `/runs/:id` 查看按机制分区的 timeline。

## API 调试

创建 run：

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:3000/api/runs" `
  -ContentType "application/json" `
  -Body '{"workspaceId":"demo-ts","provider":"mock","task":"请完成一次 mock 运行"}'
```

查询 run：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/runs/<run-id>"
```

查看 workspace：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/workspaces"
```

## 本地调试

调试 CLI 编译产物：

```powershell
npm run build
node --inspect-brk dist/src/cli/main.js run --workspace demo-ts --provider mock --task "调试 CLI run"
```

调试 WebUI 编译产物：

```powershell
npm run build
node --inspect dist/src/web/server.js
```

然后在 Chrome 或 Edge 打开：

```text
chrome://inspect
```

如果想直接运行 TypeScript 源码做开发调试，可以使用本地 `tsx`：

```powershell
npm exec tsx src/web/server.ts
npm exec tsx src/cli/main.ts demo
```

单独运行某个测试文件：

```powershell
npm test -- tests/web/server.test.ts
```

清理本地运行数据库：

```powershell
Remove-Item -LiteralPath data/harness.sqlite -Force
```

如果文件不存在，这条命令会报错；需要静默清理时可加 `-ErrorAction SilentlyContinue`。

## Docker 分发

构建镜像：

```powershell
docker build -t coding-agent-harness .
```

运行容器：

```powershell
docker run --rm -p 3000:3000 coding-agent-harness
```

使用 compose：

```powershell
docker compose up --build
```

Compose 设置 `HARNESS_DB_PATH=/app/data/harness.sqlite`，并将 `/app/data` 挂载为 `harness-data` named volume，用于持久化运行历史、timeline 和 memory。镜像构建不会复制 `.env`、本地 SQLite 数据、logs 或本地 `node_modules`。容器默认启动 WebUI。

## 安全说明

WebUI v1 不配置 password，仅适合受信任网络或短期课程演示。长期公网部署必须先在 Nginx、VPN、SSO、basic auth 或其他边界层配置认证与访问控制；不要把容器端口直接暴露到公网。

当前 v1 默认使用 mock provider，不实现真实 OpenAI provider，也不实现真实 OS keychain。`CredentialManager` 使用测试用内存 adapter；环境变量 fallback 仅在显式开启时使用。真实 API key 绝不能提交、打印、写入 SQLite、写入日志或通过 WebUI 返回。

更多安全边界和发布前检查请见 [SECURITY.md](SECURITY.md)。

## 目录结构

- `src/core/`：代理循环、provider 抽象和治理逻辑。
- `src/config/`：共享 YAML 配置加载器与 registry。
- `src/store/`：SQLite run、event、timeline 与 memory 持久化。
- `src/runtime/`：workspace、文件与 shell 执行边界。
- `src/web/`：WebUI HTTP server 与页面。
- `src/cli/`：命令行入口。
- `tests/`：Vitest 单元测试。
- `docs/`：需求摘要、冷启动说明和 Superpowers 过程文档。
- `.github/workflows/`、`.gitlab-ci.yml`：持续集成。
- `Dockerfile`、`docker-compose.yml`：容器分发。
