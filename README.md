# Coding Agent Harness

## Chat-first WebUI

当前 WebUI 首页已经调整为对话优先的 AI coding agent 工作台。启动后访问 `/`，主体区域是类似 Codex 桌面端的对话流和底部输入框；用户选择 workspace/provider 并输入任务后，浏览器表单会提交到 `/api/runs/start`，先在当前对话创建 session/run，再由后台触发真实 harness run。左侧用于工作区和工具入口，右侧 Inspector 展示运行机制、允许命令、memory 和文件入口。

文件浏览与编辑器仍然保留，但定位为从对话工作台打开的辅助工具，而不是默认主体页面。

## 实时运行流 V1

浏览器对话页使用异步运行入口，提交后立即回到同一个对话流并显示 `running` 状态。服务端会先写入 `run_started` 事件，再在后台执行同一套 `runAgentLoop`、provider、guardrail 和 tool dispatcher。页面通过 `GET /api/runs/<run-id>/timeline?after=<sequence>` 轮询增量 timeline；运行结束、阻塞或进入审批状态后会刷新当前对话卡片。原有同步 `POST /api/runs` 与 `POST /api/sessions/<session-id>/runs` 仍保留，便于 CLI/API 调试和测试。

## 对话内工具调用展示 V1

对话页会从 run timeline 中提取 `tool_result` 事件，并在 AI 回复卡片中渲染为可读的工具调用列表。`list_files`、`read_file`、`write_file`、`run_command` 和 `remember` 会显示为中文动作名、目标路径或命令、执行原因、成功/失败状态以及输出预览；运行事件默认显示为摘要条，完整原始 timeline 收进可展开详情区，便于调试 harness 机制但不挤占对话主线。

## 对话内文件联动 V1

`read_file` 与 `write_file` 工具卡片会显示文件操作入口：`预览文件` 会留在同一个对话首页，并把目标文件打开到右侧 Inspector 的文件预览面板；`编辑文件` 会进入受 guardrail 保护的轻量编辑器。链接会保留当前 run/session 参数，方便在连续对话中查看 agent 刚读过或刚修改过的文件。

右侧文件预览现在使用内嵌代码面板显示：包含行号、行数/字符数元信息和当前 git 变更状态；当文件处于 modified/untracked 等状态时，会直接提供对话内 diff 面板入口，便于在同一工作台中快速核对 agent 的修改。

右侧 Inspector 也提供内联编辑表单。保存时仍复用 `POST /api/workspaces/<workspace-id>/files/<relative-path>`、workspace guardrail 与 `write_file` 工具分发，成功后回到原对话 URL 并继续保留当前 workspace、file、run/session 参数；页面会在文件预览元信息中显示 `已保存` 状态，便于确认编辑闭环已经完成。

## 对话内变更与审批展示 V1

当 agent 修改 workspace 后，对话页会把 git 工作区变化渲染为 `文件变更` 卡片，展示变更状态、相对路径、文件预览入口和对话内 diff 面板入口。点击 diff 后不会跳到原始 API，而是保持在当前对话流中，由右侧 Inspector 渲染可读的逐行 diff。遇到需要人工确认的高风险动作时，对话页会显示 `等待审批` 卡片，直接展示命令/目标、原因、护栏规则，并提供批准或拒绝按钮；审批结果仍写回 timeline。

## 对话上下文附件 V1

主对话流现在会渲染 `当前对话附件`：当用户在同一工作台中打开文件、diff 或遇到待审批动作时，中间对话区域会出现轻量附件卡片，展示文件路径、行数、变更状态、diff/编辑入口或审批入口。右侧 Inspector 继续负责展示详细代码和逐行 diff，左侧文件栏仍只是导航面板，整体交互保持“对话是主线，文件和状态是上下文面板”。

左侧栏现在也会为当前 workspace 展示真实对话入口和最近运行入口。`对话` 区来自持久化 session/thread，并携带 `workspaceId`、`sessionId` 与最后一次 `runId` 回到同一个对话首页；`最近对话` 区保留 run 级快捷入口。用户可以从侧边栏回到历史任务而不进入单独的 timeline 页面。

## Browser Editor V1

当前 WebUI 已新增浏览器内工作区文件浏览与轻量编辑入口，目标是让系统更接近可实际使用的 coding agent 工作台，而不只是一次性测试页面。

- 文件浏览页：`/workspaces/<workspace-id>/files`
- 文件编辑页：`/workspaces/<workspace-id>/files/<relative-path>`
- 保存 API：`POST /api/workspaces/<workspace-id>/files/<relative-path>`

编辑器只接收已注册的 `workspace id` 和 workspace 内相对路径，不接受浏览器传入任意服务器根路径。保存会复用 harness 现有 `write_file` action、workspace path boundary、敏感路径/密钥内容 guardrail 和工具分发器；`.env`、private key、secret-like content、路径逃逸都会被拒绝。页面只展示 workspace id 与相对路径，不暴露 workspace root。

本地启动后可以先打开：

```text
http://127.0.0.1:3000/workspaces/demo-ts/files
```

从文件列表进入某个文件后即可在浅色集成式编辑区域中修改并保存。该能力仍是轻量 Browser Editor V1，不是完整 VS Code 替代品；后续如果继续增强复杂编辑体验，会按已确认方向参考 Open Design 做更完整的视觉系统和交互规范。

这是 AI4SE Project A 的 TypeScript coding-agent harness。项目提供一个带安全边界的代理运行环境：CLI 和 WebUI 都可以触发真实 harness run，代理循环可通过 mock 或 DeepSeek provider 决策，文件操作受 workspace path boundary 约束，shell 命令受 allowlist、guardrail 与人工审批约束，运行过程会写入 SQLite timeline、memory 和 interactive session。当前方案 A 已补强为可用代码开发链路：agent 会拿到工具协议、工作区、允许命令和反馈，按“查看 -> 修改 -> 验证 -> 完成”的路径执行小型代码任务。

## 功能概览

- Action 协议与解析器：支持 `list_files`、`read_file`、`write_file`、`run_command`、`remember`、`finish` 等结构化动作。
- Workspace 注册与边界控制：只能访问配置中注册的 workspace，阻止路径逃逸和符号链接逃逸。
- 受限工具分发器：文件工具和 shell 工具统一经过 allowlist、路径归一化和敏感信息脱敏。
- Agent 主循环：provider 输出 Action，harness 执行动作并回灌观察结果；解析器保持严格 schema，同时兼容常见 provider 输出变体，例如 markdown `json` 代码块和 `{ "action": "finish" }` 这类 legacy 字段；`invalid_action` 和被护栏拦截的动作会作为反馈进入下一轮，直到 `finish` 或达到最大迭代次数。
- 人工审批 V1：allowlist 内的发布/部署命令会暂停为 `pending_approval`，由 WebUI 中的审批卡片批准或拒绝；未进入 allowlist 的命令仍直接拦截。
- 事件与记忆存储：run、event、timeline、memory、interactive session 持久化到 SQLite。
- CLI 与 WebUI：命令行和浏览器都能创建 run；WebUI 可创建 session、继续提交后续指令，并查看运行结果、工作区文件和 git diff。
- Docker 分发：支持镜像构建和 compose 启动。

## 当前前端定位

当前 WebUI 已从功能性“简单模型前端”升级为方案 B 第一版轻量智能 IDE 壳层：左侧是 workspace rail，中间是任务编排区，右侧是 Run Inspector。运行详情页提供 timeline navigator、event detail stack、Diff Inspector 与 Approval Panel，用于查看 action / guardrail / tool result / feedback / stop reason、当前 workspace 的 git 文件变更，以及需要人工确认的高风险动作。Workspace Session V1 还加入了只读代码查看入口、workspace memory 面板和 recent runs 面板；Interactive Run V1 支持创建持久化 session，并在同一 workspace/provider 下连续提交后续指令。

它不是完整 VS Code 替代品，也不包含成熟代码编辑器、调试器或插件系统。课程文档推荐的 Open Design 已作为方案 B 的设计参考写入 SPEC；本轮选择低依赖、可测试的 server-rendered IDE 壳层，后续若继续增强视觉系统或交互原型，再正式引入 Open Design 生成/审查设计系统。

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

当前版本默认保留 mock provider，因此测试和机制演示不需要真实 API key。WebUI 普通入口默认使用 DeepSeek；若要在浏览器中触发真实模型运行，需要在本地未提交的 `.env` 或部署环境变量中配置 `DEEPSEEK_API_KEY`。不要把真实 secret 写入 `.env.example`、SQLite、日志或任何已提交文件。

DeepSeek 本地配置示例：

```powershell
Copy-Item .env.example .env
notepad .env
```

在 `.env` 中设置：

```env
DEEPSEEK_API_KEY=你的真实 DeepSeek Key
```

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
- 启动 WebUI。若未配置 `DEEPSEEK_API_KEY`，页面仍可打开，但提交 DeepSeek 任务会返回“缺少 API key”的结构化错误。

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
  - id: deepseek
    type: deepseek-compatible
    baseUrl: https://api.deepseek.com
    model: deepseek-v4-flash
    apiKeyEnv: DEEPSEEK_API_KEY
    thinking: disabled
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
- `DEEPSEEK_API_KEY`：DeepSeek provider 的真实 API key，只能放在未提交的 `.env` 或受控部署环境。

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

真实代码开发链路演示：

```powershell
npm run demo:coding-task
```

该演示会创建临时 workspace，写入一个带 bug 的小型 JavaScript 项目，然后通过 harness 依次执行 `list_files`、`read_file`、`write_file`、`run_command` 和 `finish`。它不会修改当前仓库文件。

推荐在提交前至少运行：

```powershell
npm test
npm run build
```

完整交付验收：

```powershell
npm run check:acceptance
```

该命令会串联构建、全部测试、机制演示、代码开发链路演示、Git 状态检查和已跟踪文件的基础密钥扫描。课程要求对应关系见 [docs/ACCEPTANCE_CHECKLIST.md](docs/ACCEPTANCE_CHECKLIST.md)。

## 启动 CLI

先构建：

```powershell
npm run build
```

运行内置机制 demo：

```powershell
node dist/src/cli/main.js demo
```

使用 mock provider 触发一次 harness run：

```powershell
node dist/src/cli/main.js run --workspace demo-ts --provider mock --task "请完成一次 mock 运行"
```

使用 DeepSeek provider：

```powershell
node dist/src/cli/main.js run --workspace demo-ts --provider deepseek --task "阅读项目结构并给出下一步建议"
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

WebUI 首页是对话式智能代码助手：左侧是 workspace、历史对话与文件入口，中间是对话流和底部输入框，右侧是运行状态、文件预览、diff、允许命令和 memory 面板。普通页面入口默认使用 `deepseek`，不显示 `mock`；提交任务后会在同一对话流中创建 session/run，并由后台触发真实 harness run。若需要离线机制演示或测试，可以继续通过 CLI/API 显式使用 `mock` provider。

如果模型请求执行 `git push`、`npm publish`、`docker push`、`kubectl apply` 等发布/部署命令，且该命令已被当前 workspace 的 `allowedCommands` 显式允许，run 会停在 `pending_approval`。WebUI 会在对话流和右侧 Inspector 中展示待审批动作；点击“批准执行”才会真正调用工具，点击“拒绝”只记录拒绝事件，不执行命令。未出现在 allowlist 的命令不会进入审批，而是直接按 `command.not_allowlisted` 拦截。

Interactive Run V1 推荐使用 session 入口：

```powershell
Invoke-RestMethod -Method Post -ContentType "application/json" `
  -Uri "http://127.0.0.1:3000/api/sessions" `
  -Body '{"workspaceId":"demo-ts","provider":"mock","title":"Demo session"}'

Invoke-RestMethod -Method Post -ContentType "application/json" `
  -Uri "http://127.0.0.1:3000/api/sessions/<session-id>/runs" `
  -Body '{"task":"继续修复并运行测试"}'
```

浏览器中创建 session 后会留在同一个对话工作台中，可以继续提交后续指令。Session、runs、events、memory 都写入 `HARNESS_DB_PATH` 指向的 SQLite，因此服务器部署时应把 `data/` 作为持久化 volume 或宿主机目录挂载。

Workspace Session V1 提供只读文件 API：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/workspaces/demo-ts/files"
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/workspaces/demo-ts/files/README.md"
```

Diff Inspector V1 提供只读 git 变更 API：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/workspaces/demo-ts/changes"
Invoke-RestMethod -Uri "http://127.0.0.1:3000/api/workspaces/demo-ts/changes/README.md"
```

`changes` API 只返回 workspace 相对路径；单个 diff 预览上限为 200 KiB。当前版本要求 workspace root 本身是 git 仓库顶层，避免误扫父级目录。

这些 API 只能访问预注册 workspace 内的相对路径，且不会提供文件写入能力。

## WebUI 模型选择

WebUI 面向真实对话式开发体验，默认展示并选中 `deepseek` provider；页面不再显示 `mock` 选项，避免误以为浏览器主流程仍在走离线演示。

`mock` 仍然是项目必需能力：课程要求中的确定性测试、机制演示、CLI/API 调试都依赖它在无网络、无真实 API key 的情况下复现 action parsing、guardrail、feedback 和 finish 流程。因此不要从配置和测试链路中删除 `mock`；只是在 WebUI 的用户入口中隐藏它。

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

使用 DeepSeek 时，先在宿主机或部署平台设置真实 key，再启动 compose：

```powershell
$env:DEEPSEEK_API_KEY = "你的真实 DeepSeek Key"
docker compose up --build
```

Compose 会把 `DEEPSEEK_API_KEY` 作为容器环境变量传入。不要把真实 key 写入 `docker-compose.yml`、`.env.example` 或任何提交文件。

Compose 设置 `HARNESS_DB_PATH=/app/data/harness.sqlite`，并将 `/app/data` 挂载为 `harness-data` named volume，用于持久化运行历史、timeline、memory 和 interactive session。镜像构建不会复制 `.env`、本地 SQLite 数据、logs 或本地 `node_modules`。容器默认启动 WebUI。

服务器部署建议：

- 在反向代理或平台 secret 中配置 `DEEPSEEK_API_KEY`，不要烘焙进镜像。
- 将 `data/` 或 `/app/data` 持久化，否则重启后 session、timeline 和 memory 会丢失。
- 修改 `config/harness.example.yaml` 或使用独立配置文件注册服务器上的 workspace；WebUI 只能选择已注册 workspace id。
- 只把经过反向代理认证的入口暴露给访问者，不要直接暴露容器 `3000` 端口。

## 安全说明

WebUI v1 不配置 password，仅适合受信任网络或短期课程演示。长期公网部署必须先在 Nginx、VPN、SSO、basic auth 或其他边界层配置认证与访问控制；不要把容器端口直接暴露到公网。启用 DeepSeek provider、interactive session 或人工审批后，公网无认证风险更高，因为攻击者可以持续触发真实 harness run 或诱导管理员批准高风险动作。

当前 v1 已支持 DeepSeek OpenAI-compatible provider，并保留 mock provider 用于离线测试。`CredentialManager` 使用测试用内存 adapter；真实 OS keychain 留作后续增强。真实 API key 绝不能提交、打印、写入 SQLite、写入日志或通过 WebUI 返回。

更多安全边界和发布前检查请见 [SECURITY.md](SECURITY.md)。

## 目录结构

- `src/core/`：代理循环、provider 抽象和治理逻辑。
- `src/config/`：共享 YAML 配置加载器与 registry。
- `src/store/`：SQLite run、event、timeline 与 memory 持久化。
- `src/runtime/`：workspace、文件、git diff 与 shell 执行边界。
- `src/web/`：WebUI HTTP server 与页面。
- `src/cli/`：命令行入口。
- `tests/`：Vitest 单元测试。
- `docs/`：需求摘要、冷启动说明和 Superpowers 过程文档。
- `.github/workflows/`、`.gitlab-ci.yml`：持续集成。
- `Dockerfile`、`docker-compose.yml`：容器分发。
